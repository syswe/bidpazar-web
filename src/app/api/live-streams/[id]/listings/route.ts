import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const createListingSchema = z.object({
  productId: z.string().uuid(),
  startPrice: z.number().min(0),
  countdownTime: z.number().min(10).max(300).default(30),
});

const updateListingSchema = z.object({
  status: z.enum(['ACTIVE', 'COUNTDOWN', 'COMPLETED', 'CANCELLED']).optional(),
  countdownTime: z.number().min(10).max(300).optional(),
});

// GET /api/live-streams/[id]/listings - Get stream listings
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const listings = await prisma.auctionListing.findMany({
      where: { liveStreamId: id },
      include: {
        product: true,
        bids: {
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
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/listings - Create a new listing
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createListingSchema.parse(body);

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to create listings in this stream' },
        { status: 403 }
      );
    }

    if (stream.status !== 'LIVE') {
      return NextResponse.json(
        { error: 'Can only create listings during live streams' },
        { status: 400 }
      );
    }

    const listing = await prisma.auctionListing.create({
      data: {
        ...validatedData,
        liveStreamId: id,
        status: 'ACTIVE',
      },
      include: {
        product: true,
      },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating listing:', error);
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
}

// PUT /api/live-streams/[id]/listings - Update a listing
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { listingId, ...updateData } = body;

    if (!listingId) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const listing = await prisma.auctionListing.findUnique({
      where: { id: listingId },
      include: {
        liveStream: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (listing.liveStream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this listing' },
        { status: 403 }
      );
    }

    const validatedData = updateListingSchema.parse(updateData);

    const updatedListing = await prisma.auctionListing.update({
      where: { id: listingId },
      data: validatedData,
      include: {
        product: true,
        bids: {
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
        },
      },
    });

    return NextResponse.json(updatedListing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating listing:', error);
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    );
  }
} 