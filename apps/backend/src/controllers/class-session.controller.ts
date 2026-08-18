import { Request, Response } from "express";
import { Prisma, Enrollment, Receipt } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { classLevelRank } from "../lib/class-levels";
import { isClassSessionLocked } from "../lib/class-session-lock";
import {
  ClassSessionLockedError,
  EnrollmentNotFoundError,
  cancelEnrollment,
  enrollStudent,
  updateClassSessionWithRebalance,
} from "../lib/enrollment-service";
import {
  bulkCreateSchema,
  cancelSchema,
  enrollSchema,
  updateClassSessionSchema,
} from "../schemas/class-session.schema";

const DEFAULT_CAPACITY = 8;

function addOneHour(startTime: string): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = (hours * 60 + minutes + 60) % (24 * 60);
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function byStartTimeThenLevel(
  a: { startTime: string; classLevel: string },
  b: { startTime: string; classLevel: string },
): number {
  return (
    a.startTime.localeCompare(b.startTime) ||
    classLevelRank(a.classLevel) - classLevelRank(b.classLevel)
  );
}

function parseId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

function serializeSummary(
  classSession: {
    enrollments: Enrollment[];
    date: Date;
    lockAt: string | null;
  } & Record<string, unknown>,
) {
  const { enrollments, ...rest } = classSession;
  const confirmed = enrollments.filter((e) => e.status === "CONFIRMED");
  const waitlisted = enrollments.filter((e) => e.status === "WAITLISTED");

  return {
    ...rest,
    isLocked: isClassSessionLocked(classSession.date, classSession.lockAt),
    confirmedCount: confirmed.length,
    waitlistCount: waitlisted.length,
    confirmedLeft: confirmed
      .filter((e) => e.side === "LEFT")
      .map((e) => e.studentName),
    confirmedRight: confirmed
      .filter((e) => e.side === "RIGHT")
      .map((e) => e.studentName),
  };
}

function serializeEnrollmentWithReceipt(
  e: Enrollment & { receipt: Receipt | null },
) {
  return {
    id: e.id,
    studentName: e.studentName,
    side: e.side,
    createdAt: e.createdAt,
    receipt: e.receipt
      ? {
          id: e.receipt.id,
          filePath: e.receipt.filePath,
          status: e.receipt.status,
          adminComment: e.receipt.adminComment,
        }
      : null,
  };
}

function serializeDetail(
  classSession: {
    enrollments: (Enrollment & { receipt: Receipt | null })[];
    date: Date;
    lockAt: string | null;
  } & Record<string, unknown>,
) {
  const { enrollments, ...rest } = classSession;
  const confirmed = enrollments
    .filter((e) => e.status === "CONFIRMED")
    .map(serializeEnrollmentWithReceipt);
  const waitlist = enrollments
    .filter((e) => e.status === "WAITLISTED")
    .map(serializeEnrollmentWithReceipt);

  return {
    ...rest,
    isLocked: isClassSessionLocked(classSession.date, classSession.lockAt),
    confirmedCount: confirmed.length,
    waitlistCount: waitlist.length,
    confirmed,
    waitlist,
  };
}

export async function createClassSessionsBulk(req: Request, res: Response) {
  const result = bulkCreateSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { date, timeSlots, lockAt } = result.data;

  const created = await Promise.all(
    timeSlots.flatMap((slot) =>
      slot.levels.map((classLevel) =>
        prisma.classSession.create({
          data: {
            date,
            startTime: slot.startTime,
            endTime: addOneHour(slot.startTime),
            classLevel,
            capacity: DEFAULT_CAPACITY,
            lockAt: lockAt ?? null,
          },
        }),
      ),
    ),
  );

  created.sort(byStartTimeThenLevel);

  res
    .status(201)
    .json(created.map((c) => serializeSummary({ ...c, enrollments: [] })));
}

export async function listClassDatesByMonth(req: Request, res: Response) {
  const monthParam = req.query.month;

  if (typeof monthParam !== "string" || !/^\d{4}-\d{2}$/.test(monthParam)) {
    res
      .status(400)
      .json({ error: "Query param 'month' is required in YYYY-MM format" });
    return;
  }

  const [year, month] = monthParam.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const classSessions = await prisma.classSession.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true },
    distinct: ["date"],
  });

  res.json({
    dates: classSessions.map((c) => c.date.toISOString().slice(0, 10)),
  });
}

export async function listClassSessions(req: Request, res: Response) {
  const dateParam = req.query.date;

  if (typeof dateParam !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    res
      .status(400)
      .json({ error: "Query param 'date' is required in YYYY-MM-DD format" });
    return;
  }

  const date = new Date(`${dateParam}T00:00:00.000Z`);

  const classSessions = await prisma.classSession.findMany({
    where: { date },
    orderBy: { startTime: "asc" },
    include: { enrollments: { orderBy: { createdAt: "asc" } } },
  });

  classSessions.sort(byStartTimeThenLevel);

  res.json(classSessions.map(serializeSummary));
}

export async function getClassSessionById(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const classSession = await prisma.classSession.findUnique({
    where: { id },
    include: {
      enrollments: { orderBy: { createdAt: "asc" }, include: { receipt: true } },
    },
  });

  if (!classSession) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  res.json(serializeDetail(classSession));
}

export async function updateClassSession(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const result = updateClassSessionSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const classSession = await updateClassSessionWithRebalance(
      id,
      result.data,
    );
    res.json(classSession);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Class session not found" });
      return;
    }
    throw error;
  }
}

export async function deleteClassSession(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  try {
    await prisma.classSession.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Class session not found" });
      return;
    }
    throw error;
  }
}

export async function createEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const result = enrollSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const outcome = await enrollStudent(
      id,
      result.data.studentName,
      result.data.side,
    );
    res.status(201).json(outcome);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Class session not found" });
      return;
    }
    throw error;
  }
}

export async function cancelEnrollmentByName(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const result = cancelSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const counters = await cancelEnrollment(id, result.data.studentName);
    res.json(counters);
  } catch (error) {
    if (error instanceof EnrollmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof ClassSessionLockedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Class session not found" });
      return;
    }
    throw error;
  }
}
