import crypto from "node:crypto";
import { prisma } from "./prisma";

// Proteção do fluxo de redirect do login com Google (ver
// apps/backend/ARCHITECTURE.md, "Login com Google").
//
// Cada tentativa de login começa com um **segredo** aleatório gerado aqui,
// que só existe no cookie httpOnly `login_nonce` do navegador que pediu. O
// front recebe e manda pro Google só o **hash** dele, como `nonce` do ID
// token. No callback, o `nonce` que volta dentro do ID token (assinado pelo
// Google) precisa ser uma tentativa nossa, ainda válida e não usada, **e**
// o cookie daquele navegador precisa ter o segredo correspondente. Sem o
// cookie, não há login — não existe outro jeito de concluir a tentativa.

export class InvalidLoginNonceError extends Error {
  constructor(
    message = "A tentativa de login expirou ou já foi usada. Tente de novo.",
  ) {
    super(message);
    this.name = "InvalidLoginNonceError";
  }
}

export const LOGIN_NONCE_COOKIE_NAME = "login_nonce";
// Só as rotas /api/auth/google/* precisam do cookie.
export const LOGIN_NONCE_COOKIE_PATH = "/api/auth/google";

// Tempo pra clicar no botão e passar pela tela do Google. O front pede um
// nonce novo antes disso vencer (ver `useLoadGoogleSignIn`).
export const LOGIN_NONCE_TTL_MS = 10 * 60 * 1000;

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

function secretMatchesNonce(secret: string, nonce: string): boolean {
  const a = Buffer.from(hashSecret(secret));
  const b = Buffer.from(nonce);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Confere o `nonce` do ID token contra o segredo do cookie e consome a
// tentativa (uso único): apaga a linha condicionada a ela ainda existir e
// não ter vencido, então duas requisições com o mesmo token não passam.
export async function consumeLoginNonce(
  nonce: string | null,
  secret: string | undefined,
): Promise<void> {
  if (!nonce || !secret || !secretMatchesNonce(secret, nonce)) {
    throw new InvalidLoginNonceError();
  }

  const { count } = await prisma.loginNonce.deleteMany({
    where: { nonce, expiresAt: { gt: new Date() } },
  });
  if (count !== 1) throw new InvalidLoginNonceError();
}
