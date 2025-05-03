import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema
const moderationSchema = z.object({
  userId: z.string(),
  action: z.enum(['BAN', 'TIMEOUT', 'WARN', 'DELETE_MESSAGE']),
  reason: z.string().optional(),
  duration: z.number().optional(), // Duration in minutes for timeout
});

// GET /api/live-streams/[id]/moderation - Get moderation history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view moderation history' },
        { status: 403 }
      );
    }

    const moderations = await prisma.streamModeration.findMany({
      where: { liveStreamId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(moderations);
  } catch (error) {
    console.error('Error fetching moderation history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation history' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/moderation - Create a moderation action
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = moderationSchema.parse(body);

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to moderate this stream' },
        { status: 403 }
      );
    }

    const moderation = await prisma.streamModeration.create({
      data: {
        ...validatedData,
        liveStreamId: id,
        userId: session.user.id,
      },
    });

    return NextResponse.json(moderation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating moderation action:', error);
    return NextResponse.json(
      { error: 'Failed to create moderation action' },
      { status: 500 }
    );
  }
} 