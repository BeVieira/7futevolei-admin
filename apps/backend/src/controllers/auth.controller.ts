import { Request, Response } from "express";
import { Prisma, UserRole } from "@prisma/client";
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
  LoginNotConfirmedError,
  assertLoginNonceIsPending,
  claimLoginNonce,
  confirmLoginNonceForClaim,
  consumeLoginNonce,
  createLoginNonce,
  secretMatchesNonce,
} from "../lib/login-nonce";
import { prisma } from "../lib/prisma";
import {
  claimGoogleLoginSchema,
  googleLoginSchema,
  googleRedirectLoginSchema,
} from "../schemas/auth.schema";

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

// Erros do login com Google que viram uma resposta específica (o resto
// segue pro error handler global, 500). Compartilhado pelo login via JSON e
// pelo callback do fluxo de redirect, que respondem de jeitos diferentes.
type LoginFailure = { status: number; code: string; message: string };

function toLoginFailure(error: unknown): LoginFailure | null {
  if (error instanceof InvalidGoogleCredentialError) {
    return { status: 401, code: "credencial", message: error.message };
  }
  if (error instanceof GoogleLoginNotConfiguredError) {
    return { status: 503, code: "configuracao", message: error.message };
  }
  if (error instanceof InvalidLoginNonceError) {
    return { status: 401, code: "tentativa-expirada", message: error.message };
  }
  // Único campo único que o upsert por `googleId` pode violar é o e-mail:
  // outra conta Google (outro `googleId`) com o mesmo e-mail já cadastrado.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      status: 409,
      code: "email-em-uso",
      message: "Este e-mail já está vinculado a outra conta Google",
    };
  }
  return null;
}

async function startSession(
  res: Response,
  user: { id: number; role: UserRole },
) {
  const tokens = await issueSession(user);
  setSessionCookies(res, tokens);
}

export async function loginWithGoogle(req: Request, res: Response) {
  const result = googleLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const { profile } = await verifyGoogleCredential(result.data.credential);
    const user = await upsertUserFromGoogle(profile);
    await startSession(res, user);
    res.json(toUserProfile(user));
  } catch (error) {
    const failure = toLoginFailure(error);
    if (failure) {
      res.status(failure.status).json({ error: failure.message });
      return;
    }
    throw error;
  }
}

// Começo do fluxo de redirect: cria uma tentativa de login (ver
// lib/login-nonce.ts), grava o segredo no cookie `login_nonce` e devolve o
// segredo (pro app guardar e poder resgatar o login) e o `nonce` (o hash,
// que o front passa pro Google). O cookie é `SameSite=None; Secure` porque
// precisa voltar no POST que o Google faz pro callback — uma navegação
// cross-site, em que cookie `Lax` não é enviado. `Secure` vale também em
// http://localhost no Chrome e no Firefox; onde o navegador recusar (Safari
// em localhost), o cookie não chega e o login segue pelo resgate.
export async function createGoogleLoginNonce(_req: Request, res: Response) {
  const { secret, nonce } = await createLoginNonce();

  res.cookie(LOGIN_NONCE_COOKIE_NAME, secret, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: LOGIN_NONCE_TTL_MS,
    path: LOGIN_NONCE_COOKIE_PATH,
  });
  res.json({ nonce, secret });
}

function clearLoginNonceCookie(res: Response) {
  res.clearCookie(LOGIN_NONCE_COOKIE_NAME, {
    path: LOGIN_NONCE_COOKIE_PATH,
    sameSite: "none",
    secure: true,
  });
}

// Fim do fluxo de redirect do Google Identity Services (`ux_mode:
// "redirect"`, usado pelo front — ver apps/frontend/ARCHITECTURE.md): o
// Google faz um POST de formulário pra cá com o `credential`, e a resposta é
// uma navegação de página inteira, não um fetch. Por isso nada de JSON: o
// resultado volta pro front como redirect 303 (vira GET) pra `/login`. O
// caminho é relativo de propósito — em produção a requisição chega pelo
// rewrite da Vercel, e o navegador resolve o redirect na origem do front.
//
// O `nonce` do ID token precisa ser uma tentativa nossa, pendente:
// - cookie `login_nonce` presente e batendo → mesmo navegador que pediu: a
//   sessão abre aqui e volta `?status=ok`;
// - sem o cookie → o redirect voltou em outro navegador (ver
//   login-nonce.ts): nada de cookie de sessão aqui; o login fica
//   confirmado pra resgate e volta `?status=confirmado`.
export async function loginWithGoogleRedirect(req: Request, res: Response) {
  const result = googleRedirectLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.redirect(303, "/login?erro=credencial");
    return;
  }

  try {
    const verified = await verifyGoogleCredential(result.data.credential);
    const nonce = await assertLoginNonceIsPending(verified.nonce);
    const { profile } = verified;
    const user = await upsertUserFromGoogle(profile);

    const secret = req.cookies?.[LOGIN_NONCE_COOKIE_NAME];
    clearLoginNonceCookie(res);

    if (secretMatchesNonce(secret, nonce)) {
      await consumeLoginNonce(nonce);
      await startSession(res, user);
      res.redirect(303, "/login?status=ok");
      return;
    }

    await confirmLoginNonceForClaim(nonce, user.id);
    res.redirect(303, "/login?status=confirmado");
  } catch (error) {
    const failure = toLoginFailure(error);
    if (failure) {
      res.redirect(303, `/login?erro=${failure.code}`);
      return;
    }
    throw error;
  }
}

// Resgate do login confirmado em outro navegador: quem tem o segredo da
// tentativa (o app que a pediu) recebe os cookies de sessão no próprio pote
// de cookies. 409 = o Google ainda não devolveu (o app tenta de novo depois);
// 401 = tentativa inexistente, vencida ou já usada.
export async function claimGoogleLogin(req: Request, res: Response) {
  const result = claimGoogleLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const userId = await claimLoginNonce(result.data.secret);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await startSession(res, user);
    clearLoginNonceCookie(res);
    res.json(toUserProfile(user));
  } catch (error) {
    if (error instanceof LoginNotConfirmedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof InvalidLoginNonceError) {
      res.status(401).json({ error: error.message });
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
