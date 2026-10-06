import { Request, Response } from "express";
import { Prisma, Enrollment, Receipt } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { classLevelRank } from "../lib/class-levels";
import {
  BRAZIL_UTC_OFFSET_HOURS,
  isClassSessionLocked,
} from "../lib/class-session-lock";
import {
  AlreadyEnrolledError,
  CancelingEnrollee,
  ClassSessionLockedError,
  Enrollee,
  EnrollmentNotFoundError,
  PreferredSideMissingError,
  UserNotFoundError,
  cancelEnrollment,
  createGuestCancelToken,
  deleteClassSessionAndNotify,
  enrollStudent,
  hashGuestCancelToken,
  removeEnrollmentById,
  updateClassSessionWithRebalance,
} from "../lib/enrollment-service";
import {
  adminEnrollSchema,
  bulkCreateSchema,
  guestCancelSchema,
  guestEnrollSchema,
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

// `date` é salvo como meia-noite UTC representando o dia no Brasil (ver
// class-session-lock.ts), então "hoje" precisa ser calculado no fuso do
// Brasil, não em UTC puro — perto da meia-noite UTC os dois divergem.
function getTodayInBrazil(): Date {
  const nowInBrazil = new Date(
    Date.now() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  return new Date(
    Date.UTC(
      nowInBrazil.getUTCFullYear(),
      nowInBrazil.getUTCMonth(),
      nowInBrazil.getUTCDate(),
    ),
  );
}

function getCurrentTimeInBrazil(): string {
  const nowInBrazil = new Date(
    Date.now() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  const hours = String(nowInBrazil.getUTCHours()).padStart(2, "0");
  const minutes = String(nowInBrazil.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

type EnrollmentWithUser = Enrollment & { user: { name: string } | null };

// Inclui só o nome do usuário de cada inscrição — o nome exibido é sempre o
// `User.name` atual (join), e o resto do `User` não sai nas rotas públicas.
const enrollmentUserName = { user: { select: { name: true } } } as const;

// Nome exibido: o nome atual do usuário, ou o nome digitado pelo admin no
// caso de convidado. `?? ""` só cobre um estado que o CHECK da migration
// impede (sem usuário e sem nome de convidado).
function displayNameOf(e: EnrollmentWithUser): string {
  return e.user?.name ?? e.guestName ?? "";
}

function serializeSummary(
  classSession: {
    enrollments: EnrollmentWithUser[];
    date: Date;
    lockAt: string | null;
  } & Record<string, unknown>,
) {
  const { enrollments, ...rest } = classSession;
  const confirmed = enrollments.filter(e => e.status === "CONFIRMED");
  const waitlisted = enrollments.filter(e => e.status === "WAITLISTED");

  return {
    ...rest,
    isLocked: isClassSessionLocked(classSession.date, classSession.lockAt),
    confirmedCount: confirmed.length,
    waitlistCount: waitlisted.length,
    confirmedLeft: confirmed.filter(e => e.side === "LEFT").map(displayNameOf),
    confirmedRight: confirmed
      .filter(e => e.side === "RIGHT")
      .map(displayNameOf),
    waitlist: waitlisted.map(displayNameOf),
  };
}

// Visão pública de uma inscrição no detalhe da turma: só nome e lado —
// quem é usuário e quem é convidado, e os comprovantes, ficam só na visão
// do admin (`serializeEnrollmentForAdmin`).
function serializeEnrollmentForPublic(e: EnrollmentWithUser) {
  return {
    id: e.id,
    studentName: displayNameOf(e),
    side: e.side,
    createdAt: e.createdAt,
  };
}

// `userId: null` = convidado inscrito pelo admin.
function serializeEnrollmentForAdmin(
  e: EnrollmentWithUser & { receipt: Receipt | null },
) {
  return {
    ...serializeEnrollmentForPublic(e),
    userId: e.userId,
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

function serializeDetail<E extends EnrollmentWithUser, Out>(
  classSession: {
    enrollments: E[];
    date: Date;
    lockAt: string | null;
  } & Record<string, unknown>,
  serializeEnrollment: (e: E) => Out,
) {
  const { enrollments, ...rest } = classSession;
  const confirmed = enrollments
    .filter(e => e.status === "CONFIRMED")
    .map(serializeEnrollment);
  const waitlist = enrollments
    .filter(e => e.status === "WAITLISTED")
    .map(serializeEnrollment);

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
    timeSlots.flatMap(slot =>
      slot.levels.map(classLevel =>
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
    .json(created.map(c => serializeSummary({ ...c, enrollments: [] })));
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
    dates: classSessions.map(c => c.date.toISOString().slice(0, 10)),
  });
}

export async function getNextAvailableDate(_req: Request, res: Response) {
  const today = getTodayInBrazil();
  const currentTime = getCurrentTimeInBrazil();

  const ongoingToday = await prisma.classSession.findFirst({
    where: { date: today, endTime: { gt: currentTime } },
    select: { date: true },
  });

  if (ongoingToday) {
    res.json({ date: today.toISOString().slice(0, 10) });
    return;
  }

  const nextSession = await prisma.classSession.findFirst({
    where: { date: { gt: today } },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  const date = (nextSession?.date ?? today).toISOString().slice(0, 10);

  res.json({ date });
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
    include: {
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: enrollmentUserName,
      },
    },
  });

  classSessions.sort(byStartTimeThenLevel);

  res.json(classSessions.map(serializeSummary));
}

// Detalhe público: nomes e lados, sem comprovante nem `userId`.
export async function getClassSessionById(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const classSession = await prisma.classSession.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: enrollmentUserName,
      },
    },
  });

  if (!classSession) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  res.json(serializeDetail(classSession, serializeEnrollmentForPublic));
}

// Detalhe do admin (rota própria com `requireAdmin`, ver
// class-session.routes.ts): cada inscrição traz também `userId` (null =
// convidado) e o comprovante.
export async function getClassSessionAdminDetail(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const classSession = await prisma.classSession.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: { receipt: true, ...enrollmentUserName },
      },
    },
  });

  if (!classSession) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  res.json(serializeDetail(classSession, serializeEnrollmentForAdmin));
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
    const classSession = await updateClassSessionWithRebalance(id, result.data);
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
    await deleteClassSessionAndNotify(id);
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

