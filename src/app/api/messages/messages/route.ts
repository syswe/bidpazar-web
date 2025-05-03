import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

export async function POST(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  console.log(`[API][${urlPath}] POST request received`);
  
  const token = getTokenFromRequest(req); // Use backend-auth helper
  console.log(`[API][${urlPath}] Token found: ${!!token}`);
  if (!token) {
    console.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let requestBody: any;
    try {
        requestBody = await req.json();
        console.log(`[API][${urlPath}] Request body parsed:`, requestBody);
    } catch (parseError) {
        console.error(`[API][${urlPath}] Bad Request (400): Failed to parse request body.`, parseError);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { conversationId, content, receiverId } = requestBody;

    // Validate required fields
    const missingFields = [];
    if (!conversationId) missingFields.push('conversationId');
    if (!content) missingFields.push('content');
    if (!receiverId) missingFields.push('receiverId');

    if (missingFields.length > 0) {
      const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
      console.warn(`[API][${urlPath}] Bad Request (400): ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    console.log(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const backendPath = '/api/messages/messages';
    const apiUrl = `${baseUrl}${backendPath}`;
    
    const payload = { conversationId, content, receiverId };
    console.log(`[API][${urlPath}] Sending message via backend: ${apiUrl}. Payload:`, payload);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
    console.log(`[API][${urlPath}] Successfully sent message. Response:`, data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in POST handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 