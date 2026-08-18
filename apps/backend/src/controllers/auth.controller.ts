import { Request, Response } from "express";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE_MS,
  InvalidCredentialsError,
  invalidateAdminSessionFromToken,
  issueAdminSession,
  verifyAdminCredentials,
} from "../lib/auth-service";
import { loginSchema } from "../schemas/auth.schema";

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

    const token = await issueAdminSession(user);

    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ADMIN_COOKIE_MAX_AGE_MS,
      path: "/",
    });

    res.json({ username: user.username });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];

  if (token) {
    await invalidateAdminSessionFromToken(token);
  }

  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
  res.status(204).send();
}

export function me(_req: Request, res: Response) {
  res.json({ username: res.locals.admin.username });
}
