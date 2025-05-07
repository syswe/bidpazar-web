import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getUserFromTokenInNode } from '@/lib/auth';

// Removed separate Context type alias

// GET /api/live-streams/{id}/check-streamer - Check if the authenticated user is the streamer for this stream
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  logger.info(`[API] GET ${urlPath}`, {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
  });

  try {
    // Extract the stream ID from params
    const { id: streamId } = await params;
    logger.info(`[API] GET ${urlPath} - Extracted streamId: ${streamId}`);

    // Extract token from authorization header or cookie with fallback options
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('token')?.value || request.cookies.get('next-auth.session-token')?.value;
    
    if (!token) {
      logger.warn(`[API] GET ${urlPath} - Missing authentication token`);
      return NextResponse.json(
        { isStreamer: false, reason: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn(`[API] GET ${urlPath} - Invalid token or user not found`);
      return NextResponse.json(
        { isStreamer: false, reason: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Find the stream and check if the user is the streamer
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { 
        userId: true,
        status: true,
        title: true 
      }
    });

    if (!stream) {
      logger.warn(`[API] GET ${urlPath} - Stream not found: ${streamId}`);
      return NextResponse.json(
        { isStreamer: false, reason: "Stream not found" },
        { status: 404 }
      );
    }

    // Check if the authenticated user is the streamer
    const isStreamer = stream.userId === user.id;
    logger.info(`[API] GET ${urlPath} - Result: isStreamer=${isStreamer}`, {
      streamId,
      userId: user.id,
      streamUserId: stream.userId,
      streamStatus: stream.status
    });

    return NextResponse.json({ 
      isStreamer,
      userId: user.id,
      streamUserId: stream.userId,
      streamStatus: stream.status,
      streamTitle: stream.title
    });
  } catch (error) {
    logger.error(`[API] Error in ${urlPath}`, error);
    return NextResponse.json(
      { isStreamer: false, reason: "Internal server error", error: String(error) },
      { status: 500 }
    );
  }
}
