import webpush, { RequestOptions, WebPushError } from "web-push";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export class PushNotConfiguredError extends Error {
  constructor(message = "Notificações push não configuradas no servidor") {
    super(message);
    this.name = "PushNotConfiguredError";
  }
}

export class PushSubscriptionConflictError extends Error {
  constructor(
    message = "Este aparelho já está inscrito com outras chaves. Ative as notificações de novo.",
  ) {
    super(message);
    this.name = "PushSubscriptionConflictError";
  }
}

export type PushPayload = {
  title: string;
  body: string;
  // Rota do front aberta ao tocar na notificação (ex: "/minhas-aulas").
  url?: string;
};

// Entrega no serviço de push: por quanto tempo segurar a mensagem se o
// aparelho estiver offline (`TTL`, em segundos), prioridade (`urgency`) e
// `topic` — mensagens pendentes com o mesmo topic são substituídas pela
// mais nova (ex: "promovido" seguido de "removido" entrega só o último).
export type PushDeliveryOptions = Pick<
  RequestOptions,
  "TTL" | "urgency" | "topic"
>;

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

export function isPushConfigured(): boolean {
  return isConfigured;
}

export function getVapidPublicKey(): string {
  if (!isConfigured) throw new PushNotConfiguredError();
  return publicKey;
}

// Um registro por endpoint. O mesmo navegador reativando (ou outra pessoa
// logando no mesmo aparelho) reatribui o aparelho ao usuário logado — mas
// só se `p256dh`/`auth` baterem com os gravados. `auth` é um segredo que só
// o navegador inscrito tem; sem essa conferência, quem descobrisse o
// endpoint de outra pessoa poderia "sequestrar" o aparelho dela pra própria
// conta. Chaves diferentes no mesmo endpoint não acontecem num navegador
// normal (re-inscrever gera endpoint novo), então são recusadas sem mexer
// no registro: o front desfaz a inscrição local e cria uma nova.
export async function saveSubscription(
  subscription: SubscriptionInput,
  userId: number,
) {
  const { endpoint, keys } = subscription;
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
  });

  if (!existing) {
    await prisma.pushSubscription.create({
      data: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId },
    });
    return;
  }

  if (existing.p256dh !== keys.p256dh || existing.auth !== keys.auth) {
    throw new PushSubscriptionConflictError();
  }

  if (existing.userId !== userId) {
    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { userId },
    });
  }
}

export async function removeSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// Envia pra todos os aparelhos que batem com `where` (sem filtro = todos —
// notificação de um aluno específico filtra por `{ userId }`).
// Inscrições que o serviço de push do navegador responde como inexistentes
// (404/410 — permissão revogada, app desinstalado) são apagadas na hora,
// pra não acumular lixo nem tentar de novo a cada envio.
export async function sendPushNotification(
  payload: PushPayload,
  where: Prisma.PushSubscriptionWhereInput = {},
  options: PushDeliveryOptions = {},
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
        options,
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
