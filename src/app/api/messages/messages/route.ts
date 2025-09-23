import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    const userId = payload?.userId;
    if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { conversationId, content, receiverId } = await request.json();
    if (!conversationId || !content || !receiverId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Ensure sender is participant in the conversation
    const convo = await prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { id: userId } } },
      include: { participants: true },
    });
    if (!convo) return NextResponse.json({ message: 'Conversation not found or access denied' }, { status: 404 });

    // Ensure the receiver is part of the conversation
    const receiverInConversation = convo.participants.some(
      (participant) => participant.id === receiverId
    );
    if (!receiverInConversation) {
      return NextResponse.json(
        { message: 'Receiver is not part of this conversation' },
        { status: 400 }
      );
    }

    // Create message
    const msg = await prisma.message.create({
      data: {
        content,
        senderId: userId,
        receiverId,
        conversationId,
      },
      select: {
        id: true,
        content: true,
        senderId: true,
        receiverId: true,
        conversationId: true,
        createdAt: true,
        sender: { select: { id: true, username: true, name: true } },
      },
    });

    // Touch conversation updatedAt
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    // Create notification for the receiver so message shows up across platforms
    if (receiverId !== userId) {
      const senderLabel = msg.sender?.name || msg.sender?.username || 'Bir kullanıcı';
      const normalizedContent = msg.content.replace(/\s+/g, ' ').trim();
      const preview = normalizedContent.length > 120
        ? `${normalizedContent.slice(0, 117)}...`
        : normalizedContent;

      await prisma.notification.create({
        data: {
          userId: receiverId,
          content: `${senderLabel} size yeni bir mesaj gönderdi: ${preview || 'Yeni bir mesajınız var.'}`,
          type: 'MESSAGE',
          relatedId: conversationId,
        },
      });
    }

    return NextResponse.json({ ...msg, createdAt: msg.createdAt.toISOString() });
  } catch (error) {
    console.error('[API][/api/messages/messages] Error:', error);
    return NextResponse.json({ message: 'Failed to send message' }, { status: 500 });
  }
}
