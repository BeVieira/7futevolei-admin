import { Request, Response } from "express";
import {
  ACCESS_COOKIE_MAX_AGE_MS,
  ACCESS_COOKIE_NAME,
  InvalidSessionError,
  REFRESH_COOKIE_MAX_AGE_MS,
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
import { googleLoginSchema } from "../schemas/auth.schema";

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
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export async function loginWithGoogle(req: Request, res: Response) {
  const result = googleLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const profile = await verifyGoogleCredential(result.data.credential);
    const user = await upsertUserFromGoogle(profile);

    const tokens = await issueSession(user);
    setSessionCookies(res, tokens);

    res.json(toUserProfile(user));
  } catch (error) {
    if (error instanceof InvalidGoogleCredentialError) {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error instanceof GoogleLoginNotConfiguredError) {
      res.status(503).json({ error: error.message });
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
    await invalidateSession(payload.sub);
  }

  clearSessionCookies(res);
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
