import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract the conversation ID from context params
    const { id: conversationId } = await params;
    console.log(`[API][${urlPath}] Extracted conversationId: ${conversationId}`);

    if (!conversationId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Conversation ID parameter is missing.`);
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Get token from request headers using backend-auth helper
    const token = getTokenFromRequest(request);
    console.log(`[API][${urlPath}] Token found: ${!!token}`);
    if (!token) {
      console.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Construct URLs for backend requests
    const baseUrl = env.BACKEND_API_URL;
    console.log(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const messagesBackendPath = `/api/messages/conversations/${conversationId}/messages`;
    const detailsBackendPath = `/api/messages/conversations/details/${conversationId}`;
    const messagesUrl = `${baseUrl}${messagesBackendPath}`;
    const detailsUrl = `${baseUrl}${detailsBackendPath}`;
    
    // Fetch Messages
    console.log(`[API][${urlPath}] Fetching messages from backend: ${messagesUrl}`);
    const messagesResponse = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh messages
    });
    console.log(`[API][${urlPath}] Backend messages response status: ${messagesResponse.status}`);

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error(`[API][${urlPath}] Backend messages fetch failed (${messagesResponse.status}):`, errorText);
      // Return error based on message fetch failure
      return NextResponse.json({ error: `Backend API error fetching messages: ${messagesResponse.status}` }, { status: messagesResponse.status });
    }

    const messages = await messagesResponse.json();
    console.log(`[API][${urlPath}] Successfully fetched ${messages?.length ?? 0} messages.`);

    // Fetch Conversation Details (Participants)
    console.log(`[API][${urlPath}] Fetching conversation details from backend: ${detailsUrl}`);
    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh details
    });
    console.log(`[API][${urlPath}] Backend details response status: ${detailsResponse.status}`);

    let participants = [];
    if (detailsResponse.ok) {
      const details = await detailsResponse.json();
      participants = details.participants || [];
      console.log(`[API][${urlPath}] Successfully fetched ${participants.length} participants.`);
    } else {
      const errorText = await detailsResponse.text();
      console.error(`[API][${urlPath}] Backend details fetch failed (${detailsResponse.status}): ${errorText}. Proceeding without participants.`);
      // Decide if failure to get participants is critical. Here we proceed without them.
    }

    // Combine the data and return
    const responsePayload = { id: conversationId, messages, participants };
    console.log(`[API][${urlPath}] Returning combined data (messages: ${messages?.length ?? 0}, participants: ${participants.length})`);
    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 