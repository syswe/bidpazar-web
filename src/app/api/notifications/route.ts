import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// Enable debug logs with DEBUG_NOTIFICATIONS=true
const DEBUG_NOTIFICATIONS = process.env.DEBUG_NOTIFICATIONS === 'true';

export async function GET(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  
  // Only log detailed request info in debug mode
  if (DEBUG_NOTIFICATIONS) {
    const headers = Object.fromEntries(req.headers.entries());
    const query = Object.fromEntries(req.nextUrl.searchParams.entries());
    logger.info(`[API][${urlPath}] GET request received`, { headers, query });
  }

  // Extract token from authorization header
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    logger.error(
      `[API][${urlPath}] Unauthorized (401): No authorization header`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    logger.error(
      `[API][${urlPath}] Unauthorized (401): Invalid authorization format`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = parts[1];
  
  // Only log token presence in debug mode
  if (DEBUG_NOTIFICATIONS) {
    logger.info(`[API][${urlPath}] Token found: ${!!token}`);
  }

  try {
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${urlPath}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user data from token
    const userData = await getUserFromTokenInNode(token);
    if (!userData) {
      logger.error(`[API][${urlPath}] Unauthorized (401): User not found`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload.userId;
    
    // Only log successful operations in debug mode
    if (DEBUG_NOTIFICATIONS) {
      logger.info(`[API][${urlPath}] Fetching notifications for user: ${userId}`);
    }

    // Query notifications from database using Prisma
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    // Only log success in debug mode
    if (DEBUG_NOTIFICATIONS) {
      logger.info(`[API][${urlPath}] Successfully processed ${notifications.length} notifications from database.`,
        { count: notifications.length, unreadCount }
      );
    }

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    logger.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    logger.info(
      `[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`
    );
    return NextResponse.json(
      {
        error: errorMessage,
        notifications: [],
        unreadCount: 0,
      },
      { status: errorStatus }
    );
  }
}
