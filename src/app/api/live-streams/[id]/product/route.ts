import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// In-memory store for active products (in a real app, use a database)
const activeProducts: Record<string, any> = {};

// Simplified version - no type annotations on second parameter
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  // Get the streamId from params correctly
  const streamId = ctx.params.id;
  logger.info(`API GET /api/live-streams/${streamId}/product`, { streamId });

  try {
    // First, find the stream to ensure it exists
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { id: true }, // Only select id, we just need to confirm existence initially
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }
    
    // According to the Prisma schema, we need to get the AuctionListing for the stream
    const activeListing = await prisma.auctionListing.findFirst({
      where: {
        liveStreamId: streamId,
        status: 'ACTIVE',
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent active product
      },
    });

    // If there's no active listing, check our in-memory store
    if (!activeListing) {
      const inMemoryProduct = activeProducts[streamId];
      if (inMemoryProduct) {
        return NextResponse.json(inMemoryProduct);
      }
      return NextResponse.json({ message: "No active product" }, { status: 404 });
    }

    return NextResponse.json({
      id: activeListing.id,
      name: activeListing.product.title,
      description: activeListing.product.description,
      startingPrice: activeListing.startPrice,
      productId: activeListing.productId,
      streamId: activeListing.liveStreamId,
    });
  } catch (error) {
    logger.error('Error fetching product for stream', { streamId, error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Simplified version - no type annotations on second parameter
export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  // Get the streamId from params correctly
  const streamId = ctx.params.id;
  logger.info(`API POST /api/live-streams/${streamId}/product`, { streamId });

  try {
    const body = await req.json();
    
    // Validate the body
    if (!body.name || !body.description || !body.price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Store in our in-memory store
    const product = {
      id: `temp-${Date.now()}`,
      name: body.name,
      description: body.description,
      startingPrice: parseFloat(body.price),
      imageUrl: body.imageUrl || null,
      productId: body.productId || null,
      streamId,
    };

    activeProducts[streamId] = product;
    
    logger.info('Product added to stream', { streamId, product });
    return NextResponse.json(product);
  } catch (error) {
    logger.error('Error adding product to stream', { streamId, error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
