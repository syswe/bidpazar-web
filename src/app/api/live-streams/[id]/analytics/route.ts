import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/live-streams/[id]/analytics - Get detailed stream analytics
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        listings: {
          include: {
            bids: true,
            product: true,
          },
        },
        chatMessages: true,
        viewers: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        viewTimes: true,
        analytics: {
          orderBy: { timestamp: 'desc' },
          take: 100, // Get last 100 analytics points
        },
      },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view analytics' },
        { status: 403 }
      );
    }

    // Calculate detailed analytics
    const totalViewers = stream.viewers.length;
    const totalMessages = stream.chatMessages.length;
    const totalListings = stream.listings.length;
    
    type Listing = {
      bids: { id: string; amount: number }[];
      winningBidId: string | null;
    };
    
    const totalBids = stream.listings.reduce(
      (acc: number, listing: Listing) => acc + listing.bids.length,
      0
    );
    const totalRevenue = stream.listings.reduce((acc: number, listing: Listing) => {
      const winningBid = listing.bids.find((bid) => bid.id === listing.winningBidId);
      return acc + (winningBid?.amount || 0);
    }, 0);

    // Calculate average watch time
    const totalWatchTime = stream.viewTimes.reduce(
      (acc: number, viewTime: { durationInSeconds: number }) => acc + viewTime.durationInSeconds,
      0
    );
    const averageWatchTime = totalViewers > 0 ? totalWatchTime / totalViewers : 0;

    // Calculate engagement score (0-100)
    const engagementScore = calculateEngagementScore({
      totalViewers,
      totalMessages,
      totalBids,
      averageWatchTime,
    });

    // Get peak viewers
    const peakViewers = Math.max(
      ...stream.analytics.map((point: { viewerCount: number }) => point.viewerCount),
      totalViewers
    );

    // Create analytics snapshot
    const analyticsSnapshot = {
      timestamp: new Date(),
      viewerCount: totalViewers,
      messageCount: totalMessages,
      bidCount: totalBids,
      revenue: totalRevenue,
      avgWatchTime: Math.round(averageWatchTime),
      peakViewers,
      engagement: engagementScore,
    };

    // Save analytics snapshot
    await prisma.streamAnalytics.create({
      data: {
        ...analyticsSnapshot,
        liveStreamId: id,
      },
    });

    return NextResponse.json({
      ...analyticsSnapshot,
      totalListings,
      historicalData: stream.analytics,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// Helper function to calculate engagement score (0-100)
function calculateEngagementScore({
  totalViewers,
  totalMessages,
  totalBids,
  averageWatchTime,
}: {
  totalViewers: number;
  totalMessages: number;
  totalBids: number;
  averageWatchTime: number;
}): number {
  // Normalize values
  const messageRate = totalMessages / Math.max(totalViewers, 1);
  const bidRate = totalBids / Math.max(totalViewers, 1);
  const normalizedWatchTime = Math.min(averageWatchTime / 3600, 1); // Normalize to 1 hour

  // Weighted scoring
  const weights = {
    messageRate: 0.3,
    bidRate: 0.3,
    watchTime: 0.4,
  };

  // Calculate score (0-100)
  const score =
    (messageRate * weights.messageRate +
      bidRate * weights.bidRate +
      normalizedWatchTime * weights.watchTime) *
    100;

  return Math.min(Math.round(score), 100);
} 