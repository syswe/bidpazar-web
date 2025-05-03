import { NextResponse } from "next/server";
import { env } from "@/lib/env"; // Import the updated env config

// Removing the second parameter completely and using request.url to get the ID
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const urlPath = requestUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract the ID from the URL path
    const pathParts = urlPath.split('/');
    // Example: /api/live-streams/stream123/check-streamer -> [ '', 'api', 'live-streams', 'stream123', 'check-streamer' ]
    const streamId = pathParts.length >= 3 ? pathParts[pathParts.length - 2] : null;
    console.log(`[API][${urlPath}] Extracted streamId: ${streamId}`);

    if (!streamId) {
      console.error(`[API][${urlPath}] Bad Request (400): Could not extract streamId from path.`);
      return NextResponse.json({ error: 'Missing stream ID' }, { status: 400 });
    }

    // Get token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader ? authHeader.split(" ")[1] : null;
    console.log(`[API][${urlPath}] Token found in header: ${!!token}`);

    // If no token in header, return false immediately (don't check cookies)
    if (!token) {
      console.log(`[API][${urlPath}] Unauthorized (401): No token provided.`);
      // Returning isStreamer: false for unauthorized, but could return 401
      return NextResponse.json({ isStreamer: false, reason: "Unauthorized" });
    }

    // Construct backend URL
    const backendUrl = `${env.BACKEND_API_URL}/api/live-streams/${streamId}/check-streamer`;
    console.log(`[API][${urlPath}] Calling backend: ${backendUrl}`);

    // Call backend API to check if user is streamer
    const response = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store', // Avoid caching this check
    });
    console.log(`[API][${urlPath}] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[API][${urlPath}] Backend check failed (${response.status}): ${errorText}. Returning isStreamer: false.`);
      // Determine reason based on status
      let reason = "Backend error";
      if (response.status === 403) reason = "Forbidden";
      if (response.status === 404) reason = "Stream not found";
      return NextResponse.json({ isStreamer: false, reason });
    }

    const data = await response.json();
    console.log(`[API][${urlPath}] Backend response data:`, data);
    console.log(`[API][${urlPath}] Returning backend response.`);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    console.log(`[API][${urlPath}] Returning isStreamer: false due to error.`);
    return NextResponse.json({ isStreamer: false, reason: "Internal server error" }, { status: 500 });
  }
}
