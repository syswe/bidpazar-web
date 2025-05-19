import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET /api/live-streams/[id]/status - Get current stream status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;

    logger.info("API GET /api/live-streams/[id]/status", {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id },
    });

    // Find the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        viewerCount: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!stream) {
      logger.warn(
        `API GET /api/live-streams/[id]/status - Stream not found: ${id}`
      );
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    logger.info(
      `API GET /api/live-streams/[id]/status - Stream ${id} status: ${stream.status}`
    );
    return NextResponse.json({
      id: stream.id,
      status: stream.status,
      startTime: stream.startTime,
      endTime: stream.endTime,
      viewerCount: stream.viewerCount,
      creatorId: stream.userId,
      creator: stream.user,
    });
  } catch (error) {
    logger.error("Error getting stream status:", error);
    return NextResponse.json(
      { error: "Failed to get stream status" },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/status - Update stream status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the id from context params
    const { id } = await params;

    // Parse request body
    const body = await request.json();
    const { status } = body;

    logger.info("API POST /api/live-streams/[id]/status", {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id },
      body: { status },
    });

    // Validate status
    if (
      !status ||
      ![
        "SCHEDULED",
        "STARTING",
        "LIVE",
        "PAUSED",
        "ENDING",
        "ENDED",
        "CANCELLED",
        "FAILED_TO_START",
        "INTERRUPTED",
      ].includes(status)
    ) {
      logger.warn(
        `API POST /api/live-streams/[id]/status - Invalid status: ${status}`
      );
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Find the stream
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
      },
    });

    if (!stream) {
      logger.warn(
        `API POST /api/live-streams/[id]/status - Stream not found: ${id}`
      );
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    // Update stream status
    const updatedStream = await prisma.liveStream.update({
      where: { id },
      data: {
        status,
        startTime:
          status === "LIVE" && stream.status !== "LIVE"
            ? new Date()
            : undefined,
        endTime: status === "ENDED" ? new Date() : undefined,
      },
    });

    logger.info(
      `API POST /api/live-streams/[id]/status - Stream ${id} status updated from ${stream.status} to ${status}`
    );
    return NextResponse.json({
      id: updatedStream.id,
      status: updatedStream.status,
      startTime: updatedStream.startTime,
      endTime: updatedStream.endTime,
      message: "Stream status updated successfully",
    });
  } catch (error) {
    logger.error("Error updating stream status:", error);
    return NextResponse.json(
      { error: "Failed to update stream status" },
      { status: 500 }
    );
  }
}
