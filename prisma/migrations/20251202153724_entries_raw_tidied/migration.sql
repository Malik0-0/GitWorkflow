/*
  Warnings:

  - You are about to drop the column `content` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `tidied` on the `Entry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "content",
DROP COLUMN "tidied",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "contentRaw" TEXT,
ADD COLUMN     "contentTidied" TEXT,
ADD COLUMN     "tidiedAt" TIMESTAMP(3),
ADD COLUMN     "titleRaw" TEXT,
ADD COLUMN     "titleTidied" TEXT;
