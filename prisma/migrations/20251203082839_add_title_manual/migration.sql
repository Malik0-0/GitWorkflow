/*
  Warnings:

  - You are about to drop the column `mood` on the `Entry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "mood",
ADD COLUMN     "categoryManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dateManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dayDate" TIMESTAMP(3),
ADD COLUMN     "moodLabel" TEXT,
ADD COLUMN     "moodManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moodScore" DOUBLE PRECISION,
ADD COLUMN     "titleManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekIndex" INTEGER;

-- CreateTable
CREATE TABLE "WeeklyInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "summaryText" TEXT,
    "encouragingMessage" TEXT,
    "moodStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyInsight_userId_idx" ON "WeeklyInsight"("userId");

-- CreateIndex
CREATE INDEX "WeeklyInsight_weekIndex_idx" ON "WeeklyInsight"("weekIndex");

-- CreateIndex
CREATE INDEX "Entry_weekIndex_idx" ON "Entry"("weekIndex");

-- CreateIndex
CREATE INDEX "Entry_dayDate_idx" ON "Entry"("dayDate");

-- AddForeignKey
ALTER TABLE "WeeklyInsight" ADD CONSTRAINT "WeeklyInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
