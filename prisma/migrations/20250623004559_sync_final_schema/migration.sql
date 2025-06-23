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


ALTER TYPE "StreamStatus" ADD VALUE 'PAUSED';
ALTER TYPE "StreamStatus" ADD VALUE 'STARTING';
ALTER TYPE "StreamStatus" ADD VALUE 'ENDING';
ALTER TYPE "StreamStatus" ADD VALUE 'FAILED_TO_START';
ALTER TYPE "StreamStatus" ADD VALUE 'INTERRUPTED';

-- AlterTable
ALTER TABLE "LiveStream" DROP COLUMN "status",
ADD COLUMN     "status" "StreamStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "_RewardRecipients" ADD CONSTRAINT "_RewardRecipients_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_RewardRecipients_AB_unique";

-- AlterTable
ALTER TABLE "_StreamViewers" ADD CONSTRAINT "_StreamViewers_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_StreamViewers_AB_unique";

-- AlterTable
ALTER TABLE "_UserConversations" ADD CONSTRAINT "_UserConversations_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserConversations_AB_unique";

-- CreateTable
CREATE TABLE "LiveStreamProduct" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "liveStreamId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isAuctionMode" BOOLEAN NOT NULL DEFAULT true,
    "auctionDuration" INTEGER,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winningBidId" TEXT,
    "isSold" BOOLEAN NOT NULL DEFAULT false,
    "soldAt" TIMESTAMP(3),
    "soldPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStreamProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStreamBid" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "userId" TEXT NOT NULL,
    "liveStreamProductId" TEXT NOT NULL,
    "isWinning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStreamBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveStreamProduct_winningBidId_key" ON "LiveStreamProduct"("winningBidId");

-- CreateIndex
CREATE INDEX "LiveStreamProduct_liveStreamId_idx" ON "LiveStreamProduct"("liveStreamId");

-- CreateIndex
CREATE INDEX "LiveStreamProduct_isActive_idx" ON "LiveStreamProduct"("isActive");

-- CreateIndex
CREATE INDEX "LiveStreamBid_liveStreamProductId_idx" ON "LiveStreamBid"("liveStreamProductId");

-- CreateIndex
CREATE INDEX "LiveStreamBid_userId_idx" ON "LiveStreamBid"("userId");

-- AddForeignKey
ALTER TABLE "LiveStreamProduct" ADD CONSTRAINT "LiveStreamProduct_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamProduct" ADD CONSTRAINT "LiveStreamProduct_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "LiveStreamBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamBid" ADD CONSTRAINT "LiveStreamBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamBid" ADD CONSTRAINT "LiveStreamBid_liveStreamProductId_fkey" FOREIGN KEY ("liveStreamProductId") REFERENCES "LiveStreamProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
