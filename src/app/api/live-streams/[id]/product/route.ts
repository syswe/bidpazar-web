import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Schema for product creation in livestream
const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  startingPrice: z.number().positive(),
  imageUrl: z.string().url().optional(),
  price: z.number().positive().optional(), // Added for compatibility with the form
});

// Schema for bid placement
const placeBidSchema = z.object({
  amount: z.number().positive(),
});

// GET /api/live-streams/[id]/product - Get products for a stream
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;
  logger.info(
    `[API][/api/live-streams/${streamId}/product] GET request received`
  );

  try {
    // Fetch live stream auction listings
    const listings = await prisma.auctionListing.findMany({
      where: {
        liveStreamId: streamId,
      },
      include: {
        product: {
          include: {
            media: {
              take: 1,
            },
          },
        },
        bids: {
          orderBy: {
            amount: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform data for response
    const formattedProducts = listings.map((listing) => ({
      id: listing.id,
      name: listing.product.title,
      description: listing.product.description,
      startingPrice: listing.startPrice,
      currentPrice: listing.bids[0]?.amount || listing.startPrice,
      imageUrl: listing.product.media[0]?.url || null,
      createdAt: listing.createdAt,
      status: listing.status,
      hasBids: listing.bids.length > 0,
      productId: listing.productId,
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error fetching products`,
      { error }
    );
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/product - Create a new product for auction in livestream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;
  logger.info(
    `[API][/api/live-streams/${streamId}/product] POST request received`
  );

  try {
    // Try to authenticate user via session first
    const session = await getServerSession(authOptions);
    let user = session?.user;

    // If no session user, try token-based authentication
    if (!user?.id) {
      // Extract token from authorization header
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : request.cookies.get("token")?.value ||
          request.cookies.get("authToken")?.value;

      if (!token) {
        logger.warn(
          `[API][/api/live-streams/${streamId}/product] No authentication token found`
        );
        return NextResponse.json(
          { error: "Unauthorized - No token provided" },
          { status: 401 }
        );
      }

      // Verify token and get user
      const tokenUser = await getUserFromTokenInNode(token);
      if (!tokenUser) {
        logger.warn(
          `[API][/api/live-streams/${streamId}/product] Invalid token or user not found`
        );
        return NextResponse.json(
          { error: "Unauthorized - Invalid token" },
          { status: 401 }
        );
      }

      user = tokenUser;
    }

    // At this point, if we still don't have a user, return unauthorized
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is the stream creator
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { userId: true },
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (stream.userId !== user.id) {
      logger.warn(
        `[API][/api/live-streams/${streamId}/product] User ${user.id} is not the stream creator (${stream.userId})`
      );
      return NextResponse.json(
        { error: "Only the stream creator can add products" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    logger.debug(
      `[API][/api/live-streams/${streamId}/product] Request body:`,
      body
    );

    // Handle both startingPrice and price fields for compatibility
    if (body.price && !body.startingPrice) {
      body.startingPrice = body.price;
    }

    const validationResult = createProductSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn(
        `[API][/api/live-streams/${streamId}/product] Invalid request data:`,
        validationResult.error
      );
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const productData = validationResult.data;

    // Find a valid category ID or create one if needed
    let categoryId = "";
    try {
      // First try to find any existing category
      const existingCategory = await prisma.category.findFirst({
        select: { id: true },
      });

      if (existingCategory) {
        // Use the first category found
        categoryId = existingCategory.id;
        logger.info(`[API] Using existing category ID: ${categoryId}`);
      } else {
        // Create a default category if none exists
        const newCategory = await prisma.category.create({
          data: {
            name: "Genel",
            description: "Genel ürün kategorisi",
          },
        });
        categoryId = newCategory.id;
        logger.info(
          `[API] Created new default category with ID: ${categoryId}`
        );
      }
    } catch (categoryError) {
      logger.error(`[API] Error handling category: ${categoryError}`);
      return NextResponse.json(
        { error: "Failed to process category for product" },
        { status: 500 }
      );
    }

    // First create the product
    const product = await prisma.product.create({
      data: {
        title: productData.name,
        description: productData.description,
        price: productData.startingPrice,
        currency: "TRY", // Default currency
        userId: user.id,
        categoryId: categoryId, // Use the valid category ID
        media: {
          create: productData.imageUrl
            ? {
                url: productData.imageUrl,
                type: "image",
              }
            : undefined,
        },
      },
    });

    // Then create the auction listing for this product in the livestream
    const listing = await prisma.auctionListing.create({
      data: {
        productId: product.id,
        liveStreamId: streamId,
        startPrice: productData.startingPrice,
        status: "PENDING", // Initial status
      },
      include: {
        product: true,
      },
    });

    // Notify connected clients via Socket.IO (if set up)
    try {
      const { io } = global as any;
      if (io) {
        io.to(`stream:${streamId}`).emit("new_product", {
          productId: product.id,
          listingId: listing.id,
          name: product.title,
          startingPrice: listing.startPrice,
        });
      }
    } catch (notifyError) {
      logger.warn("Failed to notify clients about new product", {
        error: notifyError,
      });
    }

    return NextResponse.json(
      {
        id: listing.id,
        productId: product.id,
        name: product.title,
        description: product.description,
        startingPrice: listing.startPrice,
        status: listing.status,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error creating product`,
      { error }
    );
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}

// PATCH /api/live-streams/[id]/product/[productId]/bid - Place a bid on a livestream product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: streamId, productId: listingId } = await params;
  logger.info(
    `[API][/api/live-streams/${streamId}/product/${listingId}/bid] PATCH request received`
  );

  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    const user = session?.user;

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = placeBidSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { amount } = validationResult.data;

    // Fetch auction listing and highest bid
    const listing = await prisma.auctionListing.findUnique({
      where: { id: listingId },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Verify listing belongs to the specified stream
    if (listing.liveStreamId !== streamId) {
      return NextResponse.json(
        { error: "Listing does not belong to this stream" },
        { status: 400 }
      );
    }

    // Check if bid amount is higher than current highest bid or starting price
    const currentHighestBid = listing.bids[0]?.amount || listing.startPrice;

    if (amount <= currentHighestBid) {
      return NextResponse.json(
        {
          error: "Bid amount must be higher than current highest bid",
          currentHighestBid,
        },
        { status: 400 }
      );
    }

    // Create the bid
    const bid = await prisma.bid.create({
      data: {
        listingId,
        userId: user.id,
        amount,
      },
    });

    // Notify connected clients via Socket.IO
    try {
      const { io } = global as any;
      if (io) {
        io.to(`stream:${streamId}`).emit("new_bid", {
          listingId,
          bidId: bid.id,
          userId: user.id,
          amount,
          username: user.name || "Anonymous",
        });
      }
    } catch (notifyError) {
      logger.warn("Failed to notify clients about new bid", {
        error: notifyError,
      });
    }

    return NextResponse.json({
      bidId: bid.id,
      amount: bid.amount,
      userId: bid.userId,
      createdAt: bid.createdAt,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error placing bid`,
      { error }
    );
    return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
  }
}
