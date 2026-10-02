/// <reference lib="webworker" />

// Service worker só de notificações push — de propósito sem handler de
// `fetch` nem cache (ver comentário em vite.config.ts).
declare let self: ServiceWorkerGlobalScope;

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// Assume o controle assim que instalado: uma versão nova do sw.ts entra em
// vigor no próximo carregamento, sem esperar todas as abas fecharem.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  const payload: PushPayload = event.data
    ? event.data.json()
    : { title: "7Futevôlei", body: "" };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192x192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

// Tocar na notificação: reaproveita uma aba/janela do app já aberta (indo
// pra rota da notificação) em vez de abrir outra.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin)
    .href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(windows => {
        const existing = windows.find(client =>
          client.url.startsWith(self.location.origin),
        );
        if (existing) {
          return existing.navigate(url).then(client => client?.focus());
        }
        return self.clients.openWindow(url);
      }),
  );
});

export {};
