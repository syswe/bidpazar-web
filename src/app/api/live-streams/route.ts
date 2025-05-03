import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// Constants
const STREAM_STATUS = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'] as const;
type StreamStatus = typeof STREAM_STATUS[number];

// Validation schemas
const createStreamSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional(),
  startTime: z.string().datetime().optional(),
});

const updateStreamSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().optional(),
  status: z.enum(STREAM_STATUS).optional(),
});

// GET /api/live-streams - List all streams
export async function GET(request: Request) {
  logger.info('API GET /api/live-streams', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    query: new URL(request.url).searchParams.toString(),
  });
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as StreamStatus | null;
    const userId = searchParams.get('userId');
    
    const where: Prisma.LiveStreamWhereInput = {
      ...(status && { status: status }),
      ...(userId && { userId }),
    };

    const streams = await prisma.liveStream.findMany({
      where,
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(streams);
  } catch (error) {
    logger.error('Error fetching streams', error);
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams - Create a new stream
export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API POST /api/live-streams', { headers, body });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const validatedData = createStreamSchema.parse(body);

    const stream = await prisma.liveStream.create({
      data: {
        ...validatedData,
        userId: session.user.id,
        status: 'SCHEDULED',
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

    return NextResponse.json(stream, { status: 201 });
  } catch (error) {
    logger.error('Error creating stream', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create stream' },
      { status: 500 }
    );
  }
}

// PUT /api/live-streams - Update a stream
export async function PUT(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API PUT /api/live-streams', { headers, body });
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Stream ID is required' },
        { status: 400 }
      );
    }

    // Check if user owns the stream
    const existingStream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!existingStream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (existingStream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this stream' },
        { status: 403 }
      );
    }

    const validatedData = updateStreamSchema.parse(updateData);

    const stream = await prisma.liveStream.update({
      where: { id },
      data: validatedData,
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
          },
        },
      },
    });

    return NextResponse.json(stream);
  } catch (error) {
    logger.error('Error updating stream', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update stream' },
      { status: 500 }
    );
  }
} 