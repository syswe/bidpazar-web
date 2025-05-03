import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema
const bidSchema = z.object({
  amount: z.number().min(0),
});

// GET /api/live-streams/[id]/listings/[listingId]/bids - Get bids for a listing
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; listingId: string }> }
) {
  try {
    const { listingId } = await params;
    
    const bids = await prisma.bid.findMany({
      where: { listingId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        amount: 'desc',
      },
    });

    return NextResponse.json(bids);
  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bids' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/listings/[listingId]/bids - Place a bid
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; listingId: string }> }
) {
  try {
    const { listingId } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = bidSchema.parse(body);

    const listing = await prisma.auctionListing.findUnique({
      where: { id: listingId },
      include: {
        liveStream: true,
        bids: {
          orderBy: {
            amount: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (listing.status !== 'ACTIVE' && listing.status !== 'COUNTDOWN') {
      return NextResponse.json(
        { error: 'Cannot place bid on inactive listing' },
        { status: 400 }
      );
    }

    if (listing.liveStream.status !== 'LIVE') {
      return NextResponse.json(
        { error: 'Cannot place bid on inactive stream' },
        { status: 400 }
      );
    }

    if (listing.liveStream.userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot place bid on your own listing' },
        { status: 400 }
      );
    }

    const currentHighestBid = listing.bids[0]?.amount || listing.startPrice;
    if (validatedData.amount <= currentHighestBid) {
      return NextResponse.json(
        { error: 'Bid amount must be higher than current highest bid' },
        { status: 400 }
      );
    }

    const bid = await prisma.bid.create({
      data: {
        amount: validatedData.amount,
        userId: session.user.id,
        listingId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    // Update the listing's winning bid
    await prisma.auctionListing.update({
      where: { id: listingId },
      data: {
        winningBidId: bid.id,
      },
    });

    // If there was a previous winning bid, mark it as backup
    if (listing.winningBidId) {
      await prisma.bid.update({
        where: { id: listing.winningBidId },
        data: {
          isWinning: false,
          isBackup: true,
        },
      });
    }

    return NextResponse.json(bid, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error placing bid:', error);
    return NextResponse.json(
      { error: 'Failed to place bid' },
      { status: 500 }
    );
  }
} 