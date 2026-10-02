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
import { prisma } from "../lib/prisma";
import {
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

async function startSessionFromGoogle(res: Response, credential: string) {
  const profile = await verifyGoogleCredential(credential);
  const user = await upsertUserFromGoogle(profile);

  const tokens = await issueSession(user);
  setSessionCookies(res, tokens);

  return user;
}

export async function loginWithGoogle(req: Request, res: Response) {
  const result = googleLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const user = await startSessionFromGoogle(res, result.data.credential);
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

// Fim do fluxo de redirect do Google Identity Services (`ux_mode:
// "redirect"`, usado pelo front — ver apps/frontend/ARCHITECTURE.md): o
// Google faz um POST de formulário pra cá com o `credential`, e a resposta é
// uma navegação de página inteira, não um fetch. Por isso nada de JSON: o
// resultado volta pro front como redirect 303 (vira GET) pra `/login`, com
// `?status=ok` ou `?erro=<código>`. O caminho é relativo de propósito — em
// produção a requisição chega pelo rewrite da Vercel, e o navegador resolve
// o redirect na origem do front, onde os cookies acabaram de ser gravados.
//
// `g_csrf_token` é o double-submit do Google: a biblioteca grava o mesmo
// valor num cookie da nossa origem e no corpo do POST. Um formulário forjado
// por outro site não consegue ler nem gravar esse cookie, então os dois
// precisam bater — senão alguém poderia logar a vítima na conta dele.
export async function loginWithGoogleRedirect(req: Request, res: Response) {
  const result = googleRedirectLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.redirect(303, "/login?erro=credencial");
    return;
  }

  const csrfCookie = req.cookies?.g_csrf_token;
  if (!csrfCookie || csrfCookie !== result.data.g_csrf_token) {
    res.redirect(303, "/login?erro=csrf");
    return;
  }

  try {
    await startSessionFromGoogle(res, result.data.credential);
    res.redirect(303, "/login?status=ok");
  } catch (error) {
    const failure = toLoginFailure(error);
    if (failure) {
      res.redirect(303, `/login?erro=${failure.code}`);
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
