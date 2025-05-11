/*
  Warnings:

  - The `status` column on the `LiveStream` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StreamStatus" ADD VALUE 'STARTING';
ALTER TYPE "StreamStatus" ADD VALUE 'ENDING';
ALTER TYPE "StreamStatus" ADD VALUE 'FAILED_TO_START';
ALTER TYPE "StreamStatus" ADD VALUE 'INTERRUPTED';

-- AlterTable
ALTER TABLE "LiveStream" DROP COLUMN "status",
ADD COLUMN     "status" "StreamStatus" NOT NULL DEFAULT 'SCHEDULED';
