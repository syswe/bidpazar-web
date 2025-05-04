import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getUserFromTokenInNode } from '@/lib/auth';

// GET /api/live-streams/{id}/check-streamer - Check if the authenticated user is the streamer for this stream
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const streamId = params.id;
  logger.info('[API] GET /api/live-streams/[id]/check-streamer', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    streamId,
  });

  try {
    // Extract token from authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('token')?.value;
    
    if (!token) {
      logger.warn('[API] GET /api/live-streams/[id]/check-streamer - Missing authentication token');
      return NextResponse.json(
        { isStreamer: false, reason: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('[API] GET /api/live-streams/[id]/check-streamer - Invalid token or user not found');
      return NextResponse.json(
        { isStreamer: false, reason: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Find the stream and check if the user is the streamer
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { userId: true }
    });

    if (!stream) {
      logger.warn(`[API] GET /api/live-streams/[id]/check-streamer - Stream not found: ${streamId}`);
      return NextResponse.json(
        { isStreamer: false, reason: "Stream not found" },
        { status: 404 }
      );
    }

    // Check if the authenticated user is the streamer
    const isStreamer = stream.userId === user.id;
    logger.info(`[API] GET /api/live-streams/[id]/check-streamer - Result: isStreamer=${isStreamer}`, {
      streamId,
      userId: user.id,
      streamUserId: stream.userId
    });

    return NextResponse.json({ 
      isStreamer,
      userId: user.id,
      streamUserId: stream.userId
    });
  } catch (error) {
    logger.error('[API] Error in check-streamer endpoint', error);
    return NextResponse.json(
      { isStreamer: false, reason: "Internal server error" },
      { status: 500 }
    );
  }
}
