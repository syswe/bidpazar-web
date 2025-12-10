import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST - Purchase a stock sale product from a live stream
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
    const { quantity = 1 } = body;

    if (quantity <= 0) {
      return NextResponse.json(
        { error: "Valid quantity is required" },
        { status: 400 }
      );
    }

    // Find the live stream product and verify it's active
    const product = await prisma.liveStreamProduct.findUnique({
      where: { id: productId },
      include: {
        liveStream: true,
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
        { error: "Product is not active" },
        { status: 400 }
      );
    }

    if (product.isAuctionMode) {
      return NextResponse.json(
        { error: "This product is in auction mode, not available for direct purchase" },
        { status: 400 }
      );
    }

    // Check if there's enough stock
    if (product.stock < quantity) {
      return NextResponse.json(
        { error: `Not enough stock. Available: ${product.stock}, Requested: ${quantity}` },
        { status: 400 }
      );
    }

    // Prevent streamer from purchasing their own products
    if (product.liveStream.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot purchase your own products" },
        { status: 403 }
      );
    }

    // Create the purchase record and order
    // Update the stock and create Order record
    const updatedProduct = await prisma.liveStreamProduct.update({
      where: { id: productId },
      data: {
        stock: {
          decrement: quantity,
        },
        // If stock reaches 0, mark as sold out
        isActive: product.stock - quantity > 0,
      },
    });

    const totalPrice = product.currentPrice * quantity;

    // Generate order number
    const orderNumber = `BP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create Order record
    const order = await prisma.order.create({
      data: {
        orderNumber,
        buyerId: user.id,
        sellerId: product.liveStream.userId,
        liveStreamProductId: productId,
        liveStreamId: streamId,
        productTitle: product.title,
        productImage: product.imageUrl,
        price: totalPrice,
        status: "PENDING",
        type: "LIVE_STREAM_STOCK",
      },
    });

    // Log the purchase
    logger.info(
      `[API][/api/live-streams/${streamId}/product/${productId}/purchase] Product purchased`,
      {
        userId: user.id,
        productId,
        quantity,
        totalPrice,
        orderId: order.id,
        remainingStock: updatedProduct.stock,
      }
    );

    // Emit socket event for real-time updates
    if ((global as any).socketIO) {
      (global as any).socketIO.to(`stream:${streamId}`).emit("stock-purchased", {
        streamId,
        productId,
        userId: user.id,
        username: user.username,
        quantity,
        totalPrice,
        remainingStock: updatedProduct.stock,
        timestamp: new Date().toISOString(),
      });
    }

    // Create notifications for buyer and seller with order link
    // Notification for buyer
    await prisma.notification.create({
      data: {
        userId: user.id,
        content: `"${product.liveStream.title}" canlı yayınında "${product.title}" ürününü (${quantity} adet, ${totalPrice} TL) başarıyla satın aldınız.`,
        type: 'LIVE_STREAM_PURCHASE',
        relatedId: order.id,
        isRead: false,
      },
    });

    // Notification for seller
    await prisma.notification.create({
      data: {
        userId: product.liveStream.userId,
        content: `"${product.liveStream.title}" canlı yayınında "${product.title}" ürünü ${user.username} tarafından ${totalPrice} TL bedelle satın alındı.`,
        type: 'LIVE_STREAM_PURCHASE',
        relatedId: order.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      success: true,
      purchase: {
        productId,
        userId: user.id,
        username: user.username,
        quantity,
        totalPrice: product.currentPrice * quantity,
        remainingStock: updatedProduct.stock,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product/${productId}/purchase] Error purchasing product:`,
      error
    );
    return NextResponse.json({ error: "Failed to purchase product" }, { status: 500 });
  }
}

/**
 * GET - Get purchase history for a product (optional, for future use)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id: streamId, productId } = await params;

  try {
    // Find the product
    const product = await prisma.liveStreamProduct.findUnique({
      where: { id: productId },
      include: {
        liveStream: true,
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

    // For now, return basic product info
    // In the future, you might want to create a Purchase model and return purchase history
    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        currentPrice: product.currentPrice,
        stock: product.stock,
        isActive: product.isActive,
        isAuctionMode: product.isAuctionMode,
      },
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/product/${productId}/purchase] Error fetching product info:`,
      error
    );
    return NextResponse.json(
      { error: "Failed to fetch product info" },
      { status: 500 }
    );
  }
} 