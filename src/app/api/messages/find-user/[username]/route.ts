import { NextRequest, NextResponse } from 'next/server';

// Special route to find users through the messages API (bypassing user routes issue)
export async function GET(request: NextRequest) {
  try {
    // Extract username from URL path
    const { pathname } = request.nextUrl;
    const segments = pathname.split('/').filter(Boolean);
    const username = segments[segments.length - 1];
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Get auth token from headers
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('API route: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Create API URL using messages API (not user API)
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/find-user/${username}`
      : `${baseUrl}/api/messages/find-user/${username}`;
    
    console.log(`Finding user through messages API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      
      try {
        // Try to parse as JSON if possible
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        // Otherwise return as text
        return NextResponse.json(
          { error: errorText || `Error: ${response.status}` }, 
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error finding user:', error);
    return NextResponse.json(
      { error: 'Failed to find user' }, 
      { status: 500 }
    );
  }
} 