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
// Fixado explicitamente na assinatura e na verificação: um token com outro
// `alg` no cabeçalho é recusado em vez de aceito pelo que ele mesmo declara.
const JWT_ALGORITHM = "HS256";

const DAY_MS = 24 * 60 * 60 * 1000;

const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

// Longo de propósito pro aluno: o app instalado no celular não deve pedir
// login de novo toda semana. Cada renovação emite um refresh novo, então
// quem abre o app pelo menos uma vez dentro do prazo nunca precisa logar de
// novo. Admin tem prazo menor — a sessão dele pode mexer em turmas e
// comprovantes, então um aparelho esquecido logado expira antes.
const REFRESH_TTL_MS_BY_ROLE: Record<UserRole, number> = {
  STUDENT: 90 * DAY_MS,
  ADMIN: 30 * DAY_MS,
};

// Janela em que o refresh token da rotação anterior ainda é aceito (ver
// `refreshSession`).
const REFRESH_REUSE_GRACE_MS = 10 * 1000;

// Comparação sem diferenciar maiúsculas: o e-mail do Google já é salvo em
// minúsculas (ver google-auth.ts).
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
);

export const ACCESS_COOKIE_NAME = "access_token";
export const ACCESS_COOKIE_MAX_AGE_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

// Path restrito a /api/auth: esse cookie só precisa ir pro backend nas
// chamadas de /refresh e /logout, nunca nas demais rotas (que só olham o
// access token) — reduz a exposição dele a cada requisição. A validade do
// cookie acompanha a do token, que depende do papel (ver
// `SessionTokens.refreshMaxAgeMs`).
export const REFRESH_COOKIE_NAME = "refresh_token";
export const REFRESH_COOKIE_PATH = "/api/auth";

// Cookies do login antigo de usuário/senha. Ninguém mais os emite, mas um
// navegador que logou antes da troca pro Google ainda pode tê-los — o
// logout limpa pra não ficarem pendurados.
export const LEGACY_COOKIES = [
  { name: "admin_token", path: "/" },
  { name: "admin_refresh_token", path: "/api/auth" },
] as const;

// `sid` é o id do registro em `Session` (o aparelho/navegador); `jti` é o
// id deste token específico, rotacionado a cada renovação.
export type SessionTokenPayload = {
  sub: number;
  role: UserRole;
  jti: string;
  sid: string;
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
  refreshMaxAgeMs: number;
};

// Formato devolvido ao front por /auth/refresh, /auth/me e
// PATCH /users/me.
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

// Mudança de papel é rara e sensível (quem vira admin passa a mexer em
// turmas e comprovantes) — fica no log pra dar pra conferir depois.
function logRoleChange(email: string, from: UserRole | null, to: UserRole) {
  if (from === to) return;
  console.log(
    `[auth] papel de ${email}: ${from ?? "(conta nova)"} → ${to} (ADMIN_EMAILS)`,
  );
}

// Primeiro login cria a conta; os seguintes atualizam só o que vem do
// Google (e-mail, foto) e o papel — recalculado a cada login a partir de
// `ADMIN_EMAILS`, então tirar um e-mail da lista rebaixa o admin no próximo
// login (ou na próxima renovação, ver `refreshSession`). `name` nunca é
// sobrescrito depois de criado: o usuário pode editá-lo no perfil.
export async function upsertUserFromGoogle(profile: GoogleProfile) {
  const role = roleForEmail(profile.email);
  const existing = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
    select: { role: true },
  });

  const user = await prisma.user.upsert({
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

  if (role === "ADMIN" || existing?.role === "ADMIN") {
    logRoleChange(user.email, existing?.role ?? null, role);
  }

  return user;
}

function signSessionToken(
  payload: SessionTokenPayload,
  ttlSeconds: number,
): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: ttlSeconds,
  });
}

export function verifySessionToken(token: string): SessionTokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  }) as unknown as SessionTokenPayload;
}

// Verifica a assinatura ignorando expiração — usado só no logout, pra
// conseguir identificar a sessão de um token já vencido (access ou refresh)
// e apagá-la mesmo assim.
export function decodeSessionTokenIgnoringExpiry(
  token: string,
): SessionTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      ignoreExpiration: true,
    }) as unknown as SessionTokenPayload;
  } catch {
    return null;
  }
}

function signSessionPair(
  user: { id: number; role: UserRole },
  session: { id: string; accessJti: string; refreshJti: string },
): SessionTokens {
  const refreshMaxAgeMs = REFRESH_TTL_MS_BY_ROLE[user.role];
  const base = { sub: user.id, role: user.role, sid: session.id };

  return {
    accessToken: signSessionToken(
      { ...base, jti: session.accessJti, type: "access" },
      ACCESS_TOKEN_TTL_SECONDS,
    ),
    refreshToken: signSessionToken(
      { ...base, jti: session.refreshJti, type: "refresh" },
      refreshMaxAgeMs / 1000,
    ),
    refreshMaxAgeMs,
  };
}

// Cada login cria um registro em `Session` (um por aparelho/navegador) com
// o `jti` vigente de cada token do par. Em vez de só conferir
// assinatura/validade do JWT (que continuaria válido até expirar), cada uso
// confere se o `jti` do token ainda é o gravado naquela sessão — é isso que
// permite revogar antes de expirar. Login num aparelho não mexe nas sessões
// dos outros; refresh rotaciona os dois `jti` só da própria sessão; logout
// apaga só a própria sessão.
//
// O `jti` é guardado puro, sem hash: sozinho ele não serve pra nada — pra
// virar um token aceito precisa ser assinado com `JWT_SECRET`, que não
// está no banco.
export async function issueSession(user: {
  id: number;
  role: UserRole;
}): Promise<SessionTokens> {
  const session = {
    id: crypto.randomUUID(),
    accessJti: crypto.randomUUID(),
    refreshJti: crypto.randomUUID(),
  };

  // Aproveita o login pra varrer as sessões vencidas desse usuário — sem
  // isso a tabela só cresceria com aparelhos que nunca mais voltaram.
  await prisma.$transaction([
    prisma.session.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    }),
    prisma.session.create({
      data: {
        ...session,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS_BY_ROLE[user.role]),
      },
    }),
  ]);

  return signSessionPair(user, session);
}

// Renova a sessão a partir do refresh token: confere assinatura, validade
// e que o `jti` ainda é o vigente naquela sessão, e então emite um par
// access+refresh novo — o que já invalida os dois tokens anteriores dessa
// sessão (as outras sessões do usuário não são afetadas).
//
// O papel é **recalculado** aqui a partir de `ADMIN_EMAILS` (e gravado se
// mudou), não copiado do token antigo — senão um admin tirado da lista
// continuaria admin enquanto renovasse a sessão, sem nunca logar de novo.
//
// A rotação é um compare-and-swap: o `updateMany` só troca os `jti` se o
// refresh apresentado ainda for o vigente, então duas renovações
// simultâneas com o mesmo token não rotacionam duas vezes. A perdedora (ou
// um aparelho cuja resposta da renovação se perdeu — PWA do iOS voltando do
// segundo plano no meio da requisição) chega com o refresh da rotação
// anterior: dentro de `REFRESH_REUSE_GRACE_MS` ela recebe o par vigente
// reassinado (mesmos `jti`, nada é rotacionado de novo). Qualquer outro
// refresh que não seja o vigente (o anterior fora da janela, ou um mais
// velho) é tratado como reuso de token — sinal de que alguém pode ter
// copiado o refresh — e **apaga a sessão** inteira: o dono legítimo
// precisa logar de novo, mas quem copiou também perde o acesso.
export async function refreshSession(
  refreshToken: string,
): Promise<SessionTokens & { user: User }> {
  let payload: SessionTokenPayload;

  try {
    payload = verifySessionToken(refreshToken);
  } catch {
    throw new InvalidSessionError();
  }

  if (payload.type !== "refresh" || !payload.sid) {
    throw new InvalidSessionError();
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });

  if (
    !session ||
    session.userId !== payload.sub ||
    session.expiresAt < new Date()
  ) {
    throw new InvalidSessionError();
  }

  const user = await syncRole(session.user);

  if (session.refreshJti !== payload.jti) {
    const isRecentRotation =
      session.previousRefreshJti === payload.jti &&
      Date.now() - session.lastUsedAt.getTime() < REFRESH_REUSE_GRACE_MS;

    if (!isRecentRotation) {
      await revokeSession(session.id);
      throw new InvalidSessionError();
    }
    // A validade (`expiresAt`) já foi conferida acima, antes de qualquer
    // ramo: o par reassinado nunca estende uma sessão vencida.
    return { ...signSessionPair(user, session), user };
  }

  const rotated = {
    id: session.id,
    accessJti: crypto.randomUUID(),
    refreshJti: crypto.randomUUID(),
  };

  const { count } = await prisma.session.updateMany({
    where: { id: session.id, refreshJti: payload.jti },
    data: {
      accessJti: rotated.accessJti,
      refreshJti: rotated.refreshJti,
      previousRefreshJti: payload.jti,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS_BY_ROLE[user.role]),
    },
  });

  if (count !== 1) {
    // Outra renovação com o mesmo token ganhou a corrida entre a leitura e
    // o update: o par vigente agora é o dela.
    const current = await prisma.session.findUnique({
      where: { id: session.id },
    });
    if (!current || current.previousRefreshJti !== payload.jti) {
      if (current) await revokeSession(current.id);
      throw new InvalidSessionError();
    }
    return { ...signSessionPair(user, current), user };
  }

  return { ...signSessionPair(user, rotated), user };
}

async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

async function syncRole(user: User): Promise<User> {
  const role = roleForEmail(user.email);
  if (role === user.role) return user;

  logRoleChange(user.email, user.role, role);
  return prisma.user.update({ where: { id: user.id }, data: { role } });
}

// Apaga só a sessão do token apresentado (este aparelho/navegador). O
// filtro por `userId` é redundante com a assinatura do token, mas garante
// que nunca se apaga sessão de outro usuário.
export async function invalidateSession(
  payload: SessionTokenPayload,
): Promise<void> {
  if (!payload.sid) return;

  await prisma.session.deleteMany({
    where: { id: payload.sid, userId: payload.sub },
  });
}

// Busca pela PK da sessão (`sid`) a cada requisição protegida.
export async function isSessionActive(
  payload: SessionTokenPayload,
): Promise<boolean> {
  if (payload.type !== "access" || !payload.sid) return false;

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { userId: true, accessJti: true },
  });
  return session?.userId === payload.sub && session.accessJti === payload.jti;
}
