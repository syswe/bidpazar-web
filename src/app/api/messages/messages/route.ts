import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token } = getAuth();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, content, receiverId } = body;

    if (!conversationId || !content || !receiverId) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, content, receiverId' },
        { status: 400 }
      );
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, content, receiverId }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
} 