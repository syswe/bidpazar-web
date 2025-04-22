import { NextRequest, NextResponse } from 'next/server';
import { getToken } from "@/lib/auth";
import { env } from "@/lib/env"; // Import env config

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
    const token = getToken(); // Use getToken from auth library
    
    if (!token) {
      console.error('API route: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the specific backend API URL from env
    const apiBaseUrl = env.BACKEND_API_URL;

    // Remove potential trailing slash and /api suffix if present
    let cleanBaseUrl = apiBaseUrl.replace(/\/$/, "");
    if (cleanBaseUrl.endsWith("/api")) {
        cleanBaseUrl = cleanBaseUrl.slice(0, -4);
    }

    const finalUrl = `${cleanBaseUrl}/users/byUsername/${username}`;

    console.log(`Fetching user data from: ${finalUrl}`);
    
    // Make the API request
    const response = await fetch(finalUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store', // Disable cache for user data
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
    
  } catch (error: any) {
    console.error("Error fetching user by username:", error);
    // Return detailed error if available, otherwise generic message
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
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