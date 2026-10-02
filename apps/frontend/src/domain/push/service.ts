import { pushApi } from "./api";
import { PushStatus } from "./types";

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
async function enable(studentName?: string): Promise<void> {
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

  await pushApi.subscribe(subscription.toJSON(), studentName);
}

async function disable(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  await pushApi.unsubscribe(subscription.endpoint);
  await subscription.unsubscribe();
}

// Reenvia a inscrição já existente com o nome atual do aluno — mantém o
// vínculo aparelho→aluno em dia quando ele troca o nome em "Minhas Aulas".
async function syncStudentName(studentName: string): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  await pushApi.subscribe(subscription.toJSON(), studentName);
}

export const pushService = {
  getStatus,
  enable,
  disable,
  syncStudentName,
};
