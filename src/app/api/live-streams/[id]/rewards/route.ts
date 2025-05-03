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
  { params }: { params: { id: string } }
) {
  try {
    const rewards = await prisma.streamReward.findMany({
      where: { liveStreamId: params.id },
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
    const validatedData = rewardSchema.parse(body);

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
        { error: 'Unauthorized to create rewards' },
        { status: 403 }
      );
    }

    const reward = await prisma.streamReward.create({
      data: {
        ...validatedData,
        liveStreamId: params.id,
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

// POST /api/live-streams/[id]/rewards/[rewardId]/claim - Claim a reward
export async function POST_CLAIM(
  request: Request,
  { params }: { params: { id: string; rewardId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reward = await prisma.streamReward.findUnique({
      where: { id: params.rewardId },
      include: {
        liveStream: true,
        recipients: true,
      },
    });

    if (!reward) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      );
    }

    // Check if user has already claimed this reward
    if (reward.recipients.some((user: { id: string }) => user.id === session.user.id)) {
      return NextResponse.json(
        { error: 'Reward already claimed' },
        { status: 400 }
      );
    }

    // Check if user meets the reward conditions
    let meetsCondition = false;
    const condition = reward.condition as { type: string; value: number };
    
    switch (condition.type) {
      case 'VIEW_TIME':
        const viewTime = await prisma.streamViewTime.findUnique({
          where: {
            userId_liveStreamId: {
              userId: session.user.id,
              liveStreamId: params.id,
            },
          },
        });
        meetsCondition = viewTime?.durationInSeconds >= condition.value;
        break;

      case 'BID_COUNT':
        const bidCount = await prisma.bid.count({
          where: {
            userId: session.user.id,
            listing: {
              liveStreamId: params.id,
            },
          },
        });
        meetsCondition = bidCount >= condition.value;
        break;

      case 'MESSAGE_COUNT':
        const messageCount = await prisma.chatMessage.count({
          where: {
            userId: session.user.id,
            liveStreamId: params.id,
          },
        });
        meetsCondition = messageCount >= condition.value;
        break;
    }

    if (!meetsCondition) {
      return NextResponse.json(
        { error: 'Conditions not met for claiming reward' },
        { status: 400 }
      );
    }

    // Add user to reward recipients and update points
    const [updatedReward, updatedUser] = await prisma.$transaction([
      prisma.streamReward.update({
        where: { id: params.rewardId },
        data: {
          recipients: {
            connect: {
              id: session.user.id,
            },
          },
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          points: {
            increment: reward.points,
          },
        },
      }),
    ]);

    return NextResponse.json(
      { message: 'Reward claimed successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error claiming reward:', error);
    return NextResponse.json(
      { error: 'Failed to claim reward' },
      { status: 500 }
    );
  }
} 