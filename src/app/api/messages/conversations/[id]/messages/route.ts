import { NextRequest, NextResponse } from 'next/server';
import { getToken } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversationId = params.id;
    const page = request.nextUrl.searchParams.get("page") || "1";
    const limit = request.nextUrl.searchParams.get("limit") || "20";

    const response = await fetch(
      `${env.BACKEND_API_URL}/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Backend error fetching messages: ${response.status}`, errorData);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 