import { API_BASE_URL, apiFetch, handleResponse } from "@utils";
import { Me } from "./types";

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

// Endereço pra onde o Google posta o resultado do login no fluxo de
// redirect (ver `renderGoogleSignInButton` no service). Absoluto porque o
// Google exige URL completa, e na origem do front porque é nela que os
// cookies de sessão precisam ficar — em produção o rewrite da Vercel
// repassa pro backend.
function getGoogleLoginCallbackUrl(): string {
  return new URL(`${BASE_URL}/google/callback`, window.location.origin).href;
}

export const authApi = { getMe, logout, getGoogleLoginCallbackUrl };
