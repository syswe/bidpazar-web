-- Convert enum columns to text
ALTER TABLE "LiveStream" ALTER COLUMN "status" TYPE text;
ALTER TABLE "AuctionListing" ALTER COLUMN "status" TYPE text;
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE text;
ALTER TABLE "StreamReward" ALTER COLUMN "type" TYPE text;
ALTER TABLE "StreamShare" ALTER COLUMN "platform" TYPE text;

-- Drop enum types
DROP TYPE IF EXISTS "StreamStatus";
DROP TYPE IF EXISTS "ListingStatus";
DROP TYPE IF EXISTS "NotificationType";
DROP TYPE IF EXISTS "RewardType";
DROP TYPE IF EXISTS "SharePlatform"; 