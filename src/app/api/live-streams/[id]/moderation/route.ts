import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromTokenInNode } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Validation schema
const moderationSchema = z.object({
  userId: z.string(),
  action: z.enum(['BAN', 'TIMEOUT', 'WARN', 'DELETE_MESSAGE']),
  reason: z.string().optional(),
  duration: z.number().optional(), // Duration in minutes for timeout
});

// GET /api/live-streams/[id]/moderation - Get moderation history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('API GET /api/live-streams/[id]/moderation', {
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
      logger.warn('API GET /api/live-streams/[id]/moderation - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API GET /api/live-streams/[id]/moderation - Invalid token or user not found');
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
    logger.error('Error fetching moderation history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation history' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/moderation - Create a moderation action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('API POST /api/live-streams/[id]/moderation', {
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
      logger.warn('API POST /api/live-streams/[id]/moderation - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API POST /api/live-streams/[id]/moderation - Invalid token or user not found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
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

    if (stream.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to moderate this stream' },
        { status: 403 }
      );
    }

    const moderation = await prisma.streamModeration.create({
      data: {
        ...validatedData,
        liveStreamId: id,
        userId: user.id, // Use the correct field name according to the schema
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
    logger.error('Error creating moderation action:', error);
    return NextResponse.json(
      { error: 'Failed to create moderation action' },
      { status: 500 }
    );
  }
} 