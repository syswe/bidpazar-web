import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth";
import { env } from "@/lib/env";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  const queryParams = request.nextUrl.searchParams;
  console.log(`[API][${urlPath}] GET request received. Query:`, queryParams.toString());
  
  const token = getTokenFromRequest(request);
  console.log(`[API][${urlPath}] Token found: ${!!token}`);
  if (!token) {
    console.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the conversationId from context params
    const { id: conversationId } = await params;
    console.log(`[API][${urlPath}] Extracted conversationId: ${conversationId}`);
    const page = queryParams.get("page") || "1";
    const limit = queryParams.get("limit") || "20";
    console.log(`[API][${urlPath}] Using pagination - Page: ${page}, Limit: ${limit}`);

    if (!conversationId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Conversation ID parameter is missing.`);
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Construct backend URL
    const backendUrl = `${env.BACKEND_API_URL}/api/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`;
    console.log(`[API][${urlPath}] Fetching messages from backend: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    console.log(`[API][${urlPath}] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[API][${urlPath}] Backend error fetching messages (${response.status}):`, errorData);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API][${urlPath}] Successfully fetched ${data?.length ?? 0} messages from backend.`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 