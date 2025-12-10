import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromTokenInNode, getTokenFromRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";

// PUT /api/orders/[id]/status - Update order status (seller only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  logger.info("API PUT /api/orders/[id]/status", {
    orderId,
    url: request.url,
  });

  try {
    // Verify authentication
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: "Kimlik doğrulama gereklidir" },
        { status: 401 }
      );
    }

    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return NextResponse.json(
        { error: "Kimlik doğrulama gereklidir" },
        { status: 401 }
      );
    }

    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı" },
        { status: 404 }
      );
    }

    // Only seller can update order status
    if (order.sellerId !== user.id) {
      return NextResponse.json(
        { error: "Bu siparişin durumunu güncelleme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ["PENDING", "SHIPPING", "COMPLETED", "CANCELLED"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Geçersiz sipariş durumu" },
        { status: 400 }
      );
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    // Create notification for buyer about status change
    const statusMessages: Record<string, string> = {
      PENDING: "beklemede",
      SHIPPING: "kargoya verildi",
      COMPLETED: "tamamlandı",
      CANCELLED: "iptal edildi",
    };

    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        content: `"${order.productTitle}" siparişiniz ${statusMessages[status]}.`,
        type: "ORDER_STATUS",
        relatedId: orderId,
      },
    });

    logger.info(`Order ${orderId} status updated to ${status} by seller ${user.id}`);

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: "Sipariş durumu güncellendi",
    });
  } catch (error: any) {
    logger.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "Sipariş durumu güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
