import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationId = (await params).id;
  logger.info(
    `[API][/api/messages/conversations/details/${conversationId}] GET request received`
  );

  try {
    // Extract token from authorization header
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      logger.warn(
        `[API][/api/messages/conversations/details/${conversationId}] Unauthorized: No authorization header`
      );
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const parts = authorization.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      logger.warn(
        `[API][/api/messages/conversations/details/${conversationId}] Unauthorized: Invalid authorization format`
      );
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = parts[1];

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.warn(
        `[API][/api/messages/conversations/details/${conversationId}] Unauthorized: Invalid token`
      );
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = payload.userId;

    if (!conversationId) {
      logger.warn(
        `[API][/api/messages/conversations/details] Missing conversationId`
      );
      return NextResponse.json(
        { message: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
        // Ensure the current user is part of the conversation
        participants: {
          some: {
            id: userId,
          },
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            name: true,
            userType: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // For latestMessage
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!conversation) {
      logger.warn(
        `[API][/api/messages/conversations/details/${conversationId}] Conversation not found or user ${userId} not a participant`
      );
      return NextResponse.json(
        { message: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    // Transform to match the Conversation type in api.ts if needed
    const responseConversation = {
      id: conversation.id,
      updatedAt: conversation.updatedAt.toISOString(),
      participants: conversation.participants,
      latestMessage:
        conversation.messages.length > 0
          ? {
              ...conversation.messages[0],
              createdAt: conversation.messages[0].createdAt.toISOString(),
            }
          : undefined,
      _count: conversation._count,
    };

    logger.info(
      `[API][/api/messages/conversations/details/${conversationId}] Conversation found for user ${userId}`
    );
    return NextResponse.json(responseConversation);
  } catch (error) {
    logger.error(
      `[API][/api/messages/conversations/details/${conversationId}] Error fetching conversation details:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { message: "Failed to fetch conversation details", error: errorMessage },
      { status: 500 }
    );
  }
}
