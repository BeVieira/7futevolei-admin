-- Tira o e-mail em texto de vez (ver src/lib/email-crypto.ts). Trava de
-- segurança: se alguma conta ainda não foi convertida pelo script da
-- migration anterior, aborta antes de apagar qualquer coisa — o
-- `migrate deploy` falha e o deploy não sobe, em vez de perder o e-mail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "email" IS NOT NULL
       OR "emailHash" IS NULL
       OR "emailEncrypted" IS NULL
  ) THEN
    RAISE EXCEPTION 'Há contas sem e-mail convertido pra hash/criptografado; rode a conversão antes de remover a coluna "email".';
  END IF;
END $$;

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
ALTER COLUMN "emailHash" SET NOT NULL,
ALTER COLUMN "emailEncrypted" SET NOT NULL;
