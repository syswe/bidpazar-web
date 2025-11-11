import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, getUserFromTokenInNode } from "@/lib/auth";

/**
 * PATCH /api/admin/products/[id]/feature
 * Toggle featured status of a product (Admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and admin status
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { isFeatured } = body;

    if (typeof isFeatured !== "boolean") {
      return NextResponse.json(
        { error: "isFeatured must be a boolean" },
        { status: 400 }
      );
    }

    // Update product featured status
    const product = await prisma.product.update({
      where: { id },
      data: { isFeatured },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: isFeatured
        ? "Product featured successfully"
        : "Product unfeatured successfully",
      product,
    });
  } catch (error) {
    console.error("[API] Error toggling product feature status:", error);
    return NextResponse.json(
      { error: "Failed to update product feature status" },
      { status: 500 }
    );
  }
}
