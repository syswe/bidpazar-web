import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getUserFromTokenInNode } from '@/lib/auth';

// Constants
const SHARE_PLATFORMS = {
  TWITTER: 'TWITTER',
  FACEBOOK: 'FACEBOOK',
  WHATSAPP: 'WHATSAPP',
  TELEGRAM: 'TELEGRAM',
} as const;

type SharePlatform = keyof typeof SHARE_PLATFORMS;

// Validation schema
const shareSchema = z.object({
  platform: z.enum(['TWITTER', 'FACEBOOK', 'WHATSAPP', 'TELEGRAM'] as const),
  message: z.string().max(280).optional(),
});

// POST /api/live-streams/[id]/share - Share stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('API POST /api/live-streams/[id]/share', {
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
      logger.warn('API POST /api/live-streams/[id]/share - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API POST /api/live-streams/[id]/share - Invalid token or user not found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = shareSchema.parse(body);

    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!stream) {
      logger.warn(`API POST /api/live-streams/[id]/share - Stream not found: ${id}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    // Generate share URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bidpazar.com';
    const shareUrl = `${appUrl}/streams/${stream.id}`;
    logger.info(`API POST /api/live-streams/[id]/share - Generated URL: ${shareUrl}`);
    
    // Generate share message
    const defaultMessage = `Check out this live stream by @${stream.user.username} on BidPazar! ${shareUrl}`;
    const message = validatedData.message || defaultMessage;

    // Create share record
    const share = await prisma.streamShare.create({
      data: {
        liveStreamId: id,
        userId: user.id,
        platform: validatedData.platform,
        message,
      },
    });

    // Return share data
    logger.info(`API POST /api/live-streams/[id]/share - Successfully shared stream ${id}`);
    return NextResponse.json({
      url: shareUrl,
      message,
      platform: validatedData.platform,
      success: true
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('API POST /api/live-streams/[id]/share - Invalid input', { error: error.errors });
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error sharing stream:', error);
    return NextResponse.json(
      { error: 'Failed to share stream', message: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/live-streams/[id]/share - Get stream share stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('API GET /api/live-streams/[id]/share', {
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
      logger.warn('API GET /api/live-streams/[id]/share - Missing authentication token');
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn('API GET /api/live-streams/[id]/share - Invalid token or user not found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      logger.warn(`API GET /api/live-streams/[id]/share - Stream not found: ${id}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== user.id) {
      logger.warn(`API GET /api/live-streams/[id]/share - User ${user.id} not authorized to view share stats for stream ${id}`);
      return NextResponse.json(
        { error: 'Unauthorized to view share stats' },
        { status: 403 }
      );
    }

    // Get share stats
    const shares = await prisma.streamShare.groupBy({
      by: ['platform'],
      where: { liveStreamId: id },
      _count: {
        platform: true,
      },
    });

    type ShareCount = {
      platform: string;
      _count: {
        platform: number;
      };
    };

    const totalShares = shares.reduce((acc: number, curr: ShareCount) => acc + curr._count.platform, 0);
    logger.info(`API GET /api/live-streams/[id]/share - Successfully retrieved stats for stream ${id}, total shares: ${totalShares}`);
    
    return NextResponse.json({
      totalShares,
      sharesByPlatform: shares.reduce((acc: Record<string, number>, curr: ShareCount) => ({
        ...acc,
        [curr.platform]: curr._count.platform,
      }), {}),
    });
  } catch (error) {
    logger.error('Error fetching share stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share stats', message: String(error) },
      { status: 500 }
    );
  }
} 