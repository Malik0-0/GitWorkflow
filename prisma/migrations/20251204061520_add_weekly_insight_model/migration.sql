/*
  Warnings:

  - You are about to drop the column `encouragingMessage` on the `WeeklyInsight` table. All the data in the column will be lost.
  - You are about to drop the column `moodStats` on the `WeeklyInsight` table. All the data in the column will be lost.
  - You are about to drop the column `summaryText` on the `WeeklyInsight` table. All the data in the column will be lost.
  - You are about to drop the column `weekIndex` on the `WeeklyInsight` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,weekStart]` on the table `WeeklyInsight` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `content` to the `WeeklyInsight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekEnd` to the `WeeklyInsight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekStart` to the `WeeklyInsight` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "WeeklyInsight_userId_idx";

-- DropIndex
DROP INDEX "WeeklyInsight_weekIndex_idx";

-- AlterTable
ALTER TABLE "WeeklyInsight" DROP COLUMN "encouragingMessage",
DROP COLUMN "moodStats",
DROP COLUMN "summaryText",
DROP COLUMN "weekIndex",
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "shortSummary" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "weekEnd" TEXT NOT NULL,
ADD COLUMN     "weekStart" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyInsight_userId_weekStart_key" ON "WeeklyInsight"("userId", "weekStart");
