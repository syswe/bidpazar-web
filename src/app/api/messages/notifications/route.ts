import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Only check request headers for token (server-side can't access localStorage)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('API route /api/messages/notifications: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Remove the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/notifications`
      : `${baseUrl}/api/messages/notifications`;
    
    console.log('Fetching notifications from:', apiUrl);
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
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
} 