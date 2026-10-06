import { createHash, randomBytes } from "crypto";
import { Prisma, Side } from "@prisma/client";
import { prisma } from "./prisma";
import { isClassSessionLocked } from "./class-session-lock";
import {
  EnrollmentRecipient,
  notifyClassSessionDeleted,
  notifyEnrollmentRemoved,
  notifyWaitlistDemotion,
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

// Usuário cadastrado se inscreve sempre no lado do perfil; sem ele não dá
// pra escolher o lado da inscrição.
export class PreferredSideMissingError extends Error {
  constructor(
    message = "Escolha seu lado preferido no perfil antes de se inscrever",
  ) {
    super(message);
    this.name = "PreferredSideMissingError";
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

// Quem mudou de status num reencaixe, pra avisar depois do commit.
type RebalanceOutcome = {
  promoted: EnrollmentRecipient[];
  demoted: EnrollmentRecipient[];
};

async function rebalanceSide(
  tx: Prisma.TransactionClient,
  classSessionId: number,
  side: Side,
  sideCapacity: number,
): Promise<RebalanceOutcome> {
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
    return { promoted: [], demoted: recipientsOf(toWaitlist) };
  }

  const openSlots = sideCapacity - confirmed.length;
  if (openSlots <= 0) return { promoted: [], demoted: [] };

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

  return { promoted: recipientsOf(toPromote), demoted: [] };
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
): Promise<RebalanceOutcome> {
  const sideCapacity = sideCapacityOf(capacity);
  const sides = await Promise.all([
    rebalanceSide(tx, classSessionId, "LEFT", sideCapacity),
    rebalanceSide(tx, classSessionId, "RIGHT", sideCapacity),
  ]);
  return {
    promoted: sides.flatMap(side => side.promoted),
    demoted: sides.flatMap(side => side.demoted),
  };
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
// que o admin escolheu) ou um convidado só pelo nome (inscrito pelo admin,
// ou se inscrevendo sozinho, sem conta). Nunca os dois — o CHECK da
// migration também garante isso. O lado de usuário cadastrado é o
// `preferredSide` do perfil (escolhido uma vez); só o convidado, que não tem
// perfil, traz o lado junto. `guestCancelTokenHash` só vem na inscrição que
// o próprio convidado fez — é o que deixa ele cancelar depois.
export type Enrollee =
  | { userId: number }
  | { guestName: string; side: Side; guestCancelTokenHash?: string };

// Código secreto que o convidado sem conta guarda no aparelho pra cancelar a
// própria inscrição. Só o hash vai pro banco: quem lê o banco não consegue
// cancelar a vaga de ninguém.
export function createGuestCancelToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashGuestCancelToken(token) };
}

export function hashGuestCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function enrollStudent(classSessionId: number, enrollee: Enrollee) {
  try {
    return await enrollStudentInTransaction(classSessionId, enrollee);
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
) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async tx => {
        const classSession = await tx.classSession.findUniqueOrThrow({
          where: { id: classSessionId },
        });

        let side: Side;
        let who:
          | { userId: number }
          | { guestName: string; guestCancelTokenHash?: string };
        if ("userId" in enrollee) {
          const user = await tx.user.findUnique({
            where: { id: enrollee.userId },
          });
          if (!user) {
            throw new UserNotFoundError();
          }
          if (!user.preferredSide) {
            throw new PreferredSideMissingError();
          }
          side = user.preferredSide;
          who = { userId: user.id };

          const existing = await tx.enrollment.findFirst({
            where: { classSessionId, userId: enrollee.userId },
          });
          if (existing) {
            throw new AlreadyEnrolledError();
          }
        } else {
          side = enrollee.side;
          who = {
            guestName: enrollee.guestName,
            guestCancelTokenHash: enrollee.guestCancelTokenHash,
          };
        }

        const confirmedSideCount = await tx.enrollment.count({
          where: { classSessionId, side, status: "CONFIRMED" },
        });

        const status =
          confirmedSideCount < sideCapacityOf(classSession.capacity)
            ? "CONFIRMED"
            : "WAITLISTED";

        const enrollment = await tx.enrollment.create({
          data: { classSessionId, ...who, side, status },
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

// Auto-cancelamento: do aluno logado (acha a inscrição pela sessão, não por
// nome) ou do convidado que se inscreveu sozinho (pelo hash do código que
// ficou no aparelho dele). Convidado inscrito pelo admin não tem código —
// só o admin remove.
export type CancelingEnrollee =
  | { userId: number }
  | { guestCancelTokenHash: string };

export async function cancelEnrollment(
  classSessionId: number,
  canceling: CancelingEnrollee,
) {
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
          where: { classSessionId, ...canceling },
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
  const { classSession, promoted, demoted } = await withSerializableRetry(() =>
    prisma.$transaction(
      async tx => {
        const classSession = await tx.classSession.update({
          where: { id: classSessionId },
          data,
        });

        const outcome = await rebalanceEnrollments(
          tx,
          classSession.id,
          classSession.capacity,
        );

        return { classSession, ...outcome };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  // Aumento de capacidade promove da espera; redução devolve os últimos
  // confirmados pra espera — os dois lados são avisados. Usa a turma já
  // atualizada, então a data/horário do texto é a nova, se o admin também
  // mudou o horário.
  void notifyWaitlistPromotion(classSession, promoted);
  void notifyWaitlistDemotion(classSession, demoted);
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
