import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/products/featured
 * Retrieves featured products (randomized)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 6;

    // Get all featured products with active auctions
    const featuredProducts = await prisma.product.findMany({
      where: {
        isFeatured: true,
        auctions: {
          some: {
            status: "ACTIVE",
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            isVerified: true,
            userType: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            emoji: true,
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            type: true,
          },
        },
        auctions: {
          where: {
            status: "ACTIVE",
          },
          include: {
            bids: {
              orderBy: {
                amount: "desc",
              },
              take: 1,
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Randomize the results
    const shuffled = featuredProducts.sort(() => Math.random() - 0.5);
    const limited = shuffled.slice(0, limit);

    return NextResponse.json({
      products: limited,
      total: featuredProducts.length,
    });
  } catch (error) {
    console.error("[API] Error fetching featured products:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured products" },
      { status: 500 }
    );
  }
}
