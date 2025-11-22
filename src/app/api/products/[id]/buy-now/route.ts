import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, getTokenFromRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createOrderConversationMessage } from "@/lib/server/conversationMessaging";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;

  logger.info("API POST /api/products/[id]/buy-now", {
    productId,
    url: request.url,
  });

  try {
    // Verify authentication
    const token = getTokenFromRequest(request);

    if (!token) {
      logger.warn("Buy now attempt without authentication token", {
        productId,
        hasAuthHeader: !!request.headers.get("authorization"),
      });
      return NextResponse.json(
        { error: "Kimlik doğrulama gereklidir" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn("Buy now attempt with invalid token", { productId });
      return NextResponse.json(
        { error: "Kimlik doğrulama gereklidir" },
        { status: 401 }
      );
    }

    // Get the product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        user: {
          select: { id: true, username: true, email: true, name: true },
        },
      },
    });

    if (!product) {
      logger.warn("Buy now attempt for non-existent product", {
        productId,
        userId: user.id,
      });
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    // Check if product has buy now price
    if (!product.buyNowPrice) {
      logger.warn("Buy now attempt for product without buyNowPrice", {
        productId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Bu ürün için hemen al özelliği bulunmuyor" },
        { status: 400 }
      );
    }

    // Check if user is trying to buy their own product
    if (product.userId === user.id) {
      logger.warn("User trying to buy their own product", {
        productId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Kendi ürününüzü satın alamazsınız" },
        { status: 400 }
      );
    }

    // TODO: In a real app, you would:
    // 1. Process payment with payment provider (Stripe, PayPal, etc.)
    // 2. Create order record
    // 3. Update product status (sold/unavailable)
    // 4. Send notifications to buyer and seller
    // 5. Handle inventory management

    // For now, we'll create a simple purchase record
    const purchase = await prisma.$transaction(async (tx) => {
      // Mark product as sold
      await tx.product.update({
        where: { id: productId },
        data: {
          isSold: true,
          soldAt: new Date(),
          soldTo: user.id,
        },
      });

      // End active auction if exists
      const activeAuction = await tx.productAuction.findFirst({
        where: {
          productId: productId,
          status: 'ACTIVE',
        },
      });

      if (activeAuction) {
        await tx.productAuction.update({
          where: { id: activeAuction.id },
          data: {
            status: 'COMPLETED',
            endTime: new Date(),
          },
        });
        logger.info('Ended active auction after buy-now purchase', {
          auctionId: activeAuction.id,
          productId,
        });
      }

      // Create a purchase record (you might want to create a Purchase model)
      // For now, we'll create a notification for the seller
      await tx.notification.create({
        data: {
          userId: product.userId,
          content: `${user.username} kullanıcısı "${product.title}" ürününüzü ${product.buyNowPrice} ₺ karşılığında satın aldı.`,
          type: "PURCHASE",
          relatedId: productId,
        },
      });

      const conversationId = await createOrderConversationMessage({
        tx,
        buyer: {
          id: user.id,
          username: user.username,
          name: user.name,
        },
        seller: {
          id: product.userId,
          username: product.user?.username,
          name: product.user?.name,
        },
        product: {
          id: product.id,
          title: product.title,
        },
        price: product.buyNowPrice ?? 0, // Default to 0 if buyNowPrice is null
        context: "buy-now",
        skipBuyerNotification: true,
      });

      // Create notification for buyer with link to conversation
      await tx.notification.create({
        data: {
          userId: user.id,
          content: `"${product.title}" ürününü başarıyla satın aldınız. Hemen satıcı ile iletişime geçin.`,
          type: "PURCHASE",
          relatedId: conversationId,
        },
      });

      // You might want to mark the product as sold or reduce inventory
      // For now, we'll just return the purchase info
      return {
        productId: product.id,
        productTitle: product.title,
        buyerId: user.id,
        sellerId: product.userId,
        price: product.buyNowPrice,
        purchaseDate: new Date().toISOString(),
      };
    });

    logger.info("Buy now purchase completed", {
      productId,
      buyerId: user.id,
      sellerId: product.userId,
      price: product.buyNowPrice,
    });

    return NextResponse.json({
      success: true,
      purchase,
      message: "Ürün başarıyla satın alındı!",
    });
  } catch (error: any) {
    logger.error("Buy now purchase failed", {
      productId,
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: "Satın alma işlemi sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
