import { createHash, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";

// Rotas de job (`/api/jobs/*`) não têm usuário: quem chama é o cron externo,
// autenticado por `Authorization: Bearer <CRON_SECRET>`. Sem CRON_SECRET no
// ambiente as rotas respondem 503 (mesmo padrão do push sem VAPID) — nunca
// ficam abertas por falta de configuração.
const cronSecret = process.env.CRON_SECRET ?? "";

// Compara os hashes em vez das strings: `timingSafeEqual` exige o mesmo
// tamanho, e o hash iguala isso sem vazar o tamanho do segredo pelo tempo de
// resposta.
function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function requireCronSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!cronSecret) {
    res
      .status(503)
      .json({ error: "Jobs não configurados no servidor (CRON_SECRET)" });
    return;
  }

  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";

  if (!timingSafeEqual(digest(token), digest(cronSecret))) {
    res.status(401).json({ error: "Segredo do job inválido" });
    return;
  }

  next();
}
