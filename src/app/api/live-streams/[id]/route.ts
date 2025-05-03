import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/live-streams/[id] - Get a specific stream
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  logger.info('API GET /api/live-streams/[id]', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    params,
  });
  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(stream);
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
  request: Request,
  { params }: { params: { id: string } }
) {
  logger.info('API DELETE /api/live-streams/[id]', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    params,
  });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stream = await prisma.liveStream.findUnique({
      where: { id: params.id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this stream' },
        { status: 403 }
      );
    }

    await prisma.liveStream.delete({
      where: { id: params.id },
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