import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ otherUserId: string }> }) {
  const otherUserId = (await params).otherUserId;
  try {
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    const userId = payload?.userId;
    if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    if (!otherUserId) return NextResponse.json({ message: 'User ID required' }, { status: 400 });
    if (otherUserId === userId) return NextResponse.json({ message: 'Cannot create conversation with yourself' }, { status: 400 });

    // Ensure other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: {
        id: true,
        username: true,
        name: true,
        userType: true,
      },
    });
    if (!otherUser) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    if (otherUser.userType !== 'SELLER') {
      return NextResponse.json({ message: 'Only sellers can be messaged' }, { status: 403 });
    }

    // Find existing conversation with both participants
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: userId } } },
          { participants: { some: { id: otherUserId } } },
        ],
      },
      include: {
        participants: {
          select: { id: true, username: true, name: true, userType: true },
        },
      },
    });

    let conversation = existing;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: {
            connect: [{ id: userId }, { id: otherUserId }],
          },
        },
        include: {
          participants: {
            select: { id: true, username: true, name: true, userType: true },
          },
        },
      });
    }

    return NextResponse.json({
      id: conversation.id,
      updatedAt: conversation.updatedAt.toISOString(),
      participants: conversation.participants,
    });
  } catch (error) {
    console.error('[API][/api/messages/conversations/[otherUserId]] Error:', error);
    return NextResponse.json({ message: 'Failed to get or create conversation' }, { status: 500 });
  }
}
