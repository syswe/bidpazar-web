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

/**
 * GET - Fetch live stream products for a stream
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;

  try {
    const products = await prisma.liveStreamProduct.findMany({
      where: {
        liveStreamId: streamId,
      },
      include: {
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error fetching products:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new live stream product/auction
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

    // Verify user owns the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
    });

    if (!stream || stream.userId !== user.id) {
      return NextResponse.json(
        {
          error: "Unauthorized - You can only add products to your own streams",
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      name,
      description,
      startingPrice,
      stock = 1,
      category,
      tags = [],
      isAuctionMode = true,
      auctionDuration = 60,
    } = body;

    if (!name || !startingPrice) {
      return NextResponse.json(
        { error: "Product name and starting price are required" },
        { status: 400 }
      );
    }

    const price = parseFloat(startingPrice);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: "Valid starting price is required" },
        { status: 400 }
      );
    }

    // Check if there's already an active product in this stream
    const activeProduct = await prisma.liveStreamProduct.findFirst({
      where: {
        liveStreamId: streamId,
        isActive: true,
      },
    });

    if (activeProduct) {
      return NextResponse.json(
        {
          error:
            "There is already an active product in this stream. Please end the current product first.",
        },
        { status: 409 }
      );
    }

    // Create the live stream product
    const product = await prisma.liveStreamProduct.create({
      data: {
        title: name,
        description: description || null,
        basePrice: price,
        currentPrice: price,
        stock: parseInt(stock) || 1,
        category: category || null,
        tags: Array.isArray(tags) ? tags : [],
        liveStreamId: streamId,
        isActive: true,
        isAuctionMode: Boolean(isAuctionMode),
        auctionDuration: isAuctionMode ? parseInt(auctionDuration) || 60 : null,
        startTime: isAuctionMode ? null : new Date(), // Auction products start without timer initially
        endTime: null, // No end time until countdown starts
      },
    });

    // Emit socket event for new product
    if ((global as any).socketIO) {
      if (isAuctionMode) {
        // Auction mode - product is created but countdown hasn't started yet
        (global as any).socketIO
          .to(`stream:${streamId}`)
          .emit("new-live-product", {
            streamId,
            productId: product.id,
            productName: name,
            startPrice: price,
            productType: "AUCTION",
            status: "PENDING", // Product is waiting for countdown to start
          });
      } else {
        // Stock sale mode
        (global as any).socketIO
          .to(`stream:${streamId}`)
          .emit("new-stock-sale", {
            streamId,
            productId: product.id,
            productName: name,
            price: price,
            stock: parseInt(stock) || 1,
            productType: "FIXED_PRICE",
          });
      }
    }

    logger.info(
      `[API][/api/live-streams/${streamId}/product] New live stream product created`,
      {
        userId: user.id,
        productId: product.id,
        productName: name,
        startPrice: price,
      }
    );

    return NextResponse.json({
      success: true,
      id: product.id,
      product: {
        id: product.id,
        title: product.title,
        description: product.description,
        basePrice: product.basePrice,
        currentPrice: product.currentPrice,
        isActive: product.isActive,
        isAuctionMode: product.isAuctionMode,
        endTime: product.endTime,
        createdAt: product.createdAt,
      },
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error creating product:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a live stream product (end auction, etc.)
 */
export async function PUT(
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
    const { productId, action } = body;

    if (!productId || !action) {
      return NextResponse.json(
        { error: "Product ID and action are required" },
        { status: 400 }
      );
    }

    // Find the product and verify ownership
    const product = await prisma.liveStreamProduct.findUnique({
      where: { id: productId },
      include: {
        liveStream: true,
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          include: { user: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.liveStream.userId !== user.id) {
      return NextResponse.json(
        {
          error: "Unauthorized - You can only modify your own stream products",
        },
        { status: 403 }
      );
    }

    let updatedProduct;

    switch (action) {
      case "end_auction":
        const highestBid = product.bids[0];

        updatedProduct = await prisma.liveStreamProduct.update({
          where: { id: productId },
          data: {
            isActive: false,
            endTime: new Date(),
            isSold: !!highestBid,
            soldAt: highestBid ? new Date() : null,
            soldPrice: highestBid ? highestBid.amount : null,
            winningBidId: highestBid ? highestBid.id : null,
          },
        });

        // Update winning bid status
        if (highestBid) {
          await prisma.liveStreamBid.update({
            where: { id: highestBid.id },
            data: { isWinning: true },
          });
        }

        // Emit socket event
        if ((global as any).socketIO) {
          (global as any).socketIO
            .to(`stream:${streamId}`)
            .emit("live-product-ended", {
              streamId,
              productId,
              winner: highestBid
                ? {
                    username: highestBid.user.username,
                    amount: highestBid.amount,
                  }
                : null,
            });
        }

        break;

      case "remove_stock_sale":
        updatedProduct = await prisma.liveStreamProduct.update({
          where: { id: productId },
          data: {
            isActive: false,
            endTime: new Date(),
          },
        });

        // Emit socket event
        if ((global as any).socketIO) {
          (global as any).socketIO
            .to(`stream:${streamId}`)
            .emit("stock-sale-removed", {
              streamId,
              productId,
              timestamp: new Date().toISOString(),
            });
        }

        break;

      case "start_countdown":
        // Only allow countdown actions for auction products
        if (!product.isAuctionMode) {
          return NextResponse.json(
            {
              error:
                "Countdown actions are only available for auction products",
            },
            { status: 400 }
          );
        }

        const { duration = 60 } = body;
        const endTime = new Date(Date.now() + duration * 1000);

        // Get the highest bid so far to start the auction from that price
        const highestBidSoFar = await prisma.liveStreamBid.findFirst({
          where: { liveStreamProductId: productId },
          orderBy: { amount: "desc" },
          include: { user: true },
        });

        // Calculate starting price: use highest bid if exists, otherwise use base price
        const startingPrice = highestBidSoFar
          ? highestBidSoFar.amount
          : product.basePrice;

        updatedProduct = await prisma.liveStreamProduct.update({
          where: { id: productId },
          data: {
            isActive: true,
            endTime: endTime,
            auctionDuration: duration,
            startTime: new Date(),
            currentPrice: startingPrice, // Start from the highest bid received so far
          },
        });

        // Emit socket event
        if ((global as any).socketIO) {
          (global as any).socketIO
            .to(`stream:${streamId}`)
            .emit("countdown-started", {
              streamId,
              productId,
              duration: duration,
              endTime: endTime.toISOString(),
              startingPrice: startingPrice,
              highestBidder: highestBidSoFar
                ? highestBidSoFar.user?.username
                : null,
            });
        }

        break;

      case "pause_countdown":
        // Only allow countdown actions for auction products
        if (!product.isAuctionMode) {
          return NextResponse.json(
            {
              error:
                "Countdown actions are only available for auction products",
            },
            { status: 400 }
          );
        }

        updatedProduct = await prisma.liveStreamProduct.update({
          where: { id: productId },
          data: {
            isActive: false,
          },
        });

        // Emit socket event
        if ((global as any).socketIO) {
          (global as any).socketIO
            .to(`stream:${streamId}`)
            .emit("countdown-paused", {
              streamId,
              productId,
              timestamp: new Date().toISOString(),
            });
        }

        break;

      case "cancel_auction":
        // Only allow cancel for auction products in PENDING state (countdown hasn't started yet)
        if (!product.isAuctionMode) {
          return NextResponse.json(
            { error: "Bu işlem sadece açık arttırma ürünleri için geçerlidir" },
            { status: 400 }
          );
        }

        // Check if countdown has already started (product has startTime and endTime)
        if (product.startTime && product.endTime) {
          return NextResponse.json(
            {
              error:
                "Geri sayım başladıktan sonra iptal edilemez. Lütfen 'Arttırmayı Sonlandır' seçeneğini kullanın.",
            },
            { status: 400 }
          );
        }

        // Get bid count for this auction
        const bidCount = await prisma.liveStreamBid.count({
          where: { liveStreamProductId: productId },
        });

        // Delete all bids for this product (refund scenario in real app)
        if (bidCount > 0) {
          await prisma.liveStreamBid.deleteMany({
            where: { liveStreamProductId: productId },
          });
        }

        // Delete the product
        await prisma.liveStreamProduct.delete({
          where: { id: productId },
        });

        // Emit socket event
        if ((global as any).socketIO) {
          (global as any).socketIO
            .to(`stream:${streamId}`)
            .emit("auction-cancelled", {
              streamId,
              productId,
              productName: product.title,
              bidCount: bidCount,
              timestamp: new Date().toISOString(),
            });
        }

        logger.info(
          `[API][/api/live-streams/${streamId}/product] Auction cancelled`,
          {
            userId: user.id,
            productId,
            productName: product.title,
            bidCount,
          }
        );

        return NextResponse.json({
          success: true,
          message:
            bidCount > 0
              ? `Açık arttırma iptal edildi. ${bidCount} teklif silindi.`
              : "Açık arttırma iptal edildi.",
          bidCount,
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    logger.info(
      `[API][/api/live-streams/${streamId}/product] Product updated`,
      {
        userId: user.id,
        productId,
        action,
      }
    );

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product] Error updating product:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}
