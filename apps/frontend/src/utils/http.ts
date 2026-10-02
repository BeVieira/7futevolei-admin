// Em dev, "/api" (proxy do Vite, mesma origem). Em prod, aponta pro backend
// no Render (origem diferente da Vercel) — precisa ser absoluta.
export const API_BASE_URL = import.meta.env.VITE_API_URL;

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(res => res.ok)
      .catch(() => false)
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
// `credentials: "include"` é obrigatório aqui: front (Vercel) e back
// (Render) são origens diferentes, então o navegador só manda os cookies
// de sessão (httpOnly) numa requisição cross-site se isso for pedido
// explicitamente — por padrão ele omite.
export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, { ...init, credentials: "include" });

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession();
  return refreshed ? fetch(url, { ...init, credentials: "include" }) : response;
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
