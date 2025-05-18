import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// In-memory store for active viewers (would be replaced by Redis in production)
const activeViewers = new Map<string, Set<string>>();

/**
 * GET handler - Returns the number of active viewers for a stream
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;

  try {
    // Get viewer count
    const viewerCount = activeViewers.get(streamId)?.size || 0;

    // Get stream details to validate it exists
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    return NextResponse.json({
      count: viewerCount,
      streamId,
    });
  } catch (error) {
    console.error(`[API][/api/live-streams/${streamId}/viewers] Error:`, error);
    return NextResponse.json(
      { error: "Failed to get viewer count" },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Register a new viewer for a stream
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;
  let viewerId = "anonymous";

  try {
    // Check for authentication but don't require it
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (token) {
      try {
        const payload = await verifyToken(token);
        if (payload && payload.userId) {
          viewerId = payload.userId;
        }
      } catch (error) {
        console.warn("Invalid token, but proceeding as anonymous viewer");
      }
    }

    // Add viewer to the stream's active viewers
    if (!activeViewers.has(streamId)) {
      activeViewers.set(streamId, new Set());
    }

    activeViewers.get(streamId)?.add(viewerId);
    const viewerCount = activeViewers.get(streamId)?.size || 0;

    console.log(
      `[API][/api/live-streams/${streamId}/viewers] Added viewer ${viewerId}, total: ${viewerCount}`
    );

    return NextResponse.json({ count: viewerCount, streamId, viewerId });
  } catch (error) {
    console.error(`[API][/api/live-streams/${streamId}/viewers] Error:`, error);
    return NextResponse.json(
      { error: "Failed to register viewer" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - Remove a viewer from a stream
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;
  let viewerId = "anonymous";

  try {
    // Check for authentication but don't require it
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (token) {
      try {
        const payload = await verifyToken(token);
        if (payload && payload.userId) {
          viewerId = payload.userId;
        }
      } catch (error) {
        console.warn("Invalid token, but proceeding as anonymous viewer");
      }
    }

    // Remove viewer from the stream's active viewers
    if (activeViewers.has(streamId)) {
      activeViewers.get(streamId)?.delete(viewerId);

      // Clean up empty sets
      if (activeViewers.get(streamId)?.size === 0) {
        activeViewers.delete(streamId);
      }
    }

    const viewerCount = activeViewers.get(streamId)?.size || 0;
    console.log(
      `[API][/api/live-streams/${streamId}/viewers] Removed viewer ${viewerId}, total: ${viewerCount}`
    );

    return NextResponse.json({ count: viewerCount, streamId, viewerId });
  } catch (error) {
    console.error(`[API][/api/live-streams/${streamId}/viewers] Error:`, error);
    return NextResponse.json(
      { error: "Failed to remove viewer" },
      { status: 500 }
    );
  }
}
