import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// This is a fallback API route to help ensure Socket.IO connections
// can find a valid endpoint for handshake requests
export async function GET(request: NextRequest) {
  logger.info("Socket.IO API route accessed", {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  // Return information about the Socket.IO endpoint
  return NextResponse.json({
    message:
      "Socket.IO API route - WebSocket connections should be handled by the custom server",
    info: "This route exists to prevent 404 errors for Socket.IO HTTP polling fallbacks",
    success: true,
    timestamp: new Date().toISOString(),
  });
}

// Support POST requests for compatibility with Socket.IO polling
export async function POST(request: NextRequest) {
  logger.info("Socket.IO API route POST accessed", {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  return NextResponse.json({
    message: "Socket.IO API route - POST endpoint",
    success: true,
    timestamp: new Date().toISOString(),
  });
}

// Add explicit export to prevent warnings
export const dynamic = "force-dynamic";
