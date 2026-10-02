import { Prisma, Side } from "@prisma/client";
import { prisma } from "./prisma";
import { isClassSessionLocked } from "./class-session-lock";
import {
  EnrollmentRecipient,
  notifyClassSessionDeleted,
  notifyEnrollmentRemoved,
  notifyWaitlistPromotion,
} from "./enrollment-notifications";

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

export class AlreadyEnrolledError extends Error {
  constructor(message = "Aluno já inscrito nesta turma") {
    super(message);
    this.name = "AlreadyEnrolledError";
  }
}

export class UserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundError";
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

// Destinatários de push das inscrições — convidados (`userId` nulo) ficam de
// fora, não recebem notificação.
function recipientsOf(
  enrollments: { id: number; userId: number | null }[],
): EnrollmentRecipient[] {
  return enrollments.flatMap(e =>
    e.userId === null ? [] : [{ enrollmentId: e.id, userId: e.userId }],
  );
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

// Devolve quem foi promovido da espera, pra avisar depois do commit.
async function rebalanceSide(
  tx: Prisma.TransactionClient,
  classSessionId: number,
  side: Side,
  sideCapacity: number,
): Promise<EnrollmentRecipient[]> {
  const confirmed = await tx.enrollment.findMany({
    where: { classSessionId, side, status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
  });

  if (confirmed.length > sideCapacity) {
    const toWaitlist = confirmed.slice(sideCapacity);
    await tx.enrollment.updateMany({
      where: { id: { in: toWaitlist.map(e => e.id) } },
      data: { status: "WAITLISTED" },
    });
    return [];
  }

  const openSlots = sideCapacity - confirmed.length;
  if (openSlots <= 0) return [];

  const toPromote = await tx.enrollment.findMany({
    where: { classSessionId, side, status: "WAITLISTED" },
    orderBy: { createdAt: "asc" },
    take: openSlots,
  });

  if (toPromote.length > 0) {
    await tx.enrollment.updateMany({
      where: { id: { in: toPromote.map(e => e.id) } },
      data: { status: "CONFIRMED" },
    });
  }

  return recipientsOf(toPromote);
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
): Promise<EnrollmentRecipient[]> {
  const sideCapacity = sideCapacityOf(capacity);
  const promoted = await Promise.all([
    rebalanceSide(tx, classSessionId, "LEFT", sideCapacity),
    rebalanceSide(tx, classSessionId, "RIGHT", sideCapacity),
  ]);
  return promoted.flat();
}

async function deleteAndPromoteNext(
  tx: Prisma.TransactionClient,
  classSession: { id: number; capacity: number },
  enrollment: { id: number; status: string; side: Side },
): Promise<{
  counters: EnrollmentCounters;
  promoted: EnrollmentRecipient[];
}> {
  await tx.enrollment.delete({ where: { id: enrollment.id } });
  let promoted: EnrollmentRecipient[] = [];

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
      promoted = recipientsOf([nextInLine]);
    }
  }

  const counters = await getCounters(
    tx,
    classSession.id,
    classSession.capacity,
  );
  return { counters, promoted };
}

// Quem está sendo inscrito: um usuário logado (o próprio aluno, ou alguém
// que o admin escolheu) ou um convidado só pelo nome (só o admin inscreve
// convidado). Nunca os dois — o CHECK da migration também garante isso.
export type Enrollee = { userId: number } | { guestName: string };

export async function enrollStudent(
  classSessionId: number,
  enrollee: Enrollee,
  side: Side,
) {
  try {
    return await enrollStudentInTransaction(classSessionId, enrollee, side);
  } catch (error) {
    // Clique duplo / duas abas: as duas tentativas passam pela checagem de
    // `existing` antes de qualquer uma commitar, e a segunda bate no índice
    // único (classSessionId, userId) — é o mesmo "já inscrito", não um 500.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AlreadyEnrolledError();
    }
    throw error;
  }
}

