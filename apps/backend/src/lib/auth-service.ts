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

export class InvalidSessionError extends Error {
  constructor(message = "Sessão inválida ou expirada") {
    super(message);
    this.name = "InvalidSessionError";
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
const ACCESS_TOKEN_TTL = "5m";
const REFRESH_TOKEN_TTL = "7d";

export const ADMIN_COOKIE_NAME = "admin_token";
export const ADMIN_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

// Path restrito a /api/auth: esse cookie só precisa ir pro backend nas
// chamadas de /refresh e /logout, nunca nas demais rotas administrativas
// (que só olham o access token) — reduz a exposição dele a cada requisição.
export const ADMIN_REFRESH_COOKIE_NAME = "admin_refresh_token";
export const ADMIN_REFRESH_COOKIE_PATH = "/api/auth";
export const ADMIN_REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type AdminTokenPayload = {
  sub: number;
  username: string;
  jti: string;
  type: "access" | "refresh";
};

export type AdminSessionTokens = {
  accessToken: string;
  refreshToken: string;
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

function signAdminToken(
  payload: AdminTokenPayload,
  ttl: typeof ACCESS_TOKEN_TTL | typeof REFRESH_TOKEN_TTL,
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ttl });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as AdminTokenPayload;
}

// Verifica a assinatura ignorando expiração — usado só no logout, pra
// conseguir identificar o dono de um token já vencido (access ou refresh)
// e limpar a sessão dele mesmo assim.
export function decodeAdminTokenIgnoringExpiry(
  token: string,
): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true,
    }) as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

// `currentJti`/`currentRefreshJti` no `User` tornam os tokens de fato
// revogáveis: em vez de só conferir assinatura/validade do JWT (que
// continuaria válido até expirar), cada uso confere se o `jti` do token
// ainda é o mais recente emitido pra esse usuário. Login e refresh geram
// um par novo (invalidando o par anterior); logout zera os dois campos.
export async function issueAdminSession(user: {
  id: number;
  username: string;
}): Promise<AdminSessionTokens> {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();

  await prisma.user.update({
    where: { id: user.id },
    data: { currentJti: accessJti, currentRefreshJti: refreshJti },
  });

  return {
    accessToken: signAdminToken(
      { sub: user.id, username: user.username, jti: accessJti, type: "access" },
      ACCESS_TOKEN_TTL,
    ),
    refreshToken: signAdminToken(
      { sub: user.id, username: user.username, jti: refreshJti, type: "refresh" },
      REFRESH_TOKEN_TTL,
    ),
  };
}

// Renova a sessão a partir do refresh token: confere assinatura, validade
// e que o `jti` ainda é o vigente, e então emite um par access+refresh
// novo — o que já invalida os dois tokens anteriores (o `jti` antigo de
// cada um deixa de bater com o que fica gravado no usuário).
export async function refreshAdminSession(
  refreshToken: string,
): Promise<AdminSessionTokens & { username: string }> {
  let payload: AdminTokenPayload;

  try {
    payload = verifyAdminToken(refreshToken);
  } catch {
    throw new InvalidSessionError();
  }

  if (payload.type !== "refresh") {
    throw new InvalidSessionError();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user || user.currentRefreshJti !== payload.jti) {
    throw new InvalidSessionError();
  }

  const tokens = await issueAdminSession(user);
  return { ...tokens, username: user.username };
}

export async function invalidateAdminSession(userId: number): Promise<void> {
  await prisma.user
    .update({
      where: { id: userId },
      data: { currentJti: null, currentRefreshJti: null },
    })
    .catch(() => {});
}

export async function isAdminSessionActive(
  payload: AdminTokenPayload,
): Promise<boolean> {
  if (payload.type !== "access") return false;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  return user?.currentJti === payload.jti;
}
