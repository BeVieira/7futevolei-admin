import webpush, { WebPushError } from "web-push";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class PushNotConfiguredError extends Error {
  constructor(message = "Notificações push não configuradas no servidor") {
    super(message);
    this.name = "PushNotConfiguredError";
  }
}

export type PushPayload = {
  title: string;
  body: string;
  // Rota do front aberta ao tocar na notificação (ex: "/minhas-aulas").
  url?: string;
};

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "";
const isConfigured = Boolean(publicKey && privateKey && subject);

if (isConfigured) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function getVapidPublicKey(): string {
  if (!isConfigured) throw new PushNotConfiguredError();
  return publicKey;
}

// Upsert por endpoint: o mesmo aparelho reativando (ou trocando de nome)
// atualiza o registro em vez de duplicar. `studentName` undefined não mexe
// no nome já salvo — o admin ativando no mesmo aparelho de um aluno não
// apaga o vínculo com o aluno.
export function saveSubscription(
  subscription: SubscriptionInput,
  studentName: string | undefined,
) {
  const data = {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    ...(studentName !== undefined && { studentName }),
  };

  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { endpoint: subscription.endpoint, ...data },
    update: data,
  });
}

export async function removeSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// Envia pra todos os aparelhos que batem com `where` (sem filtro = todos).
// Inscrições que o serviço de push do navegador responde como inexistentes
// (404/410 — permissão revogada, app desinstalado) são apagadas na hora,
// pra não acumular lixo nem tentar de novo a cada envio.
export async function sendPushNotification(
  payload: PushPayload,
  where: Prisma.PushSubscriptionWhereInput = {},
) {
  if (!isConfigured) throw new PushNotConfiguredError();

  const subscriptions = await prisma.pushSubscription.findMany({ where });
  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      ),
    ),
  );

  const expiredIds: number[] = [];
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") return;

    const error = result.reason;
    if (
      error instanceof WebPushError &&
      (error.statusCode === 404 || error.statusCode === 410)
    ) {
      expiredIds.push(subscriptions[index].id);
    } else {
      failed++;
      console.error("Falha ao enviar push:", error);
    }
  });

  if (expiredIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: expiredIds } },
    });
  }

  return {
    sent: subscriptions.length - expiredIds.length - failed,
    failed,
    removed: expiredIds.length,
  };
}
