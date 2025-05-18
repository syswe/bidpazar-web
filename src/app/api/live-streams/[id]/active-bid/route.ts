import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET - Fetch the current active bid for a livestream
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;

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
      `[API][/api/live-streams/${streamId}/active-bid] Error fetching active bid:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to fetch active bid" },
      { status: 500 }
    );
  }
}

/**
 * POST - Place a bid on the active auction
 */
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

    // Parse request body
    const body = await request.json();
    const { amount } = body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid bid amount is required" },
        { status: 400 }
      );
    }

    // Find active auction
    const auction = await prisma.auctionListing.findFirst({
      where: {
        liveStreamId: streamId,
        status: { in: ["ACTIVE", "COUNTDOWN"] },
      },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
      },
    });

    if (!auction) {
      return NextResponse.json(
        { error: "No active auction found" },
        { status: 404 }
      );
    }

    // Check if the bid is high enough
    const currentHighestBid = auction.bids[0]?.amount || auction.startPrice;
    const bidAmount = parseFloat(amount);

    if (bidAmount <= currentHighestBid) {
      return NextResponse.json(
        {
          error: `Bid must be higher than current highest bid (${currentHighestBid} ₺)`,
        },
        { status: 400 }
      );
    }

    // Place the bid
    const newBid = await prisma.bid.create({
      data: {
        amount: bidAmount,
        userId: user.id,
        listingId: auction.id,
      },
      include: {
        user: true,
      },
    });

    // Log successful bid
    logger.info(
      `[API][/api/live-streams/${streamId}/active-bid] New bid placed`,
      {
        userId: user.id,
        listingId: auction.id,
        amount: bidAmount,
      }
    );

    // Return successful response
    return NextResponse.json({
      id: newBid.id,
      amount: newBid.amount,
      userId: newBid.userId,
      username: newBid.user.username,
      listingId: auction.id,
      timestamp: newBid.createdAt,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/active-bid] Error placing bid:`,
      error
    );
    return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
  }
}
