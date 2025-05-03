import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config
import { logger } from '@/lib/logger'; // Import logger

export async function POST(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  const headers = Object.fromEntries(req.headers.entries());
  let requestBody;
  try {
    requestBody = await req.json();
  } catch (parseError) {
    logger.info(`[API][${urlPath}] POST request received with unparseable body`, { headers });
    logger.error(`[API][${urlPath}] Bad Request (400): Failed to parse request body.`, parseError);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  logger.info(`[API][${urlPath}] POST request received`, { headers, body: requestBody });

  const token = getTokenFromRequest(req); // Use backend-auth helper
  logger.info(`[API][${urlPath}] Token found: ${!!token}`);
  if (!token) {
    logger.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { conversationId, content, receiverId } = requestBody;

    // Validate required fields
    const missingFields = [];
    if (!conversationId) missingFields.push('conversationId');
    if (!content) missingFields.push('content');
    if (!receiverId) missingFields.push('receiverId');

    if (missingFields.length > 0) {
      const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
      logger.warn(`[API][${urlPath}] Bad Request (400): ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    logger.info(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const backendPath = '/api/messages/messages';
    const apiUrl = `${baseUrl}${backendPath}`;
    
    const payload = { conversationId, content, receiverId };
    logger.info(`[API][${urlPath}] Sending message via backend: ${apiUrl}. Payload:`, payload);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    logger.info(`[API][${urlPath}] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[API][${urlPath}] Backend API error (${response.status}):`, { status: response.status, errorText });
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    logger.info(`[API][${urlPath}] Successfully sent message. Response:`, data);
    return NextResponse.json(data);

  } catch (error: any) {
    logger.error(`[API][${urlPath}] Unexpected error in POST handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    logger.info(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 