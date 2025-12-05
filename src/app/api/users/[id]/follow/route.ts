import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// POST /api/users/[id]/follow - Follow a user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] POST request received to follow userId: ${targetUserId}`);

  try {
    // Extract token from authorization header
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const followerId = payload.userId;

    if (followerId === targetUserId) {
      return NextResponse.json(
        { error: "You cannot follow yourself" },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already following
    const existingFollow = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      return NextResponse.json(
        { error: "You are already following this user" },
        { status: 400 }
      );
    }

    // Create follow relationship
    await prisma.follows.create({
      data: {
        followerId,
        followingId: targetUserId,
      },
    });

    // Create notification for the target user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: "SYSTEM", // Or a new type like FOLLOW
        content: `${payload.username || "Bir kullanıcı"} sizi takip etmeye başladı.`,
        relatedId: followerId,
      },
    });

    logger.info(`[API][${url}] User ${followerId} followed ${targetUserId}`);

    return NextResponse.json({ success: true, message: "Followed successfully" });
  } catch (error) {
    logger.error(`[API][${url}] Error following user:`, error);
    return NextResponse.json(
      { error: "Failed to follow user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]/follow - Unfollow a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] DELETE request received to unfollow userId: ${targetUserId}`);

  try {
    // Extract token from authorization header
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const followerId = payload.userId;

    // Check if follow relationship exists
    const existingFollow = await prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUserId,
        },
      },
    });

    if (!existingFollow) {
      return NextResponse.json(
        { error: "You are not following this user" },
        { status: 400 }
      );
    }

    // Delete follow relationship
    await prisma.follows.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetUserId,
        },
      },
    });

    logger.info(`[API][${url}] User ${followerId} unfollowed ${targetUserId}`);

    return NextResponse.json({ success: true, message: "Unfollowed successfully" });
  } catch (error) {
    logger.error(`[API][${url}] Error unfollowing user:`, error);
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }
}
