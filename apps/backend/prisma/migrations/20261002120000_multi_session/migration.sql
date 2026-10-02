-- Multi-sessão: o par de `jti` vigente sai do `User` (que só permitia uma
-- sessão por conta) e vai pra uma tabela própria, um registro por
-- aparelho/navegador logado. Quem estava logado precisa entrar de novo.
--
-- Também troca o `onDelete` de Enrollment → User de CASCADE pra RESTRICT
-- (ver comentário no schema).

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "currentJti",
DROP COLUMN "currentRefreshJti";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "accessJti" TEXT NOT NULL,
    "refreshJti" TEXT NOT NULL,
    "previousRefreshJti" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