function enrollStudentInTransaction(
  classSessionId: number,
  enrollee: Enrollee,
  side: Side,
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async tx => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
        });

        if ("userId" in enrollee) {
          const user = await tx.user.findUnique({
            where: { id: enrollee.userId },
          });
          if (!user) {
            throw new UserNotFoundError();
          }

          const existing = await tx.enrollment.findFirst({
            where: { classSessionId, userId: enrollee.userId },
          });
          if (existing) {
            throw new AlreadyEnrolledError();
          }
        }

        const confirmedSideCount = await tx.enrollment.count({
          where: { classSessionId, side, status: "CONFIRMED" },
        });

        const status =
          confirmedSideCount < sideCapacityOf(classSession.capacity)
            ? "CONFIRMED"
            : "WAITLISTED";

        const enrollment = await tx.enrollment.create({
          data: { classSessionId, ...enrollee, side, status },
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

// Auto-cancelamento do aluno logado: acha a inscrição dele pela sessão, não
// por nome. Convidado não cancela sozinho (não tem login).
export async function cancelEnrollment(classSessionId: number, userId: number) {
  const { classSession, counters, promoted } = await withSerializableRetry(() =>
    prisma.$transaction(
      async tx => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
        });

        if (isClassSessionLocked(classSession.date, classSession.lockAt)) {
          throw new ClassSessionLockedError();
        }

        const enrollment = await tx.enrollment.findFirst({
          where: { classSessionId, userId },
        });

        if (!enrollment) {
          throw new EnrollmentNotFoundError();
        }

        const outcome = await deleteAndPromoteNext(
          tx,
          classSession,
          enrollment,
        );
        return { classSession, ...outcome };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  // Só depois do commit (e fora do retry, pra uma tentativa abortada não
  // avisar ninguém): quem subiu da espera fica sabendo.
  void notifyWaitlistPromotion(classSession, promoted);
  return counters;
}

export async function removeEnrollmentById(
  classSessionId: number,
  enrollmentId: number,
) {
  const { classSession, removed, counters, promoted } =
    await withSerializableRetry(() =>
      prisma.$transaction(
        async tx => {
          const classSession = await tx.classSession.findUniqueOrThrow({
            where: { id: classSessionId },
          });

          const enrollment = await tx.enrollment.findFirst({
            where: { id: enrollmentId, classSessionId },
          });

          if (!enrollment) {
            throw new EnrollmentNotFoundError();
          }

          const outcome = await deleteAndPromoteNext(
            tx,
            classSession,
            enrollment,
          );
          return { classSession, removed: enrollment, ...outcome };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

  const [removedRecipient] = recipientsOf([removed]);
  if (removedRecipient) {
    void notifyEnrollmentRemoved(classSession, removedRecipient);
  }
  void notifyWaitlistPromotion(classSession, promoted);
  return counters;
}

export async function updateClassSessionWithRebalance(
  classSessionId: number,
  data: Prisma.ClassSessionUpdateInput,
) {
  const { classSession, promoted } = await withSerializableRetry(() =>
    prisma.$transaction(
      async tx => {
        const classSession = await tx.classSession.update({
          where: { id: classSessionId },
          data,
        });

        const promoted = await rebalanceEnrollments(
          tx,
          classSession.id,
          classSession.capacity,
        );

        return { classSession, promoted };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  // Aumento de capacidade promove da espera; a redução (confirmado voltando
  // pra espera) não tem aviso nesta versão. Usa a turma já atualizada, então
  // a data/horário do texto é a nova, se o admin também mudou o horário.
  void notifyWaitlistPromotion(classSession, promoted);
  return classSession;
}

// Exclui a turma (cascade nas inscrições) e avisa quem estava inscrito —
// confirmado ou na espera. Os `userId` são lidos na mesma transação do
// delete, antes dele, pra não perder quem se inscreveu no meio do caminho.
export async function deleteClassSessionAndNotify(classSessionId: number) {
  const { classSession, recipients } = await withSerializableRetry(() =>
    prisma.$transaction(
      async tx => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
          include: { enrollments: { select: { id: true, userId: true } } },
        });

        await tx.classSession.delete({ where: { id: classSessionId } });

        return {
          classSession,
          recipients: recipientsOf(classSession.enrollments),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  void notifyClassSessionDeleted(classSession, recipients);
}
