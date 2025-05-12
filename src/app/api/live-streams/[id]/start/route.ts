import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserFromTokenInNode } from '@/lib/auth';

// Import ExtendedHttpServer to access Socket.IO instance
import { ExtendedHttpServer } from '@/lib/socket/types';

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

    // Check if the stream is already live or starting
    if (stream.status === 'LIVE' || stream.status === 'STARTING') {
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
    // Allow restarting an ENDED stream by transitioning it to STARTING
    if (stream.status === 'ENDED') {
      logger.info(`API POST /api/live-streams/[id]/start - Stream ${id} was ENDED. Attempting to restart by setting to STARTING.`);
      // Proceed to update status to STARTING below, no error here.
    }

    // Update the stream status to STARTING (not directly to LIVE)
    const updatedStream = await prisma.liveStream.update({
      where: { id },
      data: {
        status: 'STARTING', // Changed from LIVE to STARTING
        endTime: null, // Clear any previous end time
        // startTime will be set when the stream actually goes LIVE via socketHandler
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
    
    // Check if there's an active Socket.IO server to notify about the stream state change
    try {
      // Access the global HTTP server to get the Socket.IO instance
      // @ts-ignore - Add ts-ignore to handle global.server access
      const httpServer = global.server as ExtendedHttpServer;
      if (httpServer && httpServer.io) {
        // Emit to any clients in the stream room that stream is STARTING
        httpServer.io.to(`stream:${id}`).emit('stream_state_changed', {
          streamId: id,
          status: 'STARTING',
          message: 'Stream is starting via API'
        });
        
        // Also emit a special event to trigger WebRTC setup in socketHandler
        httpServer.io.to(`stream:${id}`).emit('stream_starting', {
          streamId: id,
          userId: user.id,
          username: user.username
        });
        
        logger.info(`API POST /api/live-streams/[id]/start - Notified Socket.IO clients about stream ${id} starting`);
      }
    } catch (socketError) {
      // Don't fail the API call if Socket.IO notification fails
      logger.warn(`API POST /api/live-streams/[id]/start - Could not notify Socket.IO clients: ${socketError}`);
    }

    logger.info(`API POST /api/live-streams/[id]/start - Stream ${id} started successfully`);
    
    // Return a consistent response format
    return NextResponse.json({
      message: 'Stream starting process initiated',
      status: 'STARTING',
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