import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// This route exists to ensure Next.js properly recognizes the Socket.IO path
// and doesn't try to handle it as a regular API route
export async function GET(request: NextRequest) {
  logger.info("Socket.IO API route accessed", {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  // Just return a response indicating this is a Socket.IO endpoint
  // The actual Socket.IO handling is done in the socketHandler.ts using the HTTP server
  return NextResponse.json({
    message:
      "Socket.IO endpoint - WebSocket connections should be upgraded properly now",
    time: new Date().toISOString(),
  });
}

// Also handle POST for Socket.IO polling transport
export async function POST(request: NextRequest) {
  logger.info("Socket.IO API route POST accessed", {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  return NextResponse.json({
    message:
      "Socket.IO endpoint - POST transport should be handled by Socket.IO server",
    time: new Date().toISOString(),
  });
}
