import { hasClassSessionEnded } from "./class-session-lock";
import {
  PushNotConfiguredError,
  PushPayload,
  sendPushNotification,
} from "./push-service";

// Avisos por push ligados a mudanças numa inscrição. Todos são
// best-effort: chamados **depois** da transação commitar e sem `await` pelo
// chamador (`void notifyX(...)`), nunca rejeitam — falha de push (ou push
// não configurado) só vira log, a operação de inscrição já foi concluída.
// Só recebe quem tem `userId`: convidado não tem aparelho inscrito.

type ClassSessionInfo = {
  date: Date;
  startTime: string;
  endTime: string;
  classLevel: string;
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// "Iniciante de qui, 03/10, às 07:00". `date` é meia-noite UTC do dia no
// Brasil, então os getters UTC já dão o dia certo.
function describeClassSession(classSession: ClassSessionInfo): string {
  const { date } = classSession;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${classSession.classLevel} de ${WEEKDAYS[date.getUTCDay()]}, ${day}/${month}, às ${classSession.startTime}`;
}

async function notifyUsers(userIds: number[], payload: PushPayload) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;

  try {
    await sendPushNotification(payload, { userId: { in: uniqueIds } });
  } catch (error) {
    if (error instanceof PushNotConfiguredError) return;
    console.error("Falha ao enviar notificação de inscrição:", error);
  }
}

// Aviso sobre aula que já terminou (ex: admin limpando turma antiga) não
// serve pra nada — só confundiria o aluno.
function isStillRelevant(classSession: ClassSessionInfo): boolean {
  return !hasClassSessionEnded(classSession);
}

export async function notifyWaitlistPromotion(
  classSession: ClassSessionInfo,
  userIds: number[],
) {
  if (!isStillRelevant(classSession)) return;

  await notifyUsers(userIds, {
    title: "Você saiu da lista de espera!",
    body: `Abriu uma vaga e sua inscrição na aula ${describeClassSession(classSession)} está confirmada.`,
    url: "/minhas-aulas",
  });
}

export async function notifyEnrollmentRemoved(
  classSession: ClassSessionInfo,
  userId: number,
) {
  if (!isStillRelevant(classSession)) return;

  await notifyUsers([userId], {
    title: "Inscrição removida",
    body: `Sua inscrição na aula ${describeClassSession(classSession)} foi removida pelo professor.`,
    url: "/",
  });
}

export async function notifyClassSessionDeleted(
  classSession: ClassSessionInfo,
  userIds: number[],
) {
  if (!isStillRelevant(classSession)) return;

  await notifyUsers(userIds, {
    title: "Aula cancelada",
    body: `A aula ${describeClassSession(classSession)} foi cancelada e sua inscrição foi removida.`,
    url: "/",
  });
}

export function receiptReminderPayload(
  classSession: ClassSessionInfo,
): PushPayload {
  return {
    title: "Envie seu comprovante",
    body: `A aula ${describeClassSession(classSession)} terminou. Envie o comprovante de pagamento em Minhas aulas.`,
    url: "/minhas-aulas",
  };
}
