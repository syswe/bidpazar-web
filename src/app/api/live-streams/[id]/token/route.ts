// src/app/api/live-streams/[id]/token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromTokenInNode } from "@/lib/auth";
import { createLiveKitToken } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: streamId } = await params;
    console.log(`[LiveKit Token API] Request for stream: ${streamId}`);

    if (!streamId) {
      console.error("[LiveKit Token API] Stream ID is missing");
      return NextResponse.json(
        { error: "Stream ID is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];

    console.log(
      `[LiveKit Token API] Authorization header present: ${!!authHeader}`
    );
    console.log(`[LiveKit Token API] Token extracted: ${!!token}`);

    console.log("[LiveKit Token API] Finding stream in database...");
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      console.error(`[LiveKit Token API] Stream not found: ${streamId}`);
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    let user = null;
    let isStreamer = false;
    let participantName = "Anonymous";

    if (token) {
      console.log("[LiveKit Token API] Verifying user token...");
      user = await getUserFromTokenInNode(token);
      if (user) {
        console.log(
          `[LiveKit Token API] User authenticated: ${user.username} (${user.id})`
        );
        isStreamer = user.id === stream.userId;
        participantName = user.username;
      }
    }

    // If no token or invalid token, treat as anonymous viewer
    if (!user) {
      console.log("[LiveKit Token API] Creating anonymous viewer token");
      // Generate a random anonymous participant name
      participantName = `Anonymous_${Math.random().toString(36).substr(2, 9)}`;
      isStreamer = false;
    }

    console.log(`[LiveKit Token API] User is streamer: ${isStreamer}`);
    console.log(
      `[LiveKit Token API] Stream owner: ${stream.userId}, Current user: ${
        user?.id || "anonymous"
      }`
    );

    console.log("[LiveKit Token API] Generating LiveKit token...");
    const livekitToken = await createLiveKitToken(
      stream.id,
      participantName,
      isStreamer
    );

    console.log(
      `[LiveKit Token API] LiveKit token generated successfully for ${participantName}`
    );
    return NextResponse.json({ token: livekitToken });
  } catch (error) {
    console.error("[LiveKit Token API] Error generating LiveKit token:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
