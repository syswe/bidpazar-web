import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Cron endpoint to cleanup expired scheduled streams.
 * Deletes SCHEDULED streams where startTime + 1 hour < current time.
 * Should be called periodically (every 10 minutes recommended).
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  logger.info(`[Cron] Starting scheduled stream cleanup at ${timestamp}`);

  try {
    // Calculate threshold: 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find expired scheduled streams
    const expiredStreams = await prisma.liveStream.findMany({
      where: {
        status: "SCHEDULED",
        startTime: {
          lt: oneHourAgo,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (expiredStreams.length === 0) {
      logger.info("[Cron] No expired scheduled streams found");
      return NextResponse.json({
        success: true,
        message: "No expired streams to cleanup",
        deletedCount: 0,
      });
    }

    logger.info(`[Cron] Found ${expiredStreams.length} expired scheduled streams`);

    // Delete each expired stream and its related data
    for (const stream of expiredStreams) {
      logger.info(`[Cron] Deleting expired stream: ${stream.id} (${stream.title}) - was scheduled for ${stream.startTime}`);

      try {
        // Delete live stream products and their bids
        const streamProducts = await prisma.liveStreamProduct.findMany({
          where: { liveStreamId: stream.id },
          select: { id: true },
        });

        for (const product of streamProducts) {
          await prisma.liveStreamBid.deleteMany({
            where: { liveStreamProductId: product.id },
          });
        }

        await prisma.liveStreamProduct.deleteMany({
          where: { liveStreamId: stream.id },
        });

        // Delete chat messages
        await prisma.chatMessage.deleteMany({
          where: { liveStreamId: stream.id },
        });

        // Delete auction listings
        await prisma.auctionListing.deleteMany({
          where: { liveStreamId: stream.id },
        });

        // Delete stream analytics, highlights, rewards, shares, view times, moderation
        await prisma.streamAnalytics.deleteMany({
          where: { liveStreamId: stream.id },
        });
        await prisma.streamHighlight.deleteMany({
          where: { liveStreamId: stream.id },
        });
        await prisma.streamReward.deleteMany({
          where: { liveStreamId: stream.id },
        });
        await prisma.streamShare.deleteMany({
          where: { liveStreamId: stream.id },
        });
        await prisma.streamViewTime.deleteMany({
          where: { liveStreamId: stream.id },
        });
        await prisma.streamModeration.deleteMany({
          where: { liveStreamId: stream.id },
        });

        // Finally delete the stream itself
        await prisma.liveStream.delete({
          where: { id: stream.id },
        });

        logger.info(`[Cron] Successfully deleted expired stream: ${stream.id}`);
      } catch (streamError) {
        logger.error(`[Cron] Failed to delete stream ${stream.id}:`, streamError);
      }
    }

    logger.info(`[Cron] Stream cleanup completed. Deleted ${expiredStreams.length} streams.`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${expiredStreams.length} expired scheduled streams`,
      deletedCount: expiredStreams.length,
      deletedStreams: expiredStreams.map((s) => ({
        id: s.id,
        title: s.title,
        scheduledFor: s.startTime,
        userId: s.userId,
        username: s.user?.username,
      })),
    });
  } catch (error) {
    logger.error("[Cron] Error during stream cleanup:", error);
    return NextResponse.json(
      { success: false, error: "Stream cleanup failed" },
      { status: 500 }
    );
  }
}

// Also allow POST for flexibility with external cron services
export async function POST() {
  return GET();
}
