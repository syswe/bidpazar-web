import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const streamId = (await params).id;

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
