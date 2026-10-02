import crypto from "node:crypto";
import { prisma } from "./prisma";

// Proteção do fluxo de redirect do login com Google (ver
// apps/backend/ARCHITECTURE.md, "Login com Google").
//
// Cada tentativa de login começa com um **segredo** aleatório gerado aqui.
// O aparelho guarda o segredo (cookie httpOnly `login_nonce` + localStorage
// do app) e manda pro Google só o **hash** dele, como `nonce` do ID token.
// No callback, o `nonce` que volta dentro do ID token (assinado pelo
// Google) precisa ser um que nós emitimos, ainda válido e não usado:
//
// - com o cookie presente e batendo (mesmo navegador que pediu), o callback
//   já abre a sessão ali;
// - sem o cookie (o redirect voltou num navegador com outro pote de cookies
//   — o caso suspeito do app instalado no iPhone), o callback só marca o
//   login como confirmado por `CLAIM_TTL_MS`, e o app que guardou o segredo
//   resgata a sessão com `POST /auth/google/claim`.
//
// Um formulário forjado por outro site não passa: o ID token dele teria um
// `nonce` que não está na tabela ou cujo segredo a vítima não tem.

export class InvalidLoginNonceError extends Error {
  constructor(
    message = "A tentativa de login expirou ou já foi usada. Tente de novo.",
  ) {
    super(message);
    this.name = "InvalidLoginNonceError";
  }
}

export class LoginNotConfirmedError extends Error {
  constructor(message = "Login ainda não confirmado") {
    super(message);
    this.name = "LoginNotConfirmedError";
  }
}

export const LOGIN_NONCE_COOKIE_NAME = "login_nonce";
// Só as rotas /api/auth/google/* precisam do cookie.
export const LOGIN_NONCE_COOKIE_PATH = "/api/auth/google";

// Tempo pra clicar no botão e passar pela tela do Google. O front pede um
// nonce novo antes disso vencer (ver `useLoadGoogleSignIn`).
export const LOGIN_NONCE_TTL_MS = 10 * 60 * 1000;

// Depois de o callback validar o ID token, por quanto tempo o login pode
// ser resgatado pelo segredo. Curto de propósito: nessa janela o segredo
// vale uma sessão.
const CLAIM_TTL_MS = 2 * 60 * 1000;

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("base64url");
}

export async function createLoginNonce(): Promise<{
  secret: string;
  nonce: string;
}> {
  const secret = crypto.randomBytes(32).toString("base64url");
  const nonce = hashSecret(secret);

  // Aproveita pra varrer as tentativas vencidas — ninguém mais as usa.
  await prisma.$transaction([
    prisma.loginNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.loginNonce.create({
      data: { nonce, expiresAt: new Date(Date.now() + LOGIN_NONCE_TTL_MS) },
    }),
  ]);

  return { secret, nonce };
}

// Confere que o `nonce` do ID token é uma tentativa nossa, válida e ainda
// não usada nem confirmada, e devolve-o. Não consome — quem chama decide
// como (abrir a sessão ali ou deixar pra resgate).
export async function assertLoginNonceIsPending(
  nonce: string | null,
): Promise<string> {
  if (!nonce) throw new InvalidLoginNonceError();

  const row = await prisma.loginNonce.findUnique({ where: { nonce } });
  if (!row || row.userId !== null || row.expiresAt < new Date()) {
    throw new InvalidLoginNonceError();
  }
  return nonce;
}

export function secretMatchesNonce(
  secret: string | undefined,
  nonce: string,
): boolean {
  if (!secret) return false;
  const a = Buffer.from(hashSecret(secret));
  const b = Buffer.from(nonce);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Mesmo navegador: a sessão abre no próprio callback, então a tentativa é
// apagada (uso único). `count` 0 = outra requisição com o mesmo token
// chegou antes.
export async function consumeLoginNonce(nonce: string): Promise<void> {
  const { count } = await prisma.loginNonce.deleteMany({
    where: { nonce, userId: null, expiresAt: { gt: new Date() } },
  });
  if (count !== 1) throw new InvalidLoginNonceError();
}

// Outro navegador: marca a tentativa como confirmada pra `userId`, por
// `CLAIM_TTL_MS`. Condicionado a `userId: null` pra um mesmo nonce nunca
// ser confirmado duas vezes.
export async function confirmLoginNonceForClaim(
  nonce: string,
  userId: number,
): Promise<void> {
  const { count } = await prisma.loginNonce.updateMany({
    where: { nonce, userId: null, expiresAt: { gt: new Date() } },
    data: { userId, expiresAt: new Date(Date.now() + CLAIM_TTL_MS) },
  });
  if (count !== 1) throw new InvalidLoginNonceError();
}

// Resgate pelo app que guardou o segredo: só um login já confirmado pelo
// callback (ID token validado), dentro da janela, uma vez só — a linha é
// apagada no mesmo passo. Devolve o usuário pra abrir a sessão.
export async function claimLoginNonce(secret: string): Promise<number> {
  const nonce = hashSecret(secret);
  const row = await prisma.loginNonce.findUnique({ where: { nonce } });

  if (!row || row.expiresAt < new Date()) {
    throw new InvalidLoginNonceError();
  }
  if (row.userId === null) throw new LoginNotConfirmedError();

  const { count } = await prisma.loginNonce.deleteMany({
    where: { nonce, userId: row.userId, expiresAt: { gt: new Date() } },
  });
  if (count !== 1) throw new InvalidLoginNonceError();

  return row.userId;
}
