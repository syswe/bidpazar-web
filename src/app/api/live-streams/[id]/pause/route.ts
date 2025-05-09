import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getUserFromTokenInNode } from "@/lib/auth";

// POST /api/live-streams/[id]/pause - Pause a live stream
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;

    logger.info("API POST /api/live-streams/[id]/pause", {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id },
    });

    // Extract token from authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : request.cookies.get("token")?.value;

    if (!token) {
      logger.warn(
        "API POST /api/live-streams/[id]/pause - Missing authentication token"
      );
      return NextResponse.json(
        { error: "Unauthorized - No token provided" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      logger.warn(
        "API POST /api/live-streams/[id]/pause - Invalid token or user not found"
      );
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Find the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      logger.warn(
        `API POST /api/live-streams/[id]/pause - Stream not found: ${id}`
      );
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    // Check if the user is the creator of the stream
    if (stream.userId !== user.id) {
      logger.warn(
        `API POST /api/live-streams/[id]/pause - User ${user.id} is not the creator of stream ${id}`
      );
      return NextResponse.json(
        { error: "Unauthorized to pause this stream" },
        { status: 403 }
      );
    }

    // Check if the stream is live
    if (stream.status !== "LIVE") {
      logger.warn(
        `API POST /api/live-streams/[id]/pause - Cannot pause stream ${id} because it is not live (current status: ${stream.status})`
      );
      return NextResponse.json(
        { error: `Cannot pause a stream with status ${stream.status}` },
        { status: 400 }
      );
    }

    // Update the stream status to PAUSED
    const updatedStream = await prisma.liveStream.update({
      where: { id },
      data: {
        status: "PAUSED",
        // Optionally store the pause time in a pausedAt field if you have one
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    logger.info(
      `API POST /api/live-streams/[id]/pause - Stream ${id} paused successfully`
    );
    return NextResponse.json({
      message: "Stream paused successfully",
      status: "PAUSED",
      stream: updatedStream,
    });
  } catch (error) {
    logger.error("Error pausing stream:", error);
    return NextResponse.json(
      { error: "Failed to pause stream", message: String(error) },
      { status: 500 }
    );
  }
}
