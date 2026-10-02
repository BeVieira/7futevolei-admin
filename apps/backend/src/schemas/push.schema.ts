import { z } from "zod";

// O backend faz POST no `endpoint` a cada notificação — sem restrição, um
// usuário logado poderia cadastrar uma URL interna (ex: http://localhost,
// metadados da nuvem) e usar o servidor como proxy (SSRF). Só aceita HTTPS
// nos serviços de push dos navegadores:
// - fcm.googleapis.com / android.googleapis.com: Chrome, Edge Android,
//   Samsung Internet, Opera (Firebase Cloud Messaging; android.* é o legado);
// - *.push.apple.com: Safari/iOS (web.push.apple.com);
// - updates.push.services.mozilla.com: Firefox;
// - *.notify.windows.com: Edge no Windows (WNS).
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
];
const PUSH_SERVICE_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

function isPushServiceEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port !== "") return false;
    const host = url.hostname.toLowerCase();
    return (
      PUSH_SERVICE_HOSTS.includes(host) ||
      PUSH_SERVICE_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

export const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().refine(isPushServiceEndpoint, {
      message: "Endpoint de push não reconhecido",
    }),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

// Sem allowlist: só apaga o registro que tiver exatamente esse endpoint, o
// servidor nunca faz requisição pra ele.
export const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
