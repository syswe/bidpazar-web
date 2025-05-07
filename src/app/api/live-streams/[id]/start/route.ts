import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserFromTokenInNode } from '@/lib/auth';

// POST /api/live-streams/[id]/start - Start a live stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;
    
    logger.info('API POST /api/live-streams/[id]/start', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id },
    });

    // Extract token from authorization header or cookie with fallback options
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('token')?.value || request.cookies.get('next-auth.session-token')?.value;
    
    if (!token) {
      logger.warn('API POST /api/live-streams/[id]/start - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API POST /api/live-streams/[id]/start - Invalid token or user not found');
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
      logger.warn(`API POST /api/live-streams/[id]/start - Stream not found: ${id}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    // Check if the user is the creator of the stream
    if (stream.userId !== user.id) {
      logger.warn(`API POST /api/live-streams/[id]/start - User ${user.id} is not the creator of stream ${id}`);
      return NextResponse.json(
        { error: 'Unauthorized to start this stream' },
        { status: 403 }
      );
    }

    // Check if the stream is already live
    if (stream.status === 'LIVE') {
      logger.info(`API POST /api/live-streams/[id]/start - Stream ${id} is already live`);
      return NextResponse.json({
        message: 'Stream is already live',
        status: 'LIVE',
        stream: {
          id: stream.id,
          title: stream.title,
          status: stream.status,
          startTime: stream.startTime,
          userId: stream.userId
        }
      }, { status: 200 });
    }

    // Check if the stream has ended
    if (stream.status === 'ENDED') {
      logger.warn(`API POST /api/live-streams/[id]/start - Cannot start stream ${id} because it has ended`);
      return NextResponse.json(
        { error: 'Cannot start a stream that has ended' },
        { status: 400 }
      );
    }

    // Update the stream status to LIVE
    const updatedStream = await prisma.liveStream.update({
      where: { id },
      data: {
        status: 'LIVE',
        startTime: new Date().toISOString(), // Set the start time to now
        endTime: null, // Clear any previous end time
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

    logger.info(`API POST /api/live-streams/[id]/start - Stream ${id} started successfully`);
    
    // Return a consistent response format
    return NextResponse.json({
      message: 'Stream started successfully',
      status: 'LIVE',
      stream: updatedStream
    });
  } catch (error) {
    logger.error('Error starting stream:', error);
    return NextResponse.json(
      { error: 'Failed to start stream', message: String(error) },
      { status: 500 }
    );
  }
} 