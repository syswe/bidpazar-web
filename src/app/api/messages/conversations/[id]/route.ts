import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Only check request headers for token (server-side can't access localStorage)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('API route /api/messages/conversations/[id]: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Extract the user ID from the URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const conversationIndex = pathParts.indexOf('conversations');
    const otherUserId = conversationIndex >= 0 ? pathParts[conversationIndex + 1] : null;
    
    if (!otherUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Remove the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/conversations/${otherUserId}`
      : `${baseUrl}/api/messages/conversations/${otherUserId}`;
    
    console.log(`Getting or creating conversation with user: ${otherUserId}, URL: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    console.error('Error getting or creating conversation:', error);
    return NextResponse.json({ error: 'Failed to get or create conversation' }, { status: 500 });
  }
} 