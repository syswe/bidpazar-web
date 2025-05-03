import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth";
import { env } from "@/lib/env"; // Import env config
import { logger } from '@/lib/logger'; // Import logger

export async function POST(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  const headers = Object.fromEntries(req.headers.entries());
  logger.info(`[API][${urlPath}] POST request received`, { headers });
  
  const token = getTokenFromRequest(req);
  logger.info(`[API][${urlPath}] Token found: ${!!token}`);
  if (!token) {
    logger.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let notificationIds: string[] = [];
    try {
      const body = await req.json();
      notificationIds = body.notificationIds;
      logger.info(`[API][${urlPath}] Request body parsed`, { notificationIds });
    } catch (parseError) {
      logger.error(`[API][${urlPath}] Bad Request (400): Failed to parse request body.`, parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!Array.isArray(notificationIds)) {
      logger.warn(`[API][${urlPath}] Bad Request (400): notificationIds is not an array.`);
      return NextResponse.json({ error: "notificationIds must be an array" }, { status: 400 });
    }
    
    // Optional: Check if array is empty, depends on backend handling
    // if (notificationIds.length === 0) {
    //   console.log(`[API][${urlPath}] No notification IDs provided. Returning success.`);
    //   return NextResponse.json({ success: true, message: "No notifications to mark as read" });
    // }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    logger.info(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const backendPath = '/api/messages/notifications/read';
    const apiUrl = `${baseUrl}${backendPath}`;
    
    logger.info(`[API][${urlPath}] Marking notifications read via backend: ${apiUrl}`, { notificationIds });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds }), // Sending the array directly
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
    logger.info(`[API][${urlPath}] Successfully marked notifications read. Response:`, data);
    return NextResponse.json(data);

  } catch (error: any) {
    logger.error(`[API][${urlPath}] Unexpected error in POST handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    logger.info(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 