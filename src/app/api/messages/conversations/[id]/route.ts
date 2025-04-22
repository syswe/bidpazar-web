import { NextRequest, NextResponse } from 'next/server';

// Remove RouteParams type alias
// type RouteParams = {
//   params: {
//     id: string;
//   };
// };

export async function GET(request: NextRequest) {
  // Extract the other user ID from the URL path
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const otherUserId = segments[segments.length - 1];

  try {
    // Only check request headers for token (server-side can't access localStorage)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      console.error('API route /api/messages/conversations/[id]: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
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