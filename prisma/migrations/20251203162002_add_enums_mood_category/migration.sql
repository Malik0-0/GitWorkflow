/*
  Warnings:

  - The `category` column on the `Entry` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `moodLabel` column on the `Entry` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MoodLabel" AS ENUM ('joyful', 'happy', 'calm', 'neutral', 'tired', 'sad', 'anxious', 'stressed', 'frustrated', 'angry');

-- CreateEnum
CREATE TYPE "CategoryLabel" AS ENUM ('personal', 'relationships', 'health', 'habits', 'work', 'study', 'creativity', 'goals', 'reflection', 'finance', 'daily', 'other');

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "category",
ADD COLUMN     "category" "CategoryLabel",
DROP COLUMN "moodLabel",
ADD COLUMN     "moodLabel" "MoodLabel";
