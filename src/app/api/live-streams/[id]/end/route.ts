import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromTokenInNode } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { ExtendedHttpServer } from '@/lib/socket/types';

/**
 * @route POST /api/live-streams/[id]/end
 * @description End a live stream, updating its status to ENDING which will be finalized to ENDED by the WebRTC layer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;
    
    logger.info('API POST /api/live-streams/[id]/end', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id },
    });

    // Extract token from authorization header or cookie with fallback options
    const authHeader = request.headers.get('authorization');
    const tokenString = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('token')?.value || request.cookies.get('next-auth.session-token')?.value;
    
    if (!tokenString) {
      logger.warn('API POST /api/live-streams/[id]/end - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(tokenString);
    if (!user) {
      logger.warn('API POST /api/live-streams/[id]/end - Invalid token or user not found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Find the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true
      }
    });

    if (!stream) {
      logger.warn(`API POST /api/live-streams/[id]/end - Stream not found: ${id}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    // Verify that the current user is the stream owner
    if (stream.userId !== user.id) {
      logger.warn(`API POST /api/live-streams/[id]/end - User ${user.id} is not the creator of stream ${id}`);
      return NextResponse.json(
        { error: 'Only the stream owner can end the stream' },
        { status: 403 }
      );
    }

    // Verify the stream is in a valid state to be ended
    const validStates = ['LIVE', 'PAUSED', 'STARTING', 'INTERRUPTED'];
    if (!validStates.includes(stream.status)) {
      logger.warn(`API POST /api/live-streams/[id]/end - Cannot end stream in state: ${stream.status}`);
      return NextResponse.json(
        { 
          error: `Stream cannot be ended from ${stream.status} state`,
          currentStatus: stream.status,
          validStatuses: validStates
        },
        { status: 400 }
      );
    }

    // Update the stream status to ENDING
    // The actual ENDED state will be set by the WebRTC layer after resources are cleaned up
    const updatedStream = await prisma.liveStream.update({
      where: { id },
      data: {
        status: 'ENDING'
      }
    });

    // Notify WebRTC layer about the state change
    try {
      // Access the global HTTP server to get the Socket.IO instance
      // @ts-ignore - Add ts-ignore to handle global.server access
      const httpServer = global.server as ExtendedHttpServer;
      if (httpServer && httpServer.io) {
        httpServer.io.to(`stream:${id}`).emit('stream_state_changed', {
          streamId: id,
          status: 'ENDING',
          userId: user.id,
          source: 'api'
        });
        
        // Also emit a more specific event for this action
        httpServer.io.to(`stream:${id}`).emit('stream_ending', {
          streamId: id,
          userId: user.id
        });
        
        logger.info(`API POST /api/live-streams/[id]/end - Notified Socket.IO clients about stream ${id} ending`);
      }
    } catch (socketError) {
      // Don't fail the API call if Socket.IO notification fails
      logger.warn(`API POST /api/live-streams/[id]/end - Could not notify Socket.IO clients: ${socketError}`);
    }

    logger.info(`Stream ${id} ending initiated by user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Stream ending initiated',
      stream: {
        id: updatedStream.id,
        status: updatedStream.status
      }
    });
  } catch (error) {
    logger.error('Error ending stream:', error);
    return NextResponse.json(
      { error: 'An error occurred while ending the stream', message: String(error) },
      { status: 500 }
    );
  }
}
