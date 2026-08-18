let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Chamadas administrativas devem usar isso em vez de `fetch` direto: um
// 401 (access token de 5min expirado) tenta renovar a sessão pelo refresh
// token uma vez e repete a requisição original, em vez de estourar erro no
// meio de uma ação. Chamadas concorrentes compartilham a mesma renovação —
// nunca duas em paralelo, já que renovar troca (invalida) o par anterior de
// tokens, e uma segunda renovação com o refresh token já trocado falharia.
export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession();
  return refreshed ? fetch(url, init) : response;
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
