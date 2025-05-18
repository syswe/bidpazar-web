import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";

// Get Socket.IO server instance from the global object if available
let io: SocketIOServer | undefined;
if ((global as any).socketIO) {
  io = (global as any).socketIO;
}

export async function POST(req: NextRequest) {
  const urlPath = req.nextUrl.pathname;
  const headers = Object.fromEntries(req.headers.entries());
  let requestBody;
  try {
    requestBody = await req.json();
  } catch (parseError) {
    logger.info(
      `[API][${urlPath}] POST request received with unparseable body`,
      { headers }
    );
    logger.error(
      `[API][${urlPath}] Bad Request (400): Failed to parse request body.`,
      parseError
    );
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  logger.info(`[API][${urlPath}] POST request received`, {
    headers,
    body: requestBody,
  });

  // Extract token from authorization header
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    logger.error(
      `[API][${urlPath}] Unauthorized (401): No authorization header`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    logger.error(
      `[API][${urlPath}] Unauthorized (401): Invalid authorization format`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = parts[1];
  logger.info(`[API][${urlPath}] Token found: ${!!token}`);

  try {
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${urlPath}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, content, receiverId } = requestBody;

    // Validate required fields
    const missingFields = [];
    if (!conversationId) missingFields.push("conversationId");
    if (!content) missingFields.push("content");
    if (!receiverId) missingFields.push("receiverId");

    if (missingFields.length > 0) {
      const errorMessage = `Missing required fields: ${missingFields.join(
        ", "
      )}`;
      logger.warn(`[API][${urlPath}] Bad Request (400): ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Verify the conversation exists and user is a participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            id: payload.userId,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      logger.error(
        `[API][${urlPath}] Forbidden (403): User not in conversation or conversation doesn't exist`
      );
      return NextResponse.json(
        {
          error: "You do not have access to this conversation",
        },
        { status: 403 }
      );
    }

    // Check if receiver is part of the conversation
    const isReceiverInConversation = conversation.participants.some(
      (p: { id: string }) => p.id === receiverId
    );
    if (!isReceiverInConversation) {
      logger.error(
        `[API][${urlPath}] Bad Request (400): Receiver is not part of this conversation`
      );
      return NextResponse.json(
        {
          error: "Receiver is not part of this conversation",
        },
        { status: 400 }
      );
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content,
        senderId: payload.userId,
        receiverId,
        conversationId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    // Update conversation's updatedAt time
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Create a notification for the receiver
    await prisma.notification.create({
      data: {
        userId: receiverId,
        content: `New message from ${payload.username}`,
        type: "MESSAGE",
        relatedId: message.id,
      },
    });

    // Emit socket events if io is available
    if (io) {
      logger.info(`[API][${urlPath}] Emitting socket events for new message`);

      // Emit to conversation room
      io.to(`conversation:${conversationId}`).emit("new-message", {
        id: message.id,
        senderId: payload.userId,
        senderUsername: payload.username,
        receiverId: receiverId,
        content: content,
        conversationId: conversationId,
        createdAt: message.createdAt,
      });

      // Emit to receiver's personal room for notifications
      io.to(`user:${receiverId}`).emit("message-notification", {
        senderId: payload.userId,
        senderUsername: payload.username,
        conversationId: conversationId,
        content: content,
        createdAt: message.createdAt,
      });
    } else {
      logger.warn(
        `[API][${urlPath}] Socket.IO instance not available for real-time messaging`
      );
    }

    logger.info(
      `[API][${urlPath}] Successfully sent message. Response:`,
      message
    );
    return NextResponse.json(message);
  } catch (error: any) {
    logger.error(`[API][${urlPath}] Unexpected error in POST handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    logger.info(
      `[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`
    );
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}
