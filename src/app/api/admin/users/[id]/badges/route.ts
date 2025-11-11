import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, getUserFromTokenInNode } from "@/lib/auth";

/**
 * PATCH /api/admin/users/[id]/badges
 * Update user badges (isPopularStreamer, isFavoriteSeller) - Admin only
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

    const adminUser = await getUserFromTokenInNode(token);
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!adminUser.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { isPopularStreamer, isFavoriteSeller } = body;

    // Build update data
    const updateData: any = {};
    if (typeof isPopularStreamer === "boolean") {
      updateData.isPopularStreamer = isPopularStreamer;
    }
    if (typeof isFavoriteSeller === "boolean") {
      updateData.isFavoriteSeller = isFavoriteSeller;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "At least one badge field must be provided" },
        { status: 400 }
      );
    }

    // Update user badges
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        userType: true,
        isPopularStreamer: true,
        isFavoriteSeller: true,
        isVerified: true,
      },
    });

    return NextResponse.json({
      message: "User badges updated successfully",
      user,
    });
  } catch (error) {
    console.error("[API] Error updating user badges:", error);
    return NextResponse.json(
      { error: "Failed to update user badges" },
      { status: 500 }
    );
  }
}
