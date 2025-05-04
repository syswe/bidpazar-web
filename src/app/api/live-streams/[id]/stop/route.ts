import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserFromTokenInNode } from '@/lib/auth';

// POST /api/live-streams/[id]/stop - End a live stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;
    
  logger.info('API POST /api/live-streams/[id]/stop', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    params: { id },
  });

    // Extract token from authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('token')?.value;
    
    if (!token) {
      logger.warn('API POST /api/live-streams/[id]/stop - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API POST /api/live-streams/[id]/stop - Invalid token or user not found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Find the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      logger.warn(`API POST /api/live-streams/[id]/stop - Stream not found: ${id}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    // Check if the user is the creator of the stream
    if (stream.userId !== user.id) {
      logger.warn(`API POST /api/live-streams/[id]/stop - User ${user.id} is not the creator of stream ${id}`);
      return NextResponse.json(
        { error: 'Unauthorized to stop this stream' },
        { status: 403 }
      );
    }

    // Check if the stream is already ended
    if (stream.status === 'ENDED') {
      logger.info(`API POST /api/live-streams/[id]/stop - Stream ${id} is already ended`);
      return NextResponse.json(
        { message: 'Stream is already ended', status: 'ENDED' },
        { status: 200 }
      );
    }

    // Check if the stream is scheduled (not live)
    if (stream.status === 'SCHEDULED') {
      logger.warn(`API POST /api/live-streams/[id]/stop - Cannot stop stream ${id} because it has not started yet`);
      return NextResponse.json(
        { error: 'Cannot stop a stream that has not started yet' },
        { status: 400 }
      );
    }

    // Update the stream status to ENDED
    const updatedStream = await prisma.liveStream.update({
      where: { id },
      data: {
        status: 'ENDED',
        endTime: new Date().toISOString(), // Store the end time
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    logger.info(`API POST /api/live-streams/[id]/stop - Stream ${id} stopped successfully`);
    return NextResponse.json(updatedStream);
  } catch (error) {
    logger.error('Error stopping stream:', error);
    return NextResponse.json(
      { error: 'Failed to stop stream' },
      { status: 500 }
    );
  }
} 