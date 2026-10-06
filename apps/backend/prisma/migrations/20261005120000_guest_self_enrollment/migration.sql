-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "guestCancelTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_guestCancelTokenHash_key" ON "Enrollment"("guestCancelTokenHash");
