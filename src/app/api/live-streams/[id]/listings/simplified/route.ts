import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserFromTokenInNode } from '@/lib/auth';
import { z } from 'zod';

// Validation schema for simplified listing creation
const createSimplifiedListingSchema = z.object({
  productId: z.string().default('default'), // This can be 'default' for auto-created products
  startPrice: z.number().min(0),
  countdownTime: z.number().min(10).max(300).default(30),
  productName: z.string().optional()
});

// POST /api/live-streams/[id]/listings/simplified
// Create a product on-the-fly and add it as a listing to the stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: streamId } = await params;
    logger.info(`[API] POST /api/live-streams/${streamId}/listings/simplified`);

    // Get user from token
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('authToken')?.value ||
                  request.cookies.get('token')?.value;

    if (!token) {
      logger.warn(`[API] Unauthorized - No token provided`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn(`[API] Unauthorized - Invalid token`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    logger.debug(`[API] Request body:`, body);
    
    const validatedData = createSimplifiedListingSchema.parse(body);
    logger.debug(`[API] Validated data:`, validatedData);

    // Check if stream exists and user is the owner
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      logger.warn(`[API] Stream not found: ${streamId}`);
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    if (stream.userId !== user.id) {
      logger.warn(`[API] User ${user.id} is not authorized for stream ${streamId}`);
      return NextResponse.json({ error: 'Not the stream owner' }, { status: 403 });
    }

    // Get a default category for the product
    const defaultCategory = await prisma.category.findFirst({
      orderBy: { createdAt: 'asc' }
    });
    
    if (!defaultCategory) {
      logger.warn(`[API] No category found in the database`);
      return NextResponse.json({ error: 'No category available for product creation' }, { status: 500 });
    }

    // Create a placeholder product for the stream
    const product = await prisma.product.create({
      data: {
        title: validatedData.productName || `Stream Product ${new Date().toISOString()}`,
        description: 'Product added during live stream',
        price: validatedData.startPrice,
        currency: 'TRY', // Default currency (Turkish Lira)
        userId: user.id,
        categoryId: defaultCategory.id,
      },
    });

    logger.info(`[API] Created product: ${product.id}`);

    // Create the listing with the newly created product
    const listing = await prisma.auctionListing.create({
      data: {
        productId: product.id,
        liveStreamId: streamId,
        startPrice: validatedData.startPrice,
        countdownTime: validatedData.countdownTime,
        status: 'ACTIVE',
      },
      include: {
        product: true,
      },
    });

    logger.info(`[API] Created listing: ${listing.id}`);
    return NextResponse.json(listing, { status: 201 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error(`[API] Validation error:`, error.errors);
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    
    logger.error(`[API] Error creating simplified listing:`, error);
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
} 