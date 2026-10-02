-- Login passa a ser só com Google, e inscrição/push passam a apontar pro
-- `User` em vez de um nome digitado. O plano é recriar o banco (`prisma
-- migrate reset`), mas a migration também roda num banco com dados: o admin
-- de usuário/senha e os aparelhos de push (sem dono possível) são
-- descartados, e as inscrições antigas viram inscrições de convidado com o
-- mesmo nome.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- Descarta o que não tem como ser migrado
DELETE FROM "PushSubscription";
DELETE FROM "User";

-- DropIndex
DROP INDEX "User_username_key";

-- DropIndex
DROP INDEX "PushSubscription_studentName_idx";

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "receiptReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "userId" INTEGER;

UPDATE "Enrollment" SET "guestName" = "studentName";

ALTER TABLE "Enrollment" DROP COLUMN "studentName";

-- Exatamente um de `userId`/`guestName` (o enrollment-service também garante)
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_user_or_guest_check" CHECK (("userId" IS NULL) <> ("guestName" IS NULL));

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash",
DROP COLUMN "username",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "googleId" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "studentName",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_classSessionId_userId_key" ON "Enrollment"("classSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
