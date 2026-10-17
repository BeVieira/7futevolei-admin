import { ClassOpeningNotification } from "@prisma/client";
import { prisma } from "./prisma";
import {
  BRAZIL_UTC_OFFSET_HOURS,
  hasClassSessionEnded,
} from "./class-session-lock";
import { describeClassDay } from "./enrollment-notifications";
import {
  PushDeliveryOptions,
  PushNotConfiguredError,
  isPushConfigured,
  sendPushNotification,
} from "./push-service";

// Aviso "turmas abertas": disparado à mão pelo admin (botão na tela do
// admin), vai pra **todos** os aparelhos com notificação ativa. Cada disparo
// fica registrado em `ClassOpeningNotification` pra o admin saber que já
// avisou hoje — o segundo disparo do dia só sai com confirmação explícita
// (`force`), pra não virar spam.

const MS_PER_HOUR = 60 * 60 * 1000;

// Segura a mensagem por 12h se o aparelho estiver offline; depois disso o
// aviso já perdeu a graça (as vagas boas já foram).
const OPENING_DELIVERY: PushDeliveryOptions = {
  TTL: 12 * 60 * 60,
  urgency: "normal",
  // Mesmo topic em todo disparo: um aparelho offline que receberia dois
  // avisos de turmas abertas recebe só o mais recente. base64url pelo mesmo
  // motivo do `enrollmentTopic` (a Apple recusa topic que não decodifica).
  topic: Buffer.from("class-opening").toString("base64url"),
};

export class AlreadyNotifiedTodayError extends Error {
  constructor(public readonly lastNotification: ClassOpeningNotification) {
    super("Já foi enviado um aviso de turmas abertas hoje");
    this.name = "AlreadyNotifiedTodayError";
  }
}

export class NoUpcomingClassSessionsError extends Error {
  constructor(message = "Não há turmas por acontecer nesse dia") {
    super(message);
    this.name = "NoUpcomingClassSessionsError";
  }
}

// Instante da meia-noite de hoje no horário de Brasília.
function startOfTodayInBrazil(now: Date): Date {
  const nowInBrazil = new Date(
    now.getTime() - BRAZIL_UTC_OFFSET_HOURS * MS_PER_HOUR,
  );
  return new Date(
    Date.UTC(
      nowInBrazil.getUTCFullYear(),
      nowInBrazil.getUTCMonth(),
      nowInBrazil.getUTCDate(),
    ) +
      BRAZIL_UTC_OFFSET_HOURS * MS_PER_HOUR,
  );
}

// Último aviso de turmas abertas disparado hoje (Brasília), qualquer que
// seja o dia das turmas anunciadas — o limite é de spam no celular do aluno.
export function getLastOpeningNotificationToday(
  now: Date = new Date(),
): Promise<ClassOpeningNotification | null> {
  return prisma.classOpeningNotification.findFirst({
    where: { sentAt: { gte: startOfTodayInBrazil(now) } },
    orderBy: { sentAt: "desc" },
  });
}

/**
 * Avisa todos os aparelhos que as turmas de `classDate` estão abertas.
 * Sem `force`, recusa se já houve aviso hoje (`AlreadyNotifiedTodayError`).
 * Só anuncia dia com pelo menos uma turma que ainda não terminou.
 */
export async function notifyClassesOpened(
  classDate: Date,
  { force }: { force: boolean },
): Promise<ClassOpeningNotification> {
  if (!isPushConfigured()) throw new PushNotConfiguredError();

  const classSessions = await prisma.classSession.findMany({
    where: { date: classDate },
    select: { date: true, startTime: true, endTime: true },
  });
  if (!classSessions.some(session => !hasClassSessionEnded(session))) {
    throw new NoUpcomingClassSessionsError();
  }

  if (!force) {
    const last = await getLastOpeningNotificationToday();
    if (last) throw new AlreadyNotifiedTodayError(last);
  }

  const { sent } = await sendPushNotification(
    {
      title: "Turmas abertas!",
      body: `As inscrições para as aulas de ${describeClassDay(classDate)} estão abertas. Garanta sua vaga!`,
      url: "/",
    },
    {},
    OPENING_DELIVERY,
  );

  return prisma.classOpeningNotification.create({
    data: { classDate, devicesNotified: sent },
  });
}
