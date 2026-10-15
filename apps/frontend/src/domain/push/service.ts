import { installService } from "@domain/install/service";
import { pushApi } from "./api";
import { PushStatus } from "./types";

const INVITE_DISMISSED_KEY = "7futevolei:push-invite-dismissed";
const SUBSCRIPTION_OWNER_KEY = "7futevolei:push-subscription-owner";

function isSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
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
    return installService.isIos() && !installService.isInstalled()
      ? "needs-install"
      : "unsupported";
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

async function createSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const { publicKey } = await pushApi.getPublicKey();
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
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
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    try {
      await pushApi.subscribe(existing.toJSON());
    } catch {
      // O backend recusa (409) um endpoint já gravado com outras chaves, e
      // uma inscrição antiga pode estar quebrada de outros jeitos: em vez de
      // insistir nela, desfaz e cria uma nova (endpoint novo) uma vez.
      await existing.unsubscribe();
      await pushApi.subscribe(
        (await createSubscription(registration)).toJSON(),
      );
    }
  } else {
    await pushApi.subscribe((await createSubscription(registration)).toJSON());
  }

  // O dono gravado no backend agora é quem está logado, mas o front não
  // sabe o id aqui — esquece o dono local pra próxima sincronização
  // conferir (e gravar) de novo.
  forgetSubscriptionOwner();
  // Já decidiu: o convite pós-inscrição não precisa mais aparecer.
  dismissInvite();
}

// Também chamado no logout, antes de derrubar a sessão. Desativar é desfazer
// a inscrição **do navegador**: depois disso o endpoint morre, o serviço de
// push passa a responder 410 e o backend apaga o registro no próximo envio.
// Por isso a falha do aviso ao backend é engolida — o aparelho já parou de
// receber de qualquer jeito; só uma falha do próprio navegador é erro.
async function disable(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  await pushApi.unsubscribe(subscription.endpoint).catch(() => {});
  forgetSubscriptionOwner();
  await subscription.unsubscribe();
}

// Último usuário pra quem este aparelho mandou a inscrição — evita reenviar
// a cada carregamento do app; só reenvia quando a conta logada muda.
function readSubscriptionOwner(): string | null {
  try {
    return localStorage.getItem(SUBSCRIPTION_OWNER_KEY);
  } catch {
    return null;
  }
}

function writeSubscriptionOwner(userId: number) {
  try {
    localStorage.setItem(SUBSCRIPTION_OWNER_KEY, String(userId));
  } catch {
    // Sem storage só reenvia de novo no próximo carregamento.
  }
}

function forgetSubscriptionOwner() {
  try {
    localStorage.removeItem(SUBSCRIPTION_OWNER_KEY);
  } catch {
    // Idem.
  }
}

// Reenvia a inscrição que o navegador já tem quando a conta logada não é a
// última pra quem este aparelho mandou: o backend reatribui o aparelho (o
// endpoint é o mesmo e as chaves batem). Ex: outra pessoa entrou no
// aparelho sem o logout anterior ter rodado. Sem inscrição ou sem
// permissão, não faz nada.
async function syncSubscription(userId: number): Promise<boolean> {
  if (readSubscriptionOwner() === String(userId)) return false;
  if (!isSupported() || Notification.permission !== "granted") return false;

  const subscription = await getCurrentSubscription();
  if (!subscription) return false;

  await pushApi.subscribe(subscription.toJSON());
  writeSubscriptionOwner(userId);
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
