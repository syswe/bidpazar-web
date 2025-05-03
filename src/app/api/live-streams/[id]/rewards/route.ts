import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Constants
const REWARD_TYPES = {
  VIEWER: 'VIEWER',
  BIDDER: 'BIDDER',
  CHATTER: 'CHATTER',
} as const;

type RewardType = keyof typeof REWARD_TYPES;

// Validation schema
const rewardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  points: z.number().min(1),
  type: z.enum(['VIEWER', 'BIDDER', 'CHATTER'] as const),
  condition: z.object({
    type: z.enum(['VIEW_TIME', 'BID_COUNT', 'MESSAGE_COUNT'] as const),
    value: z.number().min(1),
  }),
});

// GET /api/live-streams/[id]/rewards - Get stream rewards
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rewards = await prisma.streamReward.findMany({
      where: { liveStreamId: id },
      include: {
        recipients: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(rewards);
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/rewards - Create a reward
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
    const validatedData = rewardSchema.parse(body);

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
        { error: 'Unauthorized to create rewards' },
        { status: 403 }
      );
    }

    const reward = await prisma.streamReward.create({
      data: {
        ...validatedData,
        liveStreamId: id,
        userIds: [], // Initialize empty array for recipients
      },
    });

    return NextResponse.json(reward, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating reward:', error);
    return NextResponse.json(
      { error: 'Failed to create reward' },
      { status: 500 }
    );
  }
} 