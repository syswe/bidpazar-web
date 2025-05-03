import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth";
import { env } from "@/lib/env"; // Import env config

export async function GET(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  
  const token = getTokenFromRequest(req);
  console.log(`[API][${urlPath}] Token found: ${!!token}`);
  if (!token) {
    console.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    console.log(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const backendPath = '/api/messages/notifications';
    const apiUrl = `${baseUrl}${backendPath}`;
    
    console.log(`[API][${urlPath}] Fetching notifications from backend: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh notifications
    });
    console.log(`[API][${urlPath}] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API][${urlPath}] Backend API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API][${urlPath}] Successfully fetched ${data?.length ?? 0} notifications from backend.`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 