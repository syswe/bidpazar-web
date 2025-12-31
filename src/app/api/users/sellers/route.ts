import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/sellers
 * Retrieves all sellers with their stats and badges
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const featuredParam = searchParams.get('featured'); // 'popular', 'favorite', or null for all
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    // Build where clause based on filters
    const where: any = {
      userType: 'SELLER',
    };

    if (featuredParam === 'popular') {
      where.isPopularStreamer = true;
    } else if (featuredParam === 'favorite') {
      where.isFavoriteSeller = true;
    }

    // Get sellers with their stats
    const sellers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        isVerified: true,
        userType: true,
        isPopularStreamer: true,
        isFavoriteSeller: true,
        profileImageUrl: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
            liveStreams: true,
          },
        },
        products: {
          where: {
            auctions: {
              some: {
                status: {
                  in: ['ACTIVE', 'PENDING'],
                },
              },
            },
          },
          select: {
            id: true,
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Transform the data
    const transformed = sellers.map(seller => ({
      id: seller.id,
      username: seller.username,
      name: seller.name || seller.username,
      isVerified: seller.isVerified,
      userType: seller.userType,
      isPopularStreamer: seller.isPopularStreamer,
      isFavoriteSeller: seller.isFavoriteSeller,
      profileImageUrl: seller.profileImageUrl,
      totalProducts: seller._count.products,
      activeProducts: seller.products.length,
      totalStreams: seller._count.liveStreams,
      isLive: seller.liveStreams.length > 0 && seller.liveStreams[0].status === 'LIVE',
      currentViewers: seller.liveStreams.length > 0 ? seller.liveStreams[0].viewerCount : 0,
      memberSince: seller.createdAt,
    }));

    return NextResponse.json({
      sellers: transformed,
      total: transformed.length,
    });
  } catch (error) {
    console.error('[API] Error fetching sellers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sellers' },
      { status: 500 }
    );
  }
}
