import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST - Place a bid on a live stream product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: streamId, productId } = await params;

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

    const bidAmount = parseFloat(amount);

    // Find the live stream product and verify it's active
    const product = await prisma.liveStreamProduct.findUnique({
      where: { id: productId },
      include: {
        liveStream: true,
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.liveStreamId !== streamId) {
      return NextResponse.json(
        { error: "Product does not belong to this stream" },
        { status: 400 }
      );
    }

    if (!product.isActive) {
      return NextResponse.json(
        { error: "Product auction is not active" },
        { status: 400 }
      );
    }

    if (!product.isAuctionMode) {
      return NextResponse.json(
        { error: "This product is not in auction mode" },
        { status: 400 }
      );
    }

    // Check if auction has ended
    if (product.endTime && new Date() > product.endTime) {
      return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
    }

    // Prevent streamer from bidding on their own products
    if (product.liveStream.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot bid on your own products" },
        { status: 403 }
      );
    }

    // Check if bid amount is higher than current highest bid
    const currentHighestBid = product.bids[0]?.amount || product.currentPrice;

    if (bidAmount <= currentHighestBid) {
      return NextResponse.json(
        {
          error: `Bid must be higher than current highest bid (${currentHighestBid} ₺)`,
        },
        { status: 400 }
      );
    }

    // Create the bid
    const newBid = await prisma.liveStreamBid.create({
      data: {
        amount: bidAmount,
        userId: user.id,
        liveStreamProductId: productId,
      },
      include: {
        user: { select: { username: true } },
      },
    });

    // Update the product's current price
    await prisma.liveStreamProduct.update({
      where: { id: productId },
      data: { currentPrice: bidAmount },
    });

    // Emit socket event for real-time updates
    if ((global as any).socketIO) {
      (global as any).socketIO.to(`stream:${streamId}`).emit("new-bid", {
        streamId,
        productId,
        bidId: newBid.id,
        userId: user.id,
        username: user.username,
        amount: bidAmount,
        timestamp: newBid.createdAt.toISOString(),
      });
    }

    logger.info(
      `[API][/api/live-streams/${streamId}/product/${productId}/bid] New bid placed`,
      {
        userId: user.id,
        productId,
        amount: bidAmount,
        bidId: newBid.id,
      }
    );

    return NextResponse.json({
      success: true,
      bid: {
        id: newBid.id,
        amount: newBid.amount,
        userId: newBid.userId,
        username: newBid.user.username,
        timestamp: newBid.createdAt,
      },
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product/${productId}/bid] Error placing bid:`,
      error
    );
    return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
  }
}

/**
 * GET - Get all bids for a live stream product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: streamId, productId } = await params;

  try {
    // Find the product and its bids
    const product = await prisma.liveStreamProduct.findUnique({
      where: { id: productId },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          include: {
            user: { select: { username: true } },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.liveStreamId !== streamId) {
      return NextResponse.json(
        { error: "Product does not belong to this stream" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      bids: product.bids.map((bid) => ({
        id: bid.id,
        amount: bid.amount,
        username: bid.user.username,
        timestamp: bid.createdAt,
        isWinning: bid.isWinning,
      })),
      totalBids: product.bids.length,
      highestBid: product.bids[0] || null,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product/${productId}/bid] Error fetching bids:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to fetch bids" },
      { status: 500 }
    );
  }
}
