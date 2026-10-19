-- O e-mail passa a ser guardado só como HMAC (comparação) + AES-GCM
-- (exibição) — ver src/lib/email-crypto.ts. Os dois precisam de chaves
-- que não podem ficar numa migration: as contas existentes são
-- convertidas pelo script
-- src/scripts/hash-user-emails.ts, e a coluna "email" sai depois.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailHash" TEXT,
ADD COLUMN     "emailEncrypted" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");
