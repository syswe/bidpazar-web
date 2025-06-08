import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth";
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  const headers = Object.fromEntries(req.headers.entries());
  logger.info(`[API][${urlPath}] POST request received`, { headers });
  
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
  logger.info(`[API][${urlPath}] Token found: ${!!token}`);

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
      notificationIds = body.notificationIds || [];
      logger.info(`[API][${urlPath}] Request body parsed`, { notificationIds });
    } catch (parseError) {
      logger.error(`[API][${urlPath}] Bad Request (400): Failed to parse request body.`, parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!Array.isArray(notificationIds)) {
      logger.warn(`[API][${urlPath}] Bad Request (400): notificationIds is not an array.`);
      return NextResponse.json({ error: "notificationIds must be an array" }, { status: 400 });
    }
    
    const userId = payload.userId;
    logger.info(`[API][${urlPath}] Marking message notifications as read for user: ${userId}`, { notificationIds });

    // Mark notifications as read - either specific ones or all
    if (notificationIds.length > 0) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // Ensure user owns these notifications
          type: 'MESSAGE'
        },
        data: {
          isRead: true
        }
      });
      logger.info(`[API][${urlPath}] Marked ${notificationIds.length} specific message notifications as read`);
    } else {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: {
          userId,
          type: 'MESSAGE',
          isRead: false
        },
        data: {
          isRead: true
        }
      });
      logger.info(`[API][${urlPath}] Marked all unread message notifications as read for user`);
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