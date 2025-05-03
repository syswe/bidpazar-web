-- Create new enums
CREATE TYPE "StreamStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "ListingStatus" AS ENUM ('PENDING', 'ACTIVE', 'COUNTDOWN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('BID_WON', 'BID_OUTBID', 'MESSAGE', 'SYSTEM');
CREATE TYPE "RewardType" AS ENUM ('VIEWER', 'BIDDER', 'CHATTER');
CREATE TYPE "SharePlatform" AS ENUM ('TWITTER', 'FACEBOOK', 'WHATSAPP', 'TELEGRAM');

-- Add temporary columns
ALTER TABLE "LiveStream" ADD COLUMN "status_new" "StreamStatus" DEFAULT 'SCHEDULED';
ALTER TABLE "AuctionListing" ADD COLUMN "status_new" "ListingStatus" DEFAULT 'PENDING';
ALTER TABLE "Notification" ADD COLUMN "type_new" "NotificationType";
ALTER TABLE "StreamReward" ADD COLUMN "type_new" "RewardType";
ALTER TABLE "StreamShare" ADD COLUMN "platform_new" "SharePlatform";

-- Update temporary columns
UPDATE "LiveStream" SET "status_new" = "status"::"StreamStatus";
UPDATE "AuctionListing" SET "status_new" = "status"::"ListingStatus";
UPDATE "Notification" SET "type_new" = "type"::"NotificationType";
UPDATE "StreamReward" SET "type_new" = "type"::"RewardType";
UPDATE "StreamShare" SET "platform_new" = "platform"::"SharePlatform";

-- Drop old columns
ALTER TABLE "LiveStream" DROP COLUMN "status";
ALTER TABLE "AuctionListing" DROP COLUMN "status";
ALTER TABLE "Notification" DROP COLUMN "type";
ALTER TABLE "StreamReward" DROP COLUMN "type";
ALTER TABLE "StreamShare" DROP COLUMN "platform";

-- Rename new columns
ALTER TABLE "LiveStream" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "AuctionListing" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Notification" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "StreamReward" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "StreamShare" RENAME COLUMN "platform_new" TO "platform";

-- Add unique constraint on StreamViewTime
ALTER TABLE "StreamViewTime" ADD CONSTRAINT "StreamViewTime_userId_liveStreamId_key" UNIQUE ("userId", "liveStreamId"); 