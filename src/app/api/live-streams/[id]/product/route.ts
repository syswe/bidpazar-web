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
    // Find active auction for this stream
    const auction = await prisma.auctionListing.findFirst({
      where: {
        liveStreamId: streamId,
        status: { in: ["ACTIVE", "COUNTDOWN"] },
      },
      include: {
        product: true,
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          include: { user: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!auction) {
      return NextResponse.json(
        { error: "No active auction found" },
        { status: 404 }
      );
    }

    // Get the product image if available
    const productMedia = await prisma.productMedia.findFirst({
      where: { productId: auction.productId },
      orderBy: { createdAt: "asc" },
    });

    // Count total bids
    const bidCount = await prisma.bid.count({
      where: { listingId: auction.id },
    });

    // Format response
    return NextResponse.json({
      id: auction.id,
      product: {
        id: auction.productId,
        name: auction.product.title,
        description: auction.product.description,
        imageUrl: productMedia?.url || null,
        basePrice: auction.product.price,
        currentPrice: auction.bids[0]?.amount || auction.startPrice,
      },
      bidCount,
      highestBidder: auction.bids[0]?.user?.username || null,
      countdownEnd: auction.countdownEnd,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error fetching active product:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to fetch active product" },
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

  try {
    // Verify authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserFromTokenInNode(token);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Check if stream exists and user is the creator
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { userId: true, status: true },
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    if (stream.userId !== user.id) {
      return NextResponse.json(
        { error: "Only the stream creator can add products" },
        { status: 403 }
      );
    }

    if (stream.status !== "LIVE") {
      return NextResponse.json(
        { error: "Can only add products to live streams" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description, startingPrice, imageUrl } = body;

    if (!name || !startingPrice) {
      return NextResponse.json(
        { error: "Product name and starting price are required" },
        { status: 400 }
      );
    }

    // Check if there's already an active auction for this stream
    const existingAuction = await prisma.auctionListing.findFirst({
      where: {
        liveStreamId: streamId,
        status: { in: ["ACTIVE", "COUNTDOWN", "PENDING"] },
      },
    });

    if (existingAuction) {
      return NextResponse.json(
        { error: "There is already an active auction for this stream" },
        { status: 400 }
      );
    }

    // Calculate auction end time (60 seconds from now)
    const countdownEnd = new Date(Date.now() + 60 * 1000);

    // Transaction to create product and auction listing
    const result = await prisma.$transaction(async (tx) => {
      // First find a default category
      const defaultCategory = await tx.category.findFirst();
      if (!defaultCategory) {
        throw new Error("No category found");
      }

      // First create a product specifically for this livestream auction
      const product = await tx.product.create({
        data: {
          title: name,
          description: description || null,
          price: startingPrice,
          userId: user.id,
          categoryId: defaultCategory.id,
          media: imageUrl
            ? {
                create: {
                  url: imageUrl,
                  type: "IMAGE",
                },
              }
            : undefined,
        },
      });

      // Create auction listing for the livestream
      const auction = await tx.auctionListing.create({
        data: {
          productId: product.id,
          liveStreamId: streamId,
          startPrice: startingPrice,
          status: "ACTIVE",
          countdownTime: 60, // 60 seconds
          countdownStart: new Date(),
          countdownEnd: countdownEnd,
        },
      });

      return { product, auction };
    });

    // Schedule automatic auction end after 60 seconds
    setTimeout(async () => {
      try {
        // Check if the auction is still active
        const auction = await prisma.auctionListing.findUnique({
          where: { id: result.auction.id },
          select: { status: true },
        });

        if (
          auction &&
          (auction.status === "ACTIVE" || auction.status === "COUNTDOWN")
        ) {
          // End the auction
          await fetch(
            `${request.nextUrl.origin}/api/live-streams/${streamId}/auction-end`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                listingId: result.auction.id,
              }),
            }
          );

          logger.info(
            `[API][/api/live-streams/${streamId}/product] Auto-ended auction after 60 seconds`,
            {
              auctionId: result.auction.id,
              productId: result.product.id,
            }
          );
        }
      } catch (error) {
        logger.error(
          `[API][/api/live-streams/${streamId}/product] Error auto-ending auction:`,
          error
        );
      }
    }, 60000); // 60 seconds

    // Log the successful creation
    logger.info(
      `[API][/api/live-streams/${streamId}/product] Product added for livestream auction`,
      {
        productId: result.product.id,
        auctionId: result.auction.id,
        userId: user.id,
      }
    );

    // Return data formatted for the client
    return NextResponse.json({
      id: result.auction.id,
      product: {
        id: result.product.id,
        name: result.product.title,
        description: result.product.description,
        imageUrl: imageUrl || null,
        basePrice: result.product.price,
        currentPrice: result.auction.startPrice,
      },
      bidCount: 0,
      countdownEnd: result.auction.countdownEnd,
    });
  } catch (error) {
    logger.error(`[API][/api/live-streams/${streamId}/product] Error:`, error);
    return NextResponse.json(
      { error: "Failed to add product" },
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
