import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { token } = getAuth();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract the conversation ID from the URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const conversationIndex = pathParts.indexOf('conversations');
    const conversationId = conversationIndex >= 0 ? pathParts[conversationIndex + 1] : null;
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID not found' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`, 
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
} 