import { NextFunction, Request, Response } from "express";
import {
  ADMIN_COOKIE_NAME,
  isAdminSessionActive,
  verifyAdminToken,
} from "./auth-service";

export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  try {
    const payload = verifyAdminToken(token);

    if (!(await isAdminSessionActive(payload))) {
      res.status(401).json({ error: "Sessão inválida ou expirada" });
      return;
    }

    res.locals.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}
