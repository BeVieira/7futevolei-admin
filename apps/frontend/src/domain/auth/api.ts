import { API_BASE_URL, apiFetch, handleResponse } from "@utils";
import { GoogleLoginAttempt, GoogleLoginClaim, Me } from "./types";

const BASE_URL = `${API_BASE_URL}/auth`;

// 401 depois da tentativa de renovação do `apiFetch` = ninguém logado, não
// um erro: devolve `null` pra quem chama distinguir "deslogado" de "falhou".
function getMe(): Promise<Me | null> {
  return apiFetch(`${BASE_URL}/me`).then(res =>
    res.status === 401 ? null : handleResponse<Me>(res),
  );
}

function logout(): Promise<void> {
  return fetch(`${BASE_URL}/logout`, {
    method: "POST",
    credentials: "include",
  }).then(res => handleResponse(res));
}

function createGoogleLoginAttempt(): Promise<GoogleLoginAttempt> {
  return fetch(`${BASE_URL}/google/nonce`, {
    method: "POST",
    credentials: "include",
  }).then(res => handleResponse(res));
}

// 409 = o Google ainda não devolveu essa tentativa; 401 = vencida/usada.
async function claimGoogleLogin(secret: string): Promise<GoogleLoginClaim> {
  const res = await fetch(`${BASE_URL}/google/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
    credentials: "include",
  });
  if (res.status === 409) return { status: "pending" };
  if (res.status === 401) return { status: "invalid" };
  return { status: "logged-in", me: await handleResponse<Me>(res) };
}

// Endereço pra onde o Google posta o resultado do login no fluxo de
// redirect (ver `renderGoogleSignInButton` no service). Fixo na origem do
// front — de propósito **não** derivado de `VITE_API_URL`: é nessa origem
// que os cookies de sessão precisam ser gravados (em produção o rewrite da
// Vercel repassa pro backend), e é essa URL exata que fica cadastrada no
// console do Google.
function getGoogleLoginCallbackUrl(): string {
  return `${window.location.origin}/api/auth/google/callback`;
}

export const authApi = {
  getMe,
  logout,
  createGoogleLoginAttempt,
  claimGoogleLogin,
  getGoogleLoginCallbackUrl,
};
