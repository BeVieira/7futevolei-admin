import { NextFunction, Request, Response } from "express";
import {
  ACCESS_COOKIE_NAME,
  SessionUser,
  isSessionActive,
  verifySessionToken,
} from "./auth-service";

// Lê o access token do cookie, confere assinatura/validade e que o `jti`
// ainda é o vigente no banco. Devolve o usuário da sessão, ou `null` depois
// de já ter respondido 401.
async function authenticate(
  req: Request,
  res: Response,
): Promise<SessionUser | null> {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }

  try {
    const payload = verifySessionToken(token);

    if (!(await isSessionActive(payload))) {
      res.status(401).json({ error: "Sessão inválida ou expirada" });
      return null;
    }

    return { id: payload.sub, role: payload.role };
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return null;
  }
}

// Qualquer usuário logado (aluno ou admin).
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = await authenticate(req, res);
  if (!user) return;

  res.locals.user = user;
  next();
}

// Só admin: 401 sem sessão, 403 com sessão de aluno. O papel vem do token
// (recalculado a cada login/refresh), não de uma consulta extra ao banco.
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = await authenticate(req, res);
  if (!user) return;

  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Acesso restrito ao admin" });
    return;
  }

  res.locals.user = user;
  next();
}
