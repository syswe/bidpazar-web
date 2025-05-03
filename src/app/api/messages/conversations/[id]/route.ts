import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

// Remove RouteParams type alias
// type RouteParams = {
//   params: {
//     id: string;
//   };
// };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract the other user ID from the context params
    const { id: otherUserId } = await params;
    console.log(`[API][${urlPath}] Extracted otherUserId: ${otherUserId}`);

    if (!otherUserId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Other User ID parameter is missing.`);
      return NextResponse.json({ error: 'Other User ID is required' }, { status: 400 });
    }

    const token = getTokenFromRequest(request); // Use getTokenFromRequest
    console.log(`[API][${urlPath}] Token found: ${!!token}`);
    if (!token) {
      console.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    console.log(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    // Construct the correct backend path
    const backendPath = `/api/messages/conversations/${otherUserId}`;
    const apiUrl = `${baseUrl}${backendPath}`;

    console.log(`[API][${urlPath}] Getting or creating conversation with user ${otherUserId} via backend: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Avoid caching conversation lookups
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
    console.log(`[API][${urlPath}] Successfully fetched/created conversation. Data:`, data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 