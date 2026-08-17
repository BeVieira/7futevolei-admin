/*
  Warnings:

  - Added the required column `side` to the `Enrollment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Side" AS ENUM ('LEFT', 'RIGHT');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "side" "Side" NOT NULL;
