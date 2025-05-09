import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// POST /api/live-streams/[id]/end - Wrapper around /stop for ending a live stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;

    logger.info(
      "API POST /api/live-streams/[id]/end - Redirecting to /stop endpoint",
      {
        headers: Object.fromEntries(request.headers.entries()),
        url: request.url,
        params: { id },
      }
    );

    // Create a new request to the /stop endpoint
    const stopEndpoint = new URL(request.url);
    stopEndpoint.pathname = stopEndpoint.pathname.replace("/end", "/stop");

    // Forward the original request to the stop endpoint
    const stopResponse = await fetch(stopEndpoint.toString(), {
      method: "POST",
      headers: request.headers,
    });

    // Get the response data
    const responseData = await stopResponse.json();

    // Return the response from the stop endpoint
    return NextResponse.json(responseData, { status: stopResponse.status });
  } catch (error) {
    logger.error("Error ending stream:", error);
    return NextResponse.json(
      { error: "Failed to end stream", message: String(error) },
      { status: 500 }
    );
  }
}
