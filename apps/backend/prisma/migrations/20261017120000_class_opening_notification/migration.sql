-- CreateTable
CREATE TABLE "ClassOpeningNotification" (
    "id" SERIAL NOT NULL,
    "classDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "devicesNotified" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClassOpeningNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassOpeningNotification_sentAt_idx" ON "ClassOpeningNotification"("sentAt");
