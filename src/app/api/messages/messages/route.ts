import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Only check request headers for token (server-side can't access localStorage)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('API route /api/messages/messages: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, content, receiverId } = body;

    if (!conversationId || !content || !receiverId) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, content, receiverId' },
        { status: 400 }
      );
    }

    // Remove the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/messages`
      : `${baseUrl}/api/messages/messages`;
    
    console.log('Sending message to API:', apiUrl, {
      conversationId, content, receiverId
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, content, receiverId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
} 