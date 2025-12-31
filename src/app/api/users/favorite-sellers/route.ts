import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/favorite-sellers
 * Retrieves users marked as favorite sellers (randomized)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 5;

    // Get all favorite sellers
    const favoriteSellers = await prisma.user.findMany({
      where: {
        isFavoriteSeller: true,
        userType: 'SELLER',
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
      },
    });

    // Randomize the results
    const shuffled = favoriteSellers.sort(() => Math.random() - 0.5);
    const limited = shuffled.slice(0, limit);

    // Transform the data
    const transformed = limited.map(seller => ({
      id: seller.id,
      username: seller.username,
      name: seller.name || seller.username,
      isVerified: seller.isVerified,
      userType: seller.userType,
      profileImageUrl: seller.profileImageUrl,
      totalProducts: seller._count.products,
      activeProducts: seller.products.length,
      totalStreams: seller._count.liveStreams,
      memberSince: seller.createdAt,
    }));

    return NextResponse.json({
      sellers: transformed,
      total: favoriteSellers.length,
    });
  } catch (error) {
    console.error('[API] Error fetching favorite sellers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorite sellers' },
      { status: 500 }
    );
  }
}

