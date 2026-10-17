import {
  computeClassSessionEnd,
  hasClassSessionEnded,
} from "./class-session-lock";
import {
  PushDeliveryOptions,
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

// Quem recebe: o usuário dono de uma inscrição. O id da inscrição vira o
// `topic` do push.
export type EnrollmentRecipient = { enrollmentId: number; userId: number };

const REMINDER_TTL_SECONDS = 24 * 60 * 60;
// Piso do TTL: o serviço de push trata TTL 0 como "entrega agora ou
// descarta", o que perderia o aviso de um celular momentaneamente offline.
const MIN_TTL_SECONDS = 60;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// "qui, 03/10". `date` é meia-noite UTC do dia no Brasil, então os getters
// UTC já dão o dia certo.
export function describeClassDay(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[date.getUTCDay()]}, ${day}/${month}`;
}

// "Iniciante de qui, 03/10, às 07:00".
function describeClassSession(classSession: ClassSessionInfo): string {
  return `${classSession.classLevel} de ${describeClassDay(classSession.date)}, às ${classSession.startTime}`;
}

// Um aviso por inscrição, com `topic` próprio: se o aparelho estiver offline
// e chegarem dois avisos da mesma inscrição, o serviço de push entrega só o
// mais recente. O topic precisa ser base64url *decodificável* (até 32
// caracteres): a Apple recusa com `BadWebPushTopic` um texto cru como
// "enrollment-14", cujo comprimento (13, ≡ 1 mod 4) não é base64 válido.
// Por isso codificamos; com id de até 10 dígitos dá no máximo 28 caracteres.
function enrollmentTopic(enrollmentId: number): string {
  return Buffer.from(`enrollment-${enrollmentId}`).toString("base64url");
}

// Aviso de mudança na inscrição só vale até a aula terminar — depois disso
// não adianta entregar (o TTL faz o serviço de push descartar sozinho).
function untilClassEnds(classSession: ClassSessionInfo): PushDeliveryOptions {
  const secondsLeft = Math.floor(
    (computeClassSessionEnd(classSession).getTime() - Date.now()) / 1000,
  );
  return { TTL: Math.max(secondsLeft, MIN_TTL_SECONDS), urgency: "high" };
}

async function notifyRecipients(
  recipients: EnrollmentRecipient[],
  payload: PushPayload,
  options: PushDeliveryOptions,
) {
  await Promise.all(
    recipients.map(async ({ enrollmentId, userId }) => {
      try {
        await sendPushNotification(
          payload,
          { userId },
          { ...options, topic: enrollmentTopic(enrollmentId) },
        );
      } catch (error) {
        if (error instanceof PushNotConfiguredError) return;
        console.error("Falha ao enviar notificação de inscrição:", error);
      }
    }),
  );
}

// Aviso sobre aula que já terminou (ex: admin limpando turma antiga) não
// serve pra nada — só confundiria o aluno.
function isStillRelevant(classSession: ClassSessionInfo): boolean {
  return !hasClassSessionEnded(classSession);
}

export async function notifyWaitlistPromotion(
  classSession: ClassSessionInfo,
  recipients: EnrollmentRecipient[],
) {
  if (recipients.length === 0 || !isStillRelevant(classSession)) return;

  await notifyRecipients(
    recipients,
    {
      title: "Você saiu da lista de espera!",
      body: `Abriu uma vaga e sua inscrição na aula ${describeClassSession(classSession)} está confirmada.`,
      url: "/minhas-aulas",
    },
    untilClassEnds(classSession),
  );
}

export async function notifyWaitlistDemotion(
  classSession: ClassSessionInfo,
  recipients: EnrollmentRecipient[],
) {
  if (recipients.length === 0 || !isStillRelevant(classSession)) return;

  await notifyRecipients(
    recipients,
    {
      title: "Você voltou para a lista de espera",
      body: `A aula ${describeClassSession(classSession)} teve as vagas reduzidas e sua inscrição voltou para a lista de espera.`,
      url: "/minhas-aulas",
    },
    untilClassEnds(classSession),
  );
}

export async function notifyEnrollmentRemoved(
  classSession: ClassSessionInfo,
  recipient: EnrollmentRecipient,
) {
  if (!isStillRelevant(classSession)) return;

  await notifyRecipients(
    [recipient],
    {
      title: "Inscrição removida",
      body: `Sua inscrição na aula ${describeClassSession(classSession)} foi removida pelo professor.`,
      url: "/",
    },
    untilClassEnds(classSession),
  );
}

export async function notifyClassSessionDeleted(
  classSession: ClassSessionInfo,
  recipients: EnrollmentRecipient[],
) {
  if (recipients.length === 0 || !isStillRelevant(classSession)) return;

  await notifyRecipients(
    recipients,
    {
      title: "Aula cancelada",
      body: `A aula ${describeClassSession(classSession)} foi cancelada e sua inscrição foi removida.`,
      url: "/",
    },
    untilClassEnds(classSession),
  );
}

// Cobrança continua valendo depois da aula: segura por 24h se o aparelho
// estiver offline, sem pressa de acordar o celular.
export function receiptReminderDelivery(
  enrollmentId: number,
): PushDeliveryOptions {
  return {
    TTL: REMINDER_TTL_SECONDS,
    urgency: "normal",
    topic: enrollmentTopic(enrollmentId),
  };
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
