-- Tentativas de login com Google em andamento (nonce do fluxo de
-- redirect). Ver LoginNonce no schema.

-- CreateTable
CREATE TABLE "LoginNonce" (
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE INDEX "LoginNonce_expiresAt_idx" ON "LoginNonce"("expiresAt");

