import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST - End an auction and notify participants
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
    const { listingId } = body;

    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 }
      );
    }

    // Find the auction
    const auction = await prisma.auctionListing.findUnique({
      where: { id: listingId },
      include: {
        liveStream: {
          select: { userId: true },
        },
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          include: { user: true },
        },
        product: true,
      },
    });

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // Verify the user is the streamer
    if (auction.liveStream.userId !== user.id) {
      return NextResponse.json(
        { error: "Only the streamer can end the auction" },
        { status: 403 }
      );
    }

    // Check if auction is active/countdown
    if (auction.status !== "ACTIVE" && auction.status !== "COUNTDOWN") {
      return NextResponse.json(
        { error: "Auction is not active" },
        { status: 400 }
      );
    }

    // Determine winner
    const winner = auction.bids[0]?.user || null;
    let winnerNotified = false;
    let streamerNotified = false;

    // Update auction status
    const updatedAuction = await prisma.auctionListing.update({
      where: { id: listingId },
      data: {
        status: "COMPLETED",
        winningBidId: auction.bids[0]?.id || null,
        countdownEnd: new Date(),
      },
    });

    // Create notification for winner if exists
    if (winner) {
      await prisma.notification.create({
        data: {
          userId: winner.id,
          content: `Tebrikler! ${auction.product.title} ürünü için açık arttırmayı ${auction.bids[0].amount} ₺ ile kazandınız.`,
          type: "BID_WON",
          relatedId: auction.id,
          isRead: false,
        },
      });
      winnerNotified = true;
    }

    // Create notification for streamer
    await prisma.notification.create({
      data: {
        userId: auction.liveStream.userId,
        content: winner
          ? `${auction.product.title} ürünü için açık arttırma sona erdi. ${winner.username} ürünü ${auction.bids[0].amount} ₺ ile kazandı.`
          : `${auction.product.title} ürünü için açık arttırma sona erdi. Hiç teklif gelmedi.`,
        type: "AUCTION_ENDED",
        relatedId: auction.id,
        isRead: false,
      },
    });
    streamerNotified = true;

    // Log auction end
    logger.info(
      `[API][/api/live-streams/${streamId}/auction-end] Auction ended`,
      {
        auctionId: auction.id,
        productId: auction.productId,
        winner: winner?.id || null,
        amount: auction.bids[0]?.amount || auction.startPrice,
      }
    );

    return NextResponse.json({
      success: true,
      auctionId: auction.id,
      winner: winner
        ? {
            id: winner.id,
            username: winner.username,
          }
        : null,
      amount: auction.bids[0]?.amount || auction.startPrice,
      winnerNotified,
      streamerNotified,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/auction-end] Error ending auction:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to end auction" },
      { status: 500 }
    );
  }
}
