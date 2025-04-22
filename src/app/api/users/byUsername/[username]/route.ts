import { NextRequest, NextResponse } from 'next/server';

// Removed sampleUsers array

// This handler function follows Next.js 15.2.2 pattern for dynamic routes
export async function GET(request: NextRequest) {
  // Extract username from the URL path
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const username = segments[segments.length - 1];

  try {
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

    // Important: Get API URL from environment with a proper fallback
    // We need to handle the case where the env var might be unavailable
    let apiBaseUrl = 'http://localhost:5001/api'; // Default fallback
    
    // Try to get from window.__ENV__ if in browser
    if (typeof window !== 'undefined' && window.__ENV__?.NEXT_PUBLIC_API_URL) {
      apiBaseUrl = window.__ENV__.NEXT_PUBLIC_API_URL;
    } 
    // Otherwise try process.env
    else if (process.env.NEXT_PUBLIC_API_URL) {
      apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    }
    
    // Ensure URL doesn't have duplicate /api
    const apiUrl = apiBaseUrl.endsWith('/api') 
      ? `${apiBaseUrl}/users/byUsername/${username}`
      : `${apiBaseUrl}/api/users/byUsername/${username}`;
    
    console.log(`Fetching user by username from: ${apiUrl}`);
    
    // Make the API request
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle the response
    if (!response.ok) {
      const errorMessage = await response.text();
      console.error(`Backend API error (${response.status}):`, errorMessage);
      
      try {
        // Try to parse error as JSON if possible
        const errorJson = JSON.parse(errorMessage);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        // Otherwise return as text
        return NextResponse.json(
          { error: errorMessage || `Error: ${response.status}` }, 
          { status: response.status }
        );
      }
    }

    // Parse and return successful response
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in users/byUsername API route:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend service' }, 
      { status: 503 }
    );
  }
}

// Add TypeScript interface for global window object with __ENV__
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_SOCKET_URL?: string;
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_WEBRTC_SERVER?: string;
    };
  }
}

// Removed the fallback logic that used sampleUsers

// Removed the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
// const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
// const apiUrl = baseUrl.endsWith('/api') 
//   ? `${baseUrl}/users/byUsername/${username}`
//   : `${baseUrl}/api/users/byUsername/${username}`;

// Directly fetch from the backend
// console.log(`Fetching user by username from: ${apiUrl}`);
// const response = await fetch(apiUrl, {
//   headers: {
//     'Authorization': `Bearer ${token}`,
//     'Content-Type': 'application/json',
//   },
// });

// Forward the backend response status and body
// const responseBody = await response.text();
// const status = response.status;

// Attempt to parse JSON, otherwise return text
// let data;
// try {
//   data = JSON.parse(responseBody);
// } catch (e) {
//   // If backend returned 404, keep the original error message if available
//   if (status === 404 && data?.error) {
//      // Keep backend's 404 error
//   } else {
//     data = { error: responseBody }; // Return raw text as error if not JSON
//   }
// }

// Return the backend response directly
// return NextResponse.json(data, { status }); 