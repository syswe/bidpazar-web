import { NextRequest, NextResponse } from "next/server";
import { getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET - Fetch sold products for a live stream
 * Returns both auction and fixed price products that were sold during the stream
 */
export async function GET(
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

    // Fetch the stream to verify ownership or admin access
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
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

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    // Only allow stream owner or admin to view sales
    const isOwner = stream.userId === user.id;
    const isAdmin = user.isAdmin;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized - You can only view your own stream sales" },
        { status: 403 }
      );
    }

    // Fetch all products for this stream with sales info
    const products = await prisma.liveStreamProduct.findMany({
      where: {
        liveStreamId: streamId,
      },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true,
              },
            },
          },
        },
        winningBid: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Separate sold and unsold products
    const soldProducts = products.filter((p) => p.isSold);
    const unsoldProducts = products.filter((p) => !p.isSold && !p.isActive);
    const activeProducts = products.filter((p) => p.isActive);

    // Calculate summary statistics
    const totalSold = soldProducts.length;
    const totalRevenue = soldProducts.reduce(
      (sum, p) => sum + (p.soldPrice || 0),
      0
    );
    const auctionSales = soldProducts.filter((p) => p.isAuctionMode);
    const fixedPriceSales = soldProducts.filter((p) => !p.isAuctionMode);

    // Format products for response
    const formatProduct = (product: any) => ({
      id: product.id,
      title: product.title,
      description: product.description,
      imageUrl: product.imageUrl,
      basePrice: product.basePrice,
      currentPrice: product.currentPrice,
      soldPrice: product.soldPrice,
      stock: product.stock,
      isAuctionMode: product.isAuctionMode,
      isSold: product.isSold,
      isActive: product.isActive,
      soldAt: product.soldAt,
      createdAt: product.createdAt,
      endTime: product.endTime,
      bidCount: product.bids?.length || 0,
      buyer: product.winningBid?.user
        ? {
            id: product.winningBid.user.id,
            username: product.winningBid.user.username,
            name: product.winningBid.user.name,
            email: isAdmin ? product.winningBid.user.email : undefined, // Only show email to admins
          }
        : null,
      winningBid: product.winningBid
        ? {
            id: product.winningBid.id,
            amount: product.winningBid.amount,
            createdAt: product.winningBid.createdAt,
          }
        : null,
    });

    logger.info(
      `[API][/api/live-streams/${streamId}/sales] Sales data fetched`,
      {
        userId: user.id,
        streamId,
        totalProducts: products.length,
        soldCount: soldProducts.length,
      }
    );

    return NextResponse.json({
      success: true,
      stream: {
        id: stream.id,
        title: stream.title,
        description: stream.description,
        status: stream.status,
        startTime: stream.startTime,
        endTime: stream.endTime,
        viewerCount: stream.viewerCount,
        host: stream.user,
      },
      summary: {
        totalProducts: products.length,
        totalSold,
        totalRevenue,
        auctionSalesCount: auctionSales.length,
        fixedPriceSalesCount: fixedPriceSales.length,
        auctionRevenue: auctionSales.reduce(
          (sum, p) => sum + (p.soldPrice || 0),
          0
        ),
        fixedPriceRevenue: fixedPriceSales.reduce(
          (sum, p) => sum + (p.soldPrice || 0),
          0
        ),
        unsoldCount: unsoldProducts.length,
        activeCount: activeProducts.length,
      },
      soldProducts: soldProducts.map(formatProduct),
      unsoldProducts: unsoldProducts.map(formatProduct),
      activeProducts: activeProducts.map(formatProduct),
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/sales] Error fetching sales:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to fetch sales data" },
      { status: 500 }
    );
  }
}
