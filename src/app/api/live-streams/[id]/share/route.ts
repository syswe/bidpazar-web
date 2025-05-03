import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

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

    const body = await request.json();
    const validatedData = shareSchema.parse(body);

    const stream = await prisma.liveStream.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            username: true,
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

    // Generate share URL
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/streams/${stream.id}`;
    
    // Generate share message
    const defaultMessage = `Check out this live stream by @${stream.user.username} on BidPazar! ${shareUrl}`;
    const message = validatedData.message || defaultMessage;

    // Create share record
    const share = await prisma.streamShare.create({
      data: {
        liveStreamId: params.id,
        userId: session.user.id,
        platform: validatedData.platform,
        message,
      },
    });

    // Return share data
    return NextResponse.json({
      url: shareUrl,
      message,
      platform: validatedData.platform,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error sharing stream:', error);
    return NextResponse.json(
      { error: 'Failed to share stream' },
      { status: 500 }
    );
  }
}

// GET /api/live-streams/[id]/share - Get stream share stats
export async function GET(
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

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view share stats' },
        { status: 403 }
      );
    }

    // Get share stats
    const shares = await prisma.streamShare.groupBy({
      by: ['platform'],
      where: { liveStreamId: params.id },
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

    return NextResponse.json({
      totalShares,
      sharesByPlatform: shares.reduce((acc: Record<string, number>, curr: ShareCount) => ({
        ...acc,
        [curr.platform]: curr._count.platform,
      }), {}),
    });
  } catch (error) {
    console.error('Error fetching share stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share stats' },
      { status: 500 }
    );
  }
} 