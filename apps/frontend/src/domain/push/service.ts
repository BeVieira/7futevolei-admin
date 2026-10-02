import { pushApi } from "./api";
import { PushStatus } from "./types";

const INVITE_DISMISSED_KEY = "7futevolei:push-invite-dismissed";

function isSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iPadOS se identifica como Mac no user agent; o toque denuncia.
function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// `getRegistration` em vez de `serviceWorker.ready`: se o service worker
// não registrou (ex: falha de rede no primeiro acesso), `ready` nunca
// resolve e a tela ficaria presa em "carregando".
async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

async function getStatus(): Promise<PushStatus> {
  if (!isSupported()) {
    return isIos() && !isInstalled() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";

  const subscription = await getCurrentSubscription();
  return subscription ? "enabled" : "disabled";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

// `requestPermission` tem que ser a primeira coisa assíncrona depois do
// clique: o Safari/iOS só mostra o pedido de permissão se ele vier direto
// de um gesto do usuário, e um `await` antes (ex: buscar a chave pública)
// já quebra esse vínculo.
async function enable(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão para notificações não concedida");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const { publicKey } = await pushApi.getPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await pushApi.subscribe(subscription.toJSON());
  // Já decidiu: o convite pós-inscrição não precisa mais aparecer.
  dismissInvite();
}

// Também chamado no logout, antes de derrubar a sessão. A inscrição do
// navegador é desfeita mesmo se o backend falhar: o endpoint morto passa a
// responder 410 pro servidor, que apaga o registro no próximo envio — o
// aparelho nunca continua recebendo avisos da conta que saiu.
async function disable(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  try {
    await pushApi.unsubscribe(subscription.endpoint);
  } finally {
    await subscription.unsubscribe();
  }
}

// Reenvia a inscrição que o navegador já tem pro usuário da sessão atual: o
// upsert por endpoint no backend reatribui o aparelho a quem está logado
// (ex: outra pessoa entrou no aparelho sem o logout anterior ter rodado).
// Sem inscrição ou sem permissão, não faz nada.
async function syncSubscription(): Promise<boolean> {
  if (!isSupported() || Notification.permission !== "granted") return false;

  const subscription = await getCurrentSubscription();
  if (!subscription) return false;

  await pushApi.subscribe(subscription.toJSON());
  return true;
}

// Convite "quer ser avisado?" mostrado depois de se inscrever numa aula.
// Dispensado ou ativado uma vez, não volta neste aparelho. `localStorage`
// pode lançar (modo privado/bloqueado) — aí o convite só volta a aparecer.
function isInviteDismissed(): boolean {
  try {
    return localStorage.getItem(INVITE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissInvite() {
  try {
    localStorage.setItem(INVITE_DISMISSED_KEY, "1");
  } catch {
    // Sem storage o convite volta na próxima visita; nada a fazer.
  }
}

export const pushService = {
  getStatus,
  enable,
  disable,
  syncSubscription,
  isInviteDismissed,
  dismissInvite,
};
