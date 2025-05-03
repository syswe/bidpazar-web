import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/live-streams/[id]/rewards/[rewardId]/claim - Claim a reward
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; rewardId: string }> }
) {
  try {
    const { id, rewardId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const reward = await prisma.streamReward.findUnique({
      where: { id: rewardId },
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
              liveStreamId: id,
            },
          },
        });
        meetsCondition = (viewTime?.durationInSeconds || 0) >= condition.value;
        break;

      case 'BID_COUNT':
        const bidCount = await prisma.bid.count({
          where: {
            userId: session.user.id,
            listing: {
              liveStreamId: id,
            },
          },
        });
        meetsCondition = bidCount >= condition.value;
        break;

      case 'MESSAGE_COUNT':
        const messageCount = await prisma.chatMessage.count({
          where: {
            userId: session.user.id,
            liveStreamId: id,
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
        where: { id: rewardId },
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