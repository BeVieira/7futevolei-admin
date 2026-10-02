import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import {
  ACCESS_COOKIE_MAX_AGE_MS,
  ACCESS_COOKIE_NAME,
  InvalidSessionError,
  LEGACY_COOKIES,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  SessionTokens,
  decodeSessionTokenIgnoringExpiry,
  invalidateSession,
  issueSession,
  refreshSession,
  toUserProfile,
  upsertUserFromGoogle,
} from "../lib/auth-service";
import {
  GoogleLoginNotConfiguredError,
  InvalidGoogleCredentialError,
  verifyGoogleCredential,
} from "../lib/google-auth";
import {
  InvalidLoginNonceError,
  LOGIN_NONCE_COOKIE_NAME,
  LOGIN_NONCE_COOKIE_PATH,
  LOGIN_NONCE_TTL_MS,
  consumeLoginNonce,
  createLoginNonce,
} from "../lib/login-nonce";
import { prisma } from "../lib/prisma";
import { googleRedirectLoginSchema } from "../schemas/auth.schema";

function setSessionCookies(res: Response, tokens: SessionTokens) {
  // Front (Vercel) chama a API por um rewrite (`vercel.json`) que proxeia
  // `/api/*` pro backend no Render — do ponto de vista do navegador isso é
  // mesma origem, então o cookie pode ser `SameSite=Lax` de verdade (o
  // Safari/iOS trata cookie `SameSite=None` de requisição cross-site como
  // rastreamento e descarta, o que derrubava a sessão logo após o login).
  const secure = process.env.NODE_ENV === "production";

  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    path: "/",
  });

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: tokens.refreshMaxAgeMs,
    path: REFRESH_COOKIE_PATH,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function clearLegacyCookies(res: Response) {
  for (const cookie of LEGACY_COOKIES) {
    res.clearCookie(cookie.name, { path: cookie.path });
  }
}

// Erros do login com Google que viram um código em `/login?erro=<código>`
// (o resto segue pro error handler global, 500).
function toLoginErrorCode(error: unknown): string | null {
  if (error instanceof InvalidGoogleCredentialError) return "credencial";
  if (error instanceof GoogleLoginNotConfiguredError) return "configuracao";
  if (error instanceof InvalidLoginNonceError) return "tentativa-expirada";
  // Único campo único que o upsert por `googleId` pode violar é o e-mail:
  // outra conta Google (outro `googleId`) com o mesmo e-mail já cadastrado.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "email-em-uso";
  }
  return null;
}

// Começo do fluxo de redirect: cria uma tentativa de login (ver
// lib/login-nonce.ts), grava o segredo no cookie `login_nonce` e devolve
// **só** o `nonce` (o hash), que o front passa pro Google — o segredo nunca
// fica acessível ao JavaScript. O cookie é `SameSite=None; Secure` porque
// precisa voltar no POST que o Google faz pro callback, uma navegação
// cross-site em que cookie `Lax` não é enviado. `Secure` vale também em
// http://localhost no Chrome e no Firefox; o Safari não grava cookie
// `Secure` em http, então nele o login só funciona por HTTPS (túnel).
export async function createGoogleLoginNonce(_req: Request, res: Response) {
  const { secret, nonce } = await createLoginNonce();

  res.cookie(LOGIN_NONCE_COOKIE_NAME, secret, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: LOGIN_NONCE_TTL_MS,
    path: LOGIN_NONCE_COOKIE_PATH,
  });
  res.json({ nonce });
}

function clearLoginNonceCookie(res: Response) {
  res.clearCookie(LOGIN_NONCE_COOKIE_NAME, {
    path: LOGIN_NONCE_COOKIE_PATH,
    sameSite: "none",
    secure: true,
  });
}

// Fim do fluxo de redirect do Google Identity Services (`ux_mode:
// "redirect"`, usado pelo front — ver apps/frontend/ARCHITECTURE.md), e a
// única porta de login: o Google faz um POST de formulário pra cá com o
// `credential`, e a resposta é uma navegação de página inteira, não um
// fetch. Por isso nada de JSON: o resultado volta pro front como redirect
// 303 (vira GET) pra `/login?status=ok` ou `/login?erro=<código>`. O caminho
// é relativo de propósito — em produção a requisição chega pelo rewrite da
// Vercel, e o navegador resolve o redirect na origem do front, onde os
// cookies acabaram de ser gravados.
//
// O `nonce` do ID token precisa bater com o segredo do cookie `login_nonce`
// deste navegador (e ser uma tentativa pendente). Sem o cookie — outro
// navegador, cookie recusado, tentativa vencida — não há sessão.
export async function loginWithGoogleRedirect(req: Request, res: Response) {
  const result = googleRedirectLoginSchema.safeParse(req.body);
  const secret = req.cookies?.[LOGIN_NONCE_COOKIE_NAME];
  clearLoginNonceCookie(res);

  if (!result.success) {
    res.redirect(303, "/login?erro=credencial");
    return;
  }

  try {
    const { profile, nonce } = await verifyGoogleCredential(
      result.data.credential,
    );
    await consumeLoginNonce(nonce, secret);

    const user = await upsertUserFromGoogle(profile);
    const tokens = await issueSession(user);
    setSessionCookies(res, tokens);

    res.redirect(303, "/login?status=ok");
  } catch (error) {
    const code = toLoginErrorCode(error);
    if (code) {
      res.redirect(303, `/login?erro=${code}`);
      return;
    }
    throw error;
  }
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  try {
    const { user, ...tokens } = await refreshSession(token);
    setSessionCookies(res, tokens);
    res.json(toUserProfile(user));
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      clearSessionCookies(res);
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME];
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  const payload =
    (accessToken && decodeSessionTokenIgnoringExpiry(accessToken)) ||
    (refreshToken && decodeSessionTokenIgnoringExpiry(refreshToken)) ||
    null;

  if (payload) {
    await invalidateSession(payload);
  }

  clearSessionCookies(res);
  clearLegacyCookies(res);
  res.status(204).send();
}

export async function me(_req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.user.id },
  });

  if (!user) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return;
  }

  res.json(toUserProfile(user));
}
