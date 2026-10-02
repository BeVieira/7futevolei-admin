import { prisma } from "./prisma";
import { computeClassSessionEnd } from "./class-session-lock";
import { receiptReminderPayload } from "./enrollment-notifications";
import {
  PushNotConfiguredError,
  isPushConfigured,
  sendPushNotification,
} from "./push-service";

// Só lembra de aula que terminou nas últimas 24h. Cobre o cron das 7:05 a
// 10:05 (e uma aula que termine depois do último disparo é pega na manhã
// seguinte), mas nunca dispara cobrança de aula de semanas atrás — ex: no
// primeiro deploy, ou com o job desligado por um tempo.
const REMINDER_WINDOW_HOURS = 24;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type ReceiptReminderResult = {
  // Inscrições marcadas como lembradas nesta execução.
  reminded: number;
  // Aparelhos que receberam o push (um aluno pode ter vários, ou nenhum).
  devicesNotified: number;
};

/**
 * Lembrete de cobrança: avisa cada inscrito **confirmado** (com conta — não
 * convidado) que ainda não enviou comprovante, uma vez, depois que a aula
 * termina. Idempotente: pode rodar quantas vezes quiser (cron externo,
 * intervalo local, execuções sobrepostas) que cada inscrição é lembrada no
 * máximo uma vez, via `receiptReminderSentAt`.
 *
 * A inscrição é marcada mesmo se o aluno não tiver nenhum aparelho com push
 * ativo: o lembrete é "do fim da aula" — quem ativar as notificações depois
 * não deve receber de uma vez a cobrança de aulas antigas.
 */
export async function sendReceiptReminders(
  now: Date = new Date(),
): Promise<ReceiptReminderResult> {
  // Sem push configurado nada é marcado — senão as inscrições seriam dadas
  // como lembradas sem ninguém ter sido avisado.
  if (!isPushConfigured()) throw new PushNotConfiguredError();

  const windowStart = new Date(
    now.getTime() - REMINDER_WINDOW_HOURS * MS_PER_HOUR,
  );

  // Filtro grosso por `date` (meia-noite UTC do dia no Brasil) no banco; o
  // instante exato de fim (`date` + `endTime` em Brasília) é conferido logo
  // abaixo. Dois dias de folga cobrem o deslocamento de fuso e a aula que
  // termina depois da meia-noite.
  const candidates = await prisma.enrollment.findMany({
    where: {
      status: "CONFIRMED",
      userId: { not: null },
      receipt: { is: null },
      receiptReminderSentAt: null,
      classSession: {
        date: {
          gte: new Date(windowStart.getTime() - 2 * MS_PER_DAY),
          lte: now,
        },
      },
    },
    include: { classSession: true },
  });

  const due = candidates.filter(enrollment => {
    const end = computeClassSessionEnd(enrollment.classSession);
    return end > windowStart && end <= now;
  });

  let reminded = 0;
  let devicesNotified = 0;

  for (const enrollment of due) {
    // "Reserva" a inscrição antes de enviar: com duas execuções ao mesmo
    // tempo, só a que conseguir marcar (count === 1) avisa. Repete os
    // filtros pra não lembrar quem enviou o comprovante nesse meio-tempo.
    const { count } = await prisma.enrollment.updateMany({
      where: {
        id: enrollment.id,
        status: "CONFIRMED",
        receipt: { is: null },
        receiptReminderSentAt: null,
      },
      data: { receiptReminderSentAt: now },
    });
    if (count === 0 || enrollment.userId === null) continue;

    reminded++;
    try {
      const { sent } = await sendPushNotification(
        receiptReminderPayload(enrollment.classSession),
        { userId: enrollment.userId },
      );
      devicesNotified += sent;
    } catch (error) {
      // Best-effort: uma falha não impede os demais lembretes; a inscrição
      // continua marcada (não insiste no mesmo aluno a cada execução).
      console.error("Falha ao enviar lembrete de comprovante:", error);
    }
  }

  return { reminded, devicesNotified };
}

// Dev local: roda a mesma checagem da rota a cada
// `RECEIPT_REMINDER_INTERVAL_MS`, sem precisar de cron externo. Desligado
// por padrão (variável vazia/0) — em produção quem chama é o cron-job.org.
export function startReceiptReminderInterval() {
  const intervalMs = Number(process.env.RECEIPT_REMINDER_INTERVAL_MS ?? 0);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

  if (!isPushConfigured()) {
    console.warn(
      "RECEIPT_REMINDER_INTERVAL_MS definido, mas push não está configurado (VAPID_*) — lembretes de comprovante desligados.",
    );
    return;
  }

  setInterval(() => {
    sendReceiptReminders()
      .then(result => {
        if (result.reminded > 0) {
          console.log("Lembretes de comprovante enviados:", result);
        }
      })
      .catch(error => {
        console.error("Falha no job de lembrete de comprovante:", error);
      });
  }, intervalMs);

  console.log(
    `Lembrete de comprovante rodando a cada ${intervalMs}ms (RECEIPT_REMINDER_INTERVAL_MS)`,
  );
}
