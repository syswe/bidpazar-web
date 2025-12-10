import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromTokenInNode, getTokenFromRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/orders - List orders for current user
export async function GET(request: NextRequest) {
  logger.info("API GET /api/orders", {
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

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "all"; // buyer, seller, or all
    const status = searchParams.get("status"); // PENDING, SHIPPING, COMPLETED, CANCELLED

    // Build where clause based on role
    let whereClause: any = {};
    
    if (role === "buyer") {
      whereClause.buyerId = user.id;
    } else if (role === "seller") {
      whereClause.sellerId = user.id;
    } else {
      // all - get both buyer and seller orders
      whereClause.OR = [
        { buyerId: user.id },
        { sellerId: user.id }
      ];
    }

    // Add status filter if provided
    if (status) {
      whereClause.status = status;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform orders to include role information
    const transformedOrders = orders.map((order) => ({
      ...order,
      userRole: order.buyerId === user.id ? "buyer" : "seller",
      otherParty: order.buyerId === user.id ? order.seller : order.buyer,
    }));

    logger.info(`Fetched ${orders.length} orders for user ${user.id}`);

    return NextResponse.json({
      orders: transformedOrders,
      total: orders.length,
    });
  } catch (error: any) {
    logger.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Siparişler yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
