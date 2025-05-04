import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserFromTokenInNode } from '@/lib/auth';

// GET /api/live-streams/[id] - Get a specific stream
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  logger.info('API GET /api/live-streams/[id]', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    params: { id },
  });
  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        listings: {
          include: {
            product: true,
            bids: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                amount: 'desc',
              },
            },
          },
        },
        chatMessages: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    // Add the creatorId field to make it clear who created the stream
    const responseWithCreatorId = {
      ...stream,
      creatorId: stream.userId // Add creatorId field that matches the userId field
    };

    return NextResponse.json(responseWithCreatorId);
  } catch (error) {
    logger.error('Error fetching stream', error);
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    );
  }
}

// DELETE /api/live-streams/[id] - Delete a stream
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  logger.info('API DELETE /api/live-streams/[id]', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    params: { id },
  });
  try {
    // Extract token from authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('token')?.value;
    
    if (!token) {
      logger.warn('API DELETE /api/live-streams/[id] - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API DELETE /api/live-streams/[id] - Invalid token or user not found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this stream' },
        { status: 403 }
      );
    }

    await prisma.liveStream.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Stream deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error deleting stream', error);
    return NextResponse.json(
      { error: 'Failed to delete stream' },
      { status: 500 }
    );
  }
} 