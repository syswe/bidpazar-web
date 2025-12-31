import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/popular-streamers
 * Retrieves users marked as popular streamers (randomized)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 4;

    // Get all popular streamers
    const popularStreamers = await prisma.user.findMany({
      where: {
        isPopularStreamer: true,
        userType: 'SELLER', // Only sellers can be streamers
      },
      select: {
        id: true,
        username: true,
        name: true,
        isVerified: true,
        userType: true,
        profileImageUrl: true,
        createdAt: true,
        _count: {
          select: {
            liveStreams: true,
            products: true,
          },
        },
        liveStreams: {
          where: {
            status: {
              in: ['LIVE', 'SCHEDULED'],
            },
          },
          select: {
            id: true,
            status: true,
            viewerCount: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // Randomize the results
    const shuffled = popularStreamers.sort(() => Math.random() - 0.5);
    const limited = shuffled.slice(0, limit);

    // Transform the data to include stream stats
    const transformed = limited.map(streamer => ({
      id: streamer.id,
      username: streamer.username,
      name: streamer.name,
      isVerified: streamer.isVerified,
      userType: streamer.userType,
      profileImageUrl: streamer.profileImageUrl,
      totalStreams: streamer._count.liveStreams,
      totalProducts: streamer._count.products,
      isLive: streamer.liveStreams.length > 0 && streamer.liveStreams[0].status === 'LIVE',
      currentViewers: streamer.liveStreams.length > 0 ? streamer.liveStreams[0].viewerCount : 0,
      memberSince: streamer.createdAt,
    }));

    return NextResponse.json({
      streamers: transformed,
      total: popularStreamers.length,
    });
  } catch (error) {
    console.error('[API] Error fetching popular streamers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular streamers' },
      { status: 500 }
    );
  }
}

