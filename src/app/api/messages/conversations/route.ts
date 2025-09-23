import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    const userId = payload?.userId;
    if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { id: userId } },
      },
      include: {
        participants: {
          select: { id: true, username: true, name: true, userType: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
            sender: { select: { id: true, username: true, name: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = conversations.map((c) => ({
      id: c.id,
      updatedAt: c.updatedAt.toISOString(),
      participants: c.participants,
      latestMessage:
        c.messages.length > 0
          ? { ...c.messages[0], createdAt: c.messages[0].createdAt.toISOString() }
          : undefined,
      _count: c._count,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API][/api/messages/conversations] Error:', error);
    return NextResponse.json({ message: 'Failed to fetch conversations' }, { status: 500 });
  }
}
