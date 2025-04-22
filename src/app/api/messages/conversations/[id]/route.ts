import { NextRequest, NextResponse } from 'next/server';
import { getToken } from "@/lib/auth";
import { env } from "@/lib/env"; // Import env config

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

  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    const apiUrl = baseUrl.endsWith('/api')
      ? `${baseUrl}/messages/conversations/${otherUserId}`
      : `${baseUrl}/api/messages/conversations/${otherUserId}`;

    console.log(`Getting or creating conversation with user: ${otherUserId}, URL: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
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