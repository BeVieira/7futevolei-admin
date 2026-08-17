import { Prisma, Side } from "@prisma/client";
import { prisma } from "./prisma";
import { isClassSessionLocked } from "./class-session-lock";

export class EnrollmentNotFoundError extends Error {
  constructor(message = "Enrollment not found") {
    super(message);
    this.name = "EnrollmentNotFoundError";
  }
}

export class ClassSessionLockedError extends Error {
  constructor(
    message = "A lista de inscritos está trancada, não é mais possível cancelar",
  ) {
    super(message);
    this.name = "ClassSessionLockedError";
  }
}

type EnrollmentCounters = {
  confirmedCount: number;
  waitlistCount: number;
  capacity: number;
};

const MAX_SERIALIZATION_RETRIES = 3;

async function withSerializableRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (!isSerializationFailure || attempt >= MAX_SERIALIZATION_RETRIES) {
        throw error;
      }
    }
  }
}

function sideCapacityOf(capacity: number): number {
  return Math.floor(capacity / 2);
}

async function getCounters(
  tx: Prisma.TransactionClient,
  classSessionId: number,
  capacity: number,
): Promise<EnrollmentCounters> {
  const [confirmedCount, waitlistCount] = await Promise.all([
    tx.enrollment.count({ where: { classSessionId, status: "CONFIRMED" } }),
    tx.enrollment.count({ where: { classSessionId, status: "WAITLISTED" } }),
  ]);

  return { confirmedCount, waitlistCount, capacity };
}

async function rebalanceSide(
  tx: Prisma.TransactionClient,
  classSessionId: number,
  side: Side,
  sideCapacity: number,
): Promise<void> {
  const confirmed = await tx.enrollment.findMany({
    where: { classSessionId, side, status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
  });

  if (confirmed.length > sideCapacity) {
    const toWaitlist = confirmed.slice(sideCapacity);
    await tx.enrollment.updateMany({
      where: { id: { in: toWaitlist.map((e) => e.id) } },
      data: { status: "WAITLISTED" },
    });
    return;
  }

  const openSlots = sideCapacity - confirmed.length;
  if (openSlots <= 0) return;

  const toPromote = await tx.enrollment.findMany({
    where: { classSessionId, side, status: "WAITLISTED" },
    orderBy: { createdAt: "asc" },
    take: openSlots,
  });

  if (toPromote.length > 0) {
    await tx.enrollment.updateMany({
      where: { id: { in: toPromote.map((e) => e.id) } },
      data: { status: "CONFIRMED" },
    });
  }
}

/**
 * Reencaixa confirmados/lista de espera de cada lado após a capacidade da
 * aula mudar: libera vaga → promove os mais antigos da espera; reduz vaga →
 * os últimos confirmados a entrar voltam para a espera.
 */
async function rebalanceEnrollments(
  tx: Prisma.TransactionClient,
  classSessionId: number,
  capacity: number,
): Promise<void> {
  const sideCapacity = sideCapacityOf(capacity);
  await Promise.all([
    rebalanceSide(tx, classSessionId, "LEFT", sideCapacity),
    rebalanceSide(tx, classSessionId, "RIGHT", sideCapacity),
  ]);
}

async function deleteAndPromoteNext(
  tx: Prisma.TransactionClient,
  classSession: { id: number; capacity: number },
  enrollment: { id: number; status: string; side: Side },
): Promise<EnrollmentCounters> {
  await tx.enrollment.delete({ where: { id: enrollment.id } });

  if (enrollment.status === "CONFIRMED") {
    const nextInLine = await tx.enrollment.findFirst({
      where: {
        classSessionId: classSession.id,
        status: "WAITLISTED",
        side: enrollment.side,
      },
      orderBy: { createdAt: "asc" },
    });

    if (nextInLine) {
      await tx.enrollment.update({
        where: { id: nextInLine.id },
        data: { status: "CONFIRMED" },
      });
    }
  }

  return getCounters(tx, classSession.id, classSession.capacity);
}

// Identificar o aluno só pelo nome (sem login) é uma limitação conhecida e
// aceita nesta fase — já é uma melhoria grande sobre a lista do WhatsApp,
// mesmo não sendo à prova de falhas (ex: nomes duplicados ou digitados
// diferente na hora de cancelar não são tratados).

export async function enrollStudent(
  classSessionId: number,
  studentName: string,
  side: Side,
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
        });

        const confirmedSideCount = await tx.enrollment.count({
          where: { classSessionId, side, status: "CONFIRMED" },
        });

        const status =
          confirmedSideCount < sideCapacityOf(classSession.capacity)
            ? "CONFIRMED"
            : "WAITLISTED";

        const enrollment = await tx.enrollment.create({
          data: { classSessionId, studentName, side, status },
        });

        const counters = await getCounters(
          tx,
          classSessionId,
          classSession.capacity,
        );

        return { enrollment, ...counters };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function cancelEnrollment(
  classSessionId: number,
  studentName: string,
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
        });

        if (isClassSessionLocked(classSession.date, classSession.lockAt)) {
          throw new ClassSessionLockedError();
        }

        const enrollment = await tx.enrollment.findFirst({
          where: {
            classSessionId,
            studentName: { equals: studentName.trim(), mode: "insensitive" },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!enrollment) {
          throw new EnrollmentNotFoundError();
        }

        return deleteAndPromoteNext(tx, classSession, enrollment);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function updateClassSessionWithRebalance(
  classSessionId: number,
  data: Prisma.ClassSessionUpdateInput,
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const classSession = await tx.classSession.update({
          where: { id: classSessionId },
          data,
        });

        await rebalanceEnrollments(tx, classSession.id, classSession.capacity);

        return classSession;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function removeEnrollmentById(
  classSessionId: number,
  enrollmentId: number,
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
        });

        const enrollment = await tx.enrollment.findFirst({
          where: { id: enrollmentId, classSessionId },
        });

        if (!enrollment) {
          throw new EnrollmentNotFoundError();
        }

        return deleteAndPromoteNext(tx, classSession, enrollment);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
