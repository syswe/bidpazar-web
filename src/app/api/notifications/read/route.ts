import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// Enable debug logs with DEBUG_NOTIFICATIONS=true
const DEBUG_NOTIFICATIONS = process.env.DEBUG_NOTIFICATIONS === 'true';

export async function POST(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  
  // Only log detailed request info in debug mode
  if (DEBUG_NOTIFICATIONS) {
    const headers = Object.fromEntries(req.headers.entries());
    logger.info(`[API][${urlPath}] POST request received`, { headers });
  }
  
  // Extract token from authorization header
  const authorization = req.headers.get('authorization');
  if (!authorization) {
    logger.error(`[API][${urlPath}] Unauthorized (401): No authorization header`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.error(`[API][${urlPath}] Unauthorized (401): Invalid authorization format`);
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

    let notificationIds: string[] = [];
    try {
      const body = await req.json();
      notificationIds = body.notificationIds;
      
      // Only log body parsing in debug mode
      if (DEBUG_NOTIFICATIONS) {
        logger.info(`[API][${urlPath}] Request body parsed`, { notificationIds });
      }
    } catch (parseError) {
      logger.error(`[API][${urlPath}] Bad Request (400): Failed to parse request body.`, parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!Array.isArray(notificationIds)) {
      logger.warn(`[API][${urlPath}] Bad Request (400): notificationIds is not an array.`);
      return NextResponse.json({ error: "notificationIds must be an array" }, { status: 400 });
    }
    
    const userId = payload.userId;
    
    // Only log operation details in debug mode
    if (DEBUG_NOTIFICATIONS) {
      logger.info(`[API][${urlPath}] Marking notifications as read for user: ${userId}`, { notificationIds });
    }

    // Mark specific notifications as read if IDs provided
    if (notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: userId
        },
        data: {
          isRead: true
        }
      });
      
      // Only log success in debug mode
      if (DEBUG_NOTIFICATIONS) {
        logger.info(`[API][${urlPath}] Marked ${notificationIds.length} notifications as read`);
      }
    } 
    // Or mark all as read if no specific IDs
    else {
      await prisma.notification.updateMany({
        where: {
          userId: userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });
      
      // Only log success in debug mode
      if (DEBUG_NOTIFICATIONS) {
        logger.info(`[API][${urlPath}] Marked all notifications as read for user: ${userId}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: notificationIds.length > 0 
        ? `${notificationIds.length} notifications marked as read`
        : "All notifications marked as read"
    });

  } catch (error: any) {
    logger.error(`[API][${urlPath}] Unexpected error in POST handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    logger.info(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 