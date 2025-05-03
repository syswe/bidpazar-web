import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

// Special route to find users through the messages API (bypassing user routes issue)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract username from context params
    const { username } = await params;
    console.log(`[API][${urlPath}] Extracted username: ${username}`);
    
    if (!username) {
      console.warn(`[API][${urlPath}] Bad Request (400): Username parameter is missing.`);
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Get auth token from headers using backend-auth helper
    const token = getTokenFromRequest(request);
    console.log(`[API][${urlPath}] Token found: ${!!token}`);
    if (!token) {
      console.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create API URL using messages API (not user API)
    const baseUrl = env.BACKEND_API_URL;
    console.log(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const backendPath = `/api/messages/find-user/${username}`;
    const apiUrl = `${baseUrl}${backendPath}`;
    
    console.log(`[API][${urlPath}] Finding user through messages API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Avoid caching user lookups
    });
    console.log(`[API][${urlPath}] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API][${urlPath}] Backend API error (${response.status}):`, errorText);
      
      try {
        // Try to parse as JSON if possible
        const errorJson = JSON.parse(errorText);
        console.log(`[API][${urlPath}] Forwarding backend JSON error response.`);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        // Otherwise return as text
        console.log(`[API][${urlPath}] Forwarding backend text error response.`);
        return NextResponse.json(
          { error: errorText || `Error: ${response.status}` }, 
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    console.log(`[API][${urlPath}] Successfully found user data via messages API. Data:`, data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 