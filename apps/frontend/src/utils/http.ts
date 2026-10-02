// "/api" em dev (proxy do Vite) e em produção (rewrite da Vercel pro
// Render) — sempre mesma origem do ponto de vista do navegador, que é o que
// mantém os cookies de sessão first-party.
export const API_BASE_URL = import.meta.env.VITE_API_URL;

type RefreshOutcome = "renewed" | "expired" | "failed";

let refreshPromise: Promise<RefreshOutcome> | null = null;

// Quem quer saber quando a sessão acabou de vez (o refresh respondeu 401):
// o domínio `auth` registra um ouvinte que zera o usuário em cache, pra as
// rotas protegidas mandarem pro login (ver `useClearSessionOnExpiry`). Falha
// de rede não conta — a sessão pode estar ótima.
const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res): RefreshOutcome => {
        if (res.ok) return "renewed";
        return res.status === 401 ? "expired" : "failed";
      })
      .catch((): RefreshOutcome => "failed")
      .then(outcome => {
        if (outcome === "expired") {
          sessionExpiredListeners.forEach(listener => listener());
        }
        return outcome;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Toda chamada à API usa isso em vez de `fetch` direto: um 401 (access
// token de 5min expirado) tenta renovar a sessão pelo refresh token uma vez
// e repete a requisição original, em vez de estourar erro no meio de uma
// ação. Chamadas concorrentes desta aba compartilham a mesma renovação
// (single-flight) — renovar troca o par de tokens, então não faz sentido
// disparar várias. Entre abas diferentes (que não compartilham esta
// promise) o backend tolera por alguns segundos o refresh da rotação
// anterior, então uma aba renovando logo depois da outra não perde a
// sessão.
//
// `credentials: "include"` explícito: com o front chamando `/api` na
// própria origem (proxy do Vite, rewrite da Vercel) o padrão do `fetch` já
// mandaria os cookies, mas deixar explícito mantém a sessão funcionando se
// um dia a API for chamada de outra origem.
export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, { ...init, credentials: "include" });

  if (response.status !== 401) {
    return response;
  }

  const outcome = await refreshSession();
  return outcome === "renewed"
    ? fetch(url, { ...init, credentials: "include" })
    : response;
}

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      typeof body?.error === "string"
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
