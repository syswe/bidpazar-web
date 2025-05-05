-- DropForeignKey
ALTER TABLE "Bid" DROP CONSTRAINT "Bid_listingId_fkey";

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "productAuctionId" TEXT,
ALTER COLUMN "listingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StreamHighlight" ADD COLUMN     "likes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StreamModeration" (
    "id" TEXT NOT NULL,
    "liveStreamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamModeration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamAnalytics" (
    "id" TEXT NOT NULL,
    "liveStreamId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "viewerCount" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "bidCount" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "avgWatchTime" INTEGER NOT NULL,
    "peakViewers" INTEGER NOT NULL,
    "engagement" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAuction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "startPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winningBidId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAuction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAuction_winningBidId_key" ON "ProductAuction"("winningBidId");

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AuctionListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_productAuctionId_fkey" FOREIGN KEY ("productAuctionId") REFERENCES "ProductAuction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamModeration" ADD CONSTRAINT "StreamModeration_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamModeration" ADD CONSTRAINT "StreamModeration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamAnalytics" ADD CONSTRAINT "StreamAnalytics_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuction" ADD CONSTRAINT "ProductAuction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAuction" ADD CONSTRAINT "ProductAuction_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
