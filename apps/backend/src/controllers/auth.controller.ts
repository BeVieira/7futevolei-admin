import { Request, Response } from "express";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE_MS,
  ADMIN_REFRESH_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_MAX_AGE_MS,
  ADMIN_REFRESH_COOKIE_PATH,
  AdminSessionTokens,
  InvalidCredentialsError,
  InvalidSessionError,
  decodeAdminTokenIgnoringExpiry,
  invalidateAdminSession,
  issueAdminSession,
  refreshAdminSession,
  verifyAdminCredentials,
} from "../lib/auth-service";
import { loginSchema } from "../schemas/auth.schema";

function setSessionCookies(res: Response, tokens: AdminSessionTokens) {
  const secure = process.env.NODE_ENV === "production";

  res.cookie(ADMIN_COOKIE_NAME, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: ADMIN_COOKIE_MAX_AGE_MS,
    path: "/",
  });

  res.cookie(ADMIN_REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: ADMIN_REFRESH_COOKIE_MAX_AGE_MS,
    path: ADMIN_REFRESH_COOKIE_PATH,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
  res.clearCookie(ADMIN_REFRESH_COOKIE_NAME, { path: ADMIN_REFRESH_COOKIE_PATH });
}

export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const user = await verifyAdminCredentials(
      result.data.username,
      result.data.password,
    );

    const tokens = await issueAdminSession(user);
    setSessionCookies(res, tokens);

    res.json({ username: user.username });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  try {
    const { username, ...tokens } = await refreshAdminSession(token);
    setSessionCookies(res, tokens);
    res.json({ username });
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
  const accessToken = req.cookies?.[ADMIN_COOKIE_NAME];
  const refreshToken = req.cookies?.[ADMIN_REFRESH_COOKIE_NAME];

  const payload =
    (accessToken && decodeAdminTokenIgnoringExpiry(accessToken)) ||
    (refreshToken && decodeAdminTokenIgnoringExpiry(refreshToken)) ||
    null;

  if (payload) {
    await invalidateAdminSession(payload.sub);
  }

  clearSessionCookies(res);
  res.status(204).send();
}

export function me(_req: Request, res: Response) {
  res.json({ username: res.locals.admin.username });
}
