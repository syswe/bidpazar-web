import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/live-streams/[id]/status - Get current stream status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Ensure params is awaited before accessing properties
  const { id } = await params;
  
  logger.info('API GET /api/live-streams/[id]/status', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    params: { id },
  });

  try {
    // Find the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        viewerCount: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!stream) {
      logger.warn(`API GET /api/live-streams/[id]/status - Stream not found: ${id}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    logger.info(`API GET /api/live-streams/[id]/status - Stream ${id} status: ${stream.status}`);
    return NextResponse.json({
      id: stream.id,
      status: stream.status,
      startTime: stream.startTime,
      endTime: stream.endTime,
      viewerCount: stream.viewerCount,
      creatorId: stream.userId,
      creator: stream.user,
    });
  } catch (error) {
    logger.error('Error getting stream status:', error);
    return NextResponse.json(
      { error: 'Failed to get stream status' },
      { status: 500 }
    );
  }
} 