import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

// Removed sampleUsers array

// This handler function follows Next.js 15.2.2 pattern for dynamic routes
export async function GET(request: NextRequest) {
  const url = request.nextUrl.pathname;
  console.log(`[API][${url}] GET request received`);
  // Extract username from the URL path
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const username = segments[segments.length - 1];
  console.log(`[API][${url}] Extracted username: ${username}`);

  try {
    if (!username) {
      console.warn(`[API][${url}] Bad Request (400): Username parameter is missing.`);
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Get auth token from headers using backend-auth helper
    const token = getTokenFromRequest(request);
    console.log(`[API][${url}] Token found: ${!!token}`);
    
    if (!token) {
      console.error(`[API][${url}] Unauthorized (401): No token found.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the specific backend API URL from env
    const apiBaseUrl = env.BACKEND_API_URL;
    console.log(`[API][${url}] Backend base URL from env: ${apiBaseUrl}`);

    // Remove potential trailing slash and /api suffix if present
    let cleanBaseUrl = apiBaseUrl.replace(/\/$/, "");
    if (cleanBaseUrl.endsWith("/api")) {
        cleanBaseUrl = cleanBaseUrl.slice(0, -4);
    }

    // Construct the final URL for the backend request
    const finalUrl = `${cleanBaseUrl}/api/users/byUsername/${username}`;
    console.log(`[API][${url}] Fetching user data from backend: ${finalUrl}`);
    
    // Make the API request
    const response = await fetch(finalUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store', // Disable cache for user data
    });
    console.log(`[API][${url}] Backend response status: ${response.status}`);

    // Handle the response
    if (!response.ok) {
      const errorMessage = await response.text();
      console.error(`[API][${url}] Backend API error (${response.status}):`, errorMessage);
      
      try {
        // Try to parse error as JSON if possible
        const errorJson = JSON.parse(errorMessage);
        console.log(`[API][${url}] Forwarding backend JSON error response.`);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        // Otherwise return as text
        console.log(`[API][${url}] Forwarding backend text error response.`);
        return NextResponse.json(
          { error: errorMessage || `Error: ${response.status}` }, 
          { status: response.status }
        );
      }
    }

    // Parse and return successful response
    const data = await response.json();
    console.log(`[API][${url}] Successfully fetched user data from backend.`);
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error(`[API][${url}] Unexpected error in GET handler:`, error);
    // Return detailed error if available, otherwise generic message
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${url}] Returning error response (${errorStatus}): ${errorMessage}`);
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