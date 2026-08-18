import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

export class InvalidCredentialsError extends Error {
  constructor(message = "Usuário ou senha inválidos") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

function readJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }
  return secret;
}

const JWT_SECRET: string = readJwtSecret();
const TOKEN_TTL = "5m";

export const ADMIN_COOKIE_NAME = "admin_token";
export const ADMIN_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

export type AdminTokenPayload = {
  sub: number;
  username: string;
  jti: string;
};

export async function verifyAdminCredentials(
  username: string,
  password: string,
) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  return user;
}

function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as AdminTokenPayload;
}

// Verifica a assinatura ignorando expiração — usado só no logout, pra
// conseguir identificar o dono de um token já vencido e limpar a sessão
// dele mesmo assim.
function decodeAdminTokenIgnoringExpiry(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true,
    }) as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

// `currentJti` no `User` torna o token de fato revogável: em vez de só
// conferir a assinatura/validade do JWT (que continuaria válido até
// expirar mesmo após logout), cada requisição autenticada confere se o
// `jti` do token ainda é o mais recente emitido pra esse usuário. Login
// gera um `jti` novo (invalidando qualquer sessão anterior); logout limpa
// esse campo.
export async function issueAdminSession(user: {
  id: number;
  username: string;
}): Promise<string> {
  const jti = crypto.randomUUID();

  await prisma.user.update({
    where: { id: user.id },
    data: { currentJti: jti },
  });

  return signAdminToken({ sub: user.id, username: user.username, jti });
}

export async function invalidateAdminSessionFromToken(
  token: string,
): Promise<void> {
  const payload = decodeAdminTokenIgnoringExpiry(token);
  if (!payload) return;

  await prisma.user
    .update({ where: { id: payload.sub }, data: { currentJti: null } })
    .catch(() => {});
}

export async function isAdminSessionActive(
  payload: AdminTokenPayload,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  return user?.currentJti === payload.jti;
}
