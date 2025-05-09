import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getUserFromTokenInNode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/logger";

// Validation schema
const chatMessageSchema = z.object({
  message: z.string().min(1).max(500),
});

// GET /api/live-streams/[id]/chat - Get chat messages
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const streamId = params.id;
  logger.info(`[API][/api/live-streams/${streamId}/chat] GET request received`);

  try {
    // Fetch chat messages from database
    const messages = await prisma.chatMessage.findMany({
      where: { liveStreamId: streamId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      take: 100, // Limit to last 100 messages
    });

    // Transform data to match the Socket.IO chat format
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      streamId: msg.liveStreamId,
      userId: msg.userId,
      username: msg.user?.username || "Unknown User",
      content: msg.message,
      timestamp: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
    });
  } catch (error) {
    logger.error(
      `[API][/api/live-streams/${streamId}/chat] Error fetching messages:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch chat messages",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/chat - Send a chat message
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  const streamId = params.id;
  logger.info(
    `[API][/api/live-streams/${streamId}/chat] POST request received`
  );

  try {
    const body = await request.json();

    if (!body.message) {
      return NextResponse.json(
        {
          success: false,
          message: "Message content is required",
        },
        { status: 400 }
      );
    }

    // Get user info from authentication
    const authHeader = request.headers.get("Authorization");
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : request.cookies.get("token")?.value;

    let userId = body.userId;
    let username = body.username || "Anonymous";

    // If we have a token, validate user
    if (token) {
      try {
        const authenticatedUser = await getUserFromTokenInNode(token);
        if (authenticatedUser) {
          userId = authenticatedUser.id;
          username =
            authenticatedUser.username || authenticatedUser.name || "User";
        }
      } catch (authError) {
        logger.warn("Invalid token in chat message POST", { error: authError });
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: "User authentication required",
        },
        { status: 401 }
      );
    }

    // Create a new message in the database
    const newMessage = await prisma.chatMessage.create({
      data: {
        message: body.message,
        userId: userId,
        liveStreamId: streamId,
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

    // Format the response
    const formattedMessage = {
      id: newMessage.id,
      streamId: newMessage.liveStreamId,
      userId: newMessage.userId,
      username: newMessage.user?.username || username,
      content: newMessage.message,
      timestamp: newMessage.createdAt.toISOString(),
    };

    // Try to get server's Socket.IO instance to broadcast
    // This doesn't work directly in Next.js API routes, so we'll
    // rely on the client to send via Socket.IO for real-time updates
    // Alternatively, implement a message queue system like Redis

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      data: formattedMessage,
    });
  } catch (error) {
    logger.error(`[API][/api/live-streams/${streamId}/chat] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to send message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
