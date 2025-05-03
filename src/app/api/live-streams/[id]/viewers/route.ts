import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/live-streams/[id]/viewers - Get stream viewers
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const viewers = await prisma.user.findMany({
      where: {
        viewedStreams: {
          some: {
            id: params.id,
          },
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
      },
    });

    return NextResponse.json(viewers);
  } catch (error) {
    console.error('Error fetching viewers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch viewers' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/viewers - Join stream as viewer
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    if (stream.status !== 'LIVE') {
      return NextResponse.json(
        { error: 'Cannot join inactive stream' },
        { status: 400 }
      );
    }

    // Add user to viewers
    await prisma.liveStream.update({
      where: { id: params.id },
      data: {
        viewers: {
          connect: {
            id: session.user.id,
          },
        },
        viewerCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json(
      { message: 'Successfully joined stream' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error joining stream:', error);
    return NextResponse.json(
      { error: 'Failed to join stream' },
      { status: 500 }
    );
  }
}

// DELETE /api/live-streams/[id]/viewers - Leave stream
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Remove user from viewers
    await prisma.liveStream.update({
      where: { id: params.id },
      data: {
        viewers: {
          disconnect: {
            id: session.user.id,
          },
        },
        viewerCount: {
          decrement: 1,
        },
      },
    });

    return NextResponse.json(
      { message: 'Successfully left stream' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error leaving stream:', error);
    return NextResponse.json(
      { error: 'Failed to leave stream' },
      { status: 500 }
    );
  }
} 