import { NextResponse } from "next/server";

// Removing the second parameter completely and using request.url to get the ID
export async function GET(request: Request) {
  try {
    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const streamId = pathParts[pathParts.length - 2]; // Assuming the URL format is /api/live-streams/[id]/check-streamer

    // Get token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader ? authHeader.split(" ")[1] : null;

    // If no token in header, check cookies as fallback
    if (!token) {
      return NextResponse.json({ isStreamer: false });
    }

    // Call backend API to check if user is streamer
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/check-streamer`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ isStreamer: false });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error checking if user is streamer:", error);
    return NextResponse.json({ isStreamer: false });
  }
}