// `extra` entra junto no corpo da resposta (ex: o código de cancelamento do
// convidado que se inscreveu sozinho).
async function respondWithEnrollment(
  res: Response,
  classSessionId: number,
  enrollee: Enrollee,
  extra: Record<string, unknown> = {},
) {
  try {
    const { enrollment, ...counters } = await enrollStudent(
      classSessionId,
      enrollee,
    );
    const user = enrollment.userId
      ? await prisma.user.findUnique({
          where: { id: enrollment.userId },
          select: { name: true },
        })
      : null;

    res.status(201).json({
      enrollment: {
        id: enrollment.id,
        classSessionId: enrollment.classSessionId,
        userId: enrollment.userId,
        studentName: displayNameOf({ ...enrollment, user }),
        side: enrollment.side,
        status: enrollment.status,
        createdAt: enrollment.createdAt,
      },
      ...counters,
      ...extra,
    });
  } catch (error) {
    if (error instanceof AlreadyEnrolledError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof PreferredSideMissingError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: error.message });
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

// Aluno logado se inscrevendo: a identidade vem da sessão, nunca do payload.
export async function createEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  await respondWithEnrollment(res, id, { userId: res.locals.user.id });
}

// Admin inscrevendo um usuário cadastrado ou um convidado só pelo nome.
export async function adminCreateEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const result = adminEnrollSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  await respondWithEnrollment(res, id, result.data);
}

// Convidado se inscrevendo sozinho, sem conta: nome e lado no payload. A
// resposta traz o código de cancelamento (só aparece aqui — o banco guarda o
// hash), que o aparelho guarda pra mostrar a vaga e cancelar depois.
export async function createGuestEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const result = guestEnrollSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { token, hash } = createGuestCancelToken();
  await respondWithEnrollment(
    res,
    id,
    { ...result.data, guestCancelTokenHash: hash },
    { cancelToken: token },
  );
}

export async function removeEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const enrollmentId = parseId(req.params.enrollmentId);

  if (id === null || enrollmentId === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  try {
    const counters = await removeEnrollmentById(id, enrollmentId);
    res.json(counters);
  } catch (error) {
    if (error instanceof EnrollmentNotFoundError) {
      res.status(404).json({ error: error.message });
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

export async function cancelMyEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  await respondWithCancel(res, id, { userId: res.locals.user.id });
}

// Convidado cancelando a própria inscrição com o código que ficou no
// aparelho. Código errado ou de outra turma responde 404, igual a "não
// inscrito".
export async function cancelGuestEnrollment(req: Request, res: Response) {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(404).json({ error: "Class session not found" });
    return;
  }

  const result = guestCancelSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  await respondWithCancel(res, id, {
    guestCancelTokenHash: hashGuestCancelToken(result.data.cancelToken),
  });
}

async function respondWithCancel(
  res: Response,
  classSessionId: number,
  canceling: CancelingEnrollee,
) {
  try {
    const counters = await cancelEnrollment(classSessionId, canceling);
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
