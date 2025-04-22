import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extract the conversation ID from the URL path
    const { pathname } = request.nextUrl;
    const segments = pathname.split('/').filter(Boolean);
    const conversationId = segments[segments.length - 1];

    // Only check request headers for token (server-side can't access localStorage)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('API route /api/messages/conversations/fetch/[id]: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Remove the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const messagesUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/conversations/${conversationId}/messages`
      : `${baseUrl}/api/messages/conversations/${conversationId}/messages`;
    
    console.log(`Fetching conversation messages: ${conversationId}, URL: ${messagesUrl}`);
    const response = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      return NextResponse.json({ error: `Backend API error: ${response.status}` }, { status: response.status });
    }

    const messages = await response.json();

    // Also fetch conversation details to get participants
    const detailsUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/conversations/details/${conversationId}`
      : `${baseUrl}/api/messages/conversations/details/${conversationId}`;
    console.log(`Fetching conversation details: ${conversationId}, URL: ${detailsUrl}`);
    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let participants = [];
    if (detailsResponse.ok) {
      const details = await detailsResponse.json();
      participants = details.participants || [];
    } else {
      console.error(`Failed to fetch conversation details: ${detailsResponse.status}`);
    }

    // Combine the data and return
    return NextResponse.json({ id: conversationId, messages, participants });
  } catch (error) {
    console.error('Error fetching conversation by ID:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
} 