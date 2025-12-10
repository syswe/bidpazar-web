import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

// GET /api/users/[id] - Get user by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] GET request received for userId: ${userId}`);

  try {
    // Check if the request is authenticated (optional for public profile, but needed for isFollowing)
    const authorization = req.headers.get("authorization");
    let currentUserId: string | null = null;

    if (authorization) {
      const parts = authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        const payload = await verifyToken(parts[1]);
        if (payload) {
          currentUserId = payload.userId;
        }
      }
    }

    // Check if the target user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true, // Maybe hide email for public? keeping for now as per original
        username: true,
        name: true,
        phoneNumber: true, // Maybe hide?
        isVerified: true,
        isAdmin: true,
        userType: true,
        isPopularStreamer: true,
        isFavoriteSeller: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      logger.error(`[API][${url}] Not found (404): User does not exist`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let isFollowing = false;
    if (currentUserId) {
      const follow = await prisma.follows.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId,
          },
        },
      });
      isFollowing = !!follow;
    }

    return NextResponse.json({
      ...user,
      isFollowing,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    });
  } catch (error) {
    logger.error(`[API][${url}] Error getting user:`, error);
    return NextResponse.json(
      { error: "Failed to get user information" },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] PUT request received for userId: ${userId}`);

  try {
    // Extract token from authorization header
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      logger.error(`[API][${url}] Unauthorized (401): No authorization header`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.error(
        `[API][${url}] Unauthorized (401): Invalid authorization format`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin (only admins can update other users)
    if (!payload.isAdmin && payload.userId !== userId) {
      logger.error(`[API][${url}] Forbidden (403): User is not authorized`);
      return NextResponse.json(
        { error: "Forbidden: Not authorized to update this user" },
        { status: 403 }
      );
    }

    // Check if the target user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      logger.error(`[API][${url}] Not found (404): User does not exist`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();

    // Only allow admins to change admin status
    if ("isAdmin" in body && !payload.isAdmin) {
      delete body.isAdmin;
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        phoneNumber: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`[API][${url}] User updated successfully`, {
      userId: updatedUser.id,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    logger.error(`[API][${url}] Error updating user:`, error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] DELETE request received for userId: ${userId}`);

  try {
    // Extract token from authorization header
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      logger.error(`[API][${url}] Unauthorized (401): No authorization header`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.error(
        `[API][${url}] Unauthorized (401): Invalid authorization format`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin (only admins can delete users)
    if (!payload.isAdmin) {
      logger.error(`[API][${url}] Forbidden (403): User is not an admin`);
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Check if the target user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.error(`[API][${url}] Not found (404): User does not exist`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user data in related tables to handle cascading deletes manually
    // since Prisma doesn't support cascading deletes directly

    // Delete user's chat messages
    await prisma.chatMessage.deleteMany({
      where: { userId },
    });

    // Delete user's bids
    await prisma.bid.deleteMany({
      where: { userId },
    });

    // Delete user's notifications
    await prisma.notification.deleteMany({
      where: { userId },
    });

    // Delete user's messages
    await prisma.message.deleteMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    });

    // Delete user's stream shares
    await prisma.streamShare.deleteMany({
      where: { userId },
    });

    // Delete user's stream view times
    await prisma.streamViewTime.deleteMany({
      where: { userId },
    });

    // Delete user's stream moderations
    await prisma.streamModeration.deleteMany({
      where: { userId },
    });

    // Delete user's products (first delete product media)
    const userProducts = await prisma.product.findMany({
      where: { userId },
      select: { id: true },
    });
    
    for (const product of userProducts) {
      await prisma.productMedia.deleteMany({
        where: { productId: product.id },
      });
    }
    
    await prisma.product.deleteMany({
      where: { userId },
    });

    // Delete user's live streams (first delete related data)
    const userStreams = await prisma.liveStream.findMany({
      where: { userId },
      select: { id: true },
    });
    
    for (const stream of userStreams) {
      // Delete live stream products and their bids
      const streamProducts = await prisma.liveStreamProduct.findMany({
        where: { liveStreamId: stream.id },
        select: { id: true },
      });
      
      for (const product of streamProducts) {
        await prisma.liveStreamBid.deleteMany({
          where: { liveStreamProductId: product.id },
        });
      }
      
      await prisma.liveStreamProduct.deleteMany({
        where: { liveStreamId: stream.id },
      });
      
      // Delete stream analytics, highlights, rewards
      await prisma.streamAnalytics.deleteMany({
        where: { liveStreamId: stream.id },
      });
      await prisma.streamHighlight.deleteMany({
        where: { liveStreamId: stream.id },
      });
      await prisma.streamReward.deleteMany({
        where: { liveStreamId: stream.id },
      });
    }
    
    await prisma.liveStream.deleteMany({
      where: { userId },
    });

    // Delete user's seller requests
    await prisma.sellerRequest.deleteMany({
      where: { userId },
    });

    // Delete user's follow relationships
    await prisma.follows.deleteMany({
      where: {
        OR: [{ followerId: userId }, { followingId: userId }],
      },
    });

    // Delete user's live stream bids
    await prisma.liveStreamBid.deleteMany({
      where: { userId },
    });

    // Delete user's orders
    await prisma.order.deleteMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
    });

    // Finally delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.info(`[API][${url}] User deleted successfully:`, { userId });
    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error(`[API][${url}] Error deleting user:`, error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
