import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth";
import { env } from "@/lib/env"; // Import env config
import { logger } from '@/lib/logger'; // Import logger

export async function GET(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  const headers = Object.fromEntries(req.headers.entries());
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  logger.info(`[API][${urlPath}] GET request received`, { headers, query });
  
  const token = getTokenFromRequest(req);
  logger.info(`[API][${urlPath}] Token found: ${!!token}`);
  if (!token) {
    logger.error(`[API][${urlPath}] Unauthorized (401): No token found.`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    logger.info(`[API][${urlPath}] Backend base URL: ${baseUrl}`);
    const backendPath = '/api/messages/notifications';
    const apiUrl = `${baseUrl}${backendPath}`;
    
    logger.info(`[API][${urlPath}] Fetching notifications from backend: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh notifications
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
    logger.info(`[API][${urlPath}] Successfully fetched ${data?.length ?? 0} notifications from backend.`, { count: data?.length ?? 0 });
    return NextResponse.json(data);

  } catch (error: any) {
    logger.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    logger.info(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 