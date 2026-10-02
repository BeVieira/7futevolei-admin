-- Logins com Google em andamento (nonce do fluxo de redirect + resgate do
-- login confirmado por outro navegador). Ver LoginNonce no schema.

-- CreateTable
CREATE TABLE "LoginNonce" (
    "nonce" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE INDEX "LoginNonce_expiresAt_idx" ON "LoginNonce"("expiresAt");

-- AddForeignKey
ALTER TABLE "LoginNonce" ADD CONSTRAINT "LoginNonce_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

