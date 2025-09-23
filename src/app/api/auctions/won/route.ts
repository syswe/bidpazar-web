import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Product auctions won by current user (winningBid.userId == userId)
    const auctions = await prisma.productAuction.findMany({
      where: {
        winningBid: {
          userId: payload.userId,
        },
      },
      include: {
        product: {
          include: {
            user: true,
            media: true,
          },
        },
        winningBid: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(auctions);
  } catch (error) {
    console.error('[API][/api/auctions/won] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch won auctions' }, { status: 500 });
  }
}

