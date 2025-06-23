import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { logger } from "@/lib/logger";

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
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      logger.warn("Buy now attempt without authentication token", {
        productId,
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
          select: { id: true, username: true, email: true },
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

      // Create notification for buyer
      await tx.notification.create({
        data: {
          userId: user.id,
          content: `"${product.title}" ürününü başarıyla satın aldınız. Satıcı ile iletişime geçebilirsiniz.`,
          type: "PURCHASE",
          relatedId: productId,
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
