import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { User, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { GoogleProfile } from "./google-auth";

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
// Longo de propósito: o app instalado no celular não deve pedir login de
// novo toda semana. Cada renovação emite um refresh novo, então quem abre o
// app pelo menos uma vez a cada 90 dias nunca precisa logar de novo.
const REFRESH_TOKEN_TTL = "90d";

// Comparação sem diferenciar maiúsculas: o e-mail do Google já é salvo em
// minúsculas (ver google-auth.ts).
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
);

export const ACCESS_COOKIE_NAME = "access_token";
export const ACCESS_COOKIE_MAX_AGE_MS = 5 * 60 * 1000;

// Path restrito a /api/auth: esse cookie só precisa ir pro backend nas
// chamadas de /refresh e /logout, nunca nas demais rotas (que só olham o
// access token) — reduz a exposição dele a cada requisição.
export const REFRESH_COOKIE_NAME = "refresh_token";
export const REFRESH_COOKIE_PATH = "/api/auth";
export const REFRESH_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type SessionTokenPayload = {
  sub: number;
  role: UserRole;
  jti: string;
  type: "access" | "refresh";
};

// O que os middlewares de autenticação deixam em `res.locals.user`.
export type SessionUser = {
  id: number;
  role: UserRole;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

// Formato devolvido ao front por /auth/google, /auth/refresh e /auth/me.
export type UserProfile = Pick<
  User,
  "id" | "name" | "email" | "photoUrl" | "role"
>;

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl,
    role: user.role,
  };
}

function roleForEmail(email: string): UserRole {
  return ADMIN_EMAILS.has(email.toLowerCase()) ? "ADMIN" : "STUDENT";
}

// Primeiro login cria a conta; os seguintes atualizam só o que vem do
// Google (e-mail, foto) e o papel — recalculado a cada login a partir de
// `ADMIN_EMAILS`, então tirar um e-mail da lista rebaixa o admin no próximo
// login. `name` nunca é sobrescrito depois de criado: o usuário pode
// editá-lo no perfil.
export function upsertUserFromGoogle(profile: GoogleProfile) {
  const role = roleForEmail(profile.email);

  return prisma.user.upsert({
    where: { googleId: profile.googleId },
    create: {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      photoUrl: profile.photoUrl,
      role,
    },
    update: { email: profile.email, photoUrl: profile.photoUrl, role },
  });
}

function signSessionToken(
  payload: SessionTokenPayload,
  ttl: typeof ACCESS_TOKEN_TTL | typeof REFRESH_TOKEN_TTL,
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ttl });
}

export function verifySessionToken(token: string): SessionTokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as SessionTokenPayload;
}

// Verifica a assinatura ignorando expiração — usado só no logout, pra
// conseguir identificar o dono de um token já vencido (access ou refresh)
// e limpar a sessão dele mesmo assim.
export function decodeSessionTokenIgnoringExpiry(
  token: string,
): SessionTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true,
    }) as unknown as SessionTokenPayload;
  } catch {
    return null;
  }
}

// `currentJti`/`currentRefreshJti` no `User` tornam os tokens de fato
// revogáveis: em vez de só conferir assinatura/validade do JWT (que
// continuaria válido até expirar), cada uso confere se o `jti` do token
// ainda é o mais recente emitido pra esse usuário. Login e refresh geram
// um par novo (invalidando o par anterior); logout zera os dois campos.
// Consequência: uma sessão por usuário — logar num aparelho derruba a
// sessão do outro.
export async function issueSession(user: {
  id: number;
  role: UserRole;
}): Promise<SessionTokens> {
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();

  await prisma.user.update({
    where: { id: user.id },
    data: { currentJti: accessJti, currentRefreshJti: refreshJti },
  });

  return {
    accessToken: signSessionToken(
      { sub: user.id, role: user.role, jti: accessJti, type: "access" },
      ACCESS_TOKEN_TTL,
    ),
    refreshToken: signSessionToken(
      { sub: user.id, role: user.role, jti: refreshJti, type: "refresh" },
      REFRESH_TOKEN_TTL,
    ),
  };
}

// Renova a sessão a partir do refresh token: confere assinatura, validade
// e que o `jti` ainda é o vigente, e então emite um par access+refresh
// novo — o que já invalida os dois tokens anteriores (o `jti` antigo de
// cada um deixa de bater com o que fica gravado no usuário). O papel do
// token novo vem do banco, não do token antigo.
export async function refreshSession(
  refreshToken: string,
): Promise<SessionTokens & { user: User }> {
  let payload: SessionTokenPayload;

  try {
    payload = verifySessionToken(refreshToken);
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

  const tokens = await issueSession(user);
  return { ...tokens, user };
}

export async function invalidateSession(userId: number): Promise<void> {
  await prisma.user
    .update({
      where: { id: userId },
      data: { currentJti: null, currentRefreshJti: null },
    })
    .catch(() => {});
}

export async function isSessionActive(
  payload: SessionTokenPayload,
): Promise<boolean> {
  if (payload.type !== "access") return false;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  return user?.currentJti === payload.jti;
}
