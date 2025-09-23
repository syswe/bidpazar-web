import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 10;

    if (unreadOnly) {
      const unreadMessages = await prisma.message.findMany({
        where: {
          receiverId: payload.userId,
          isRead: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          conversation: {
            select: {
              id: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      const unreadCount = await prisma.message.count({
        where: {
          receiverId: payload.userId,
          isRead: false,
        },
      });

      return NextResponse.json({
        unreadCount,
        messages: unreadMessages.map((message) => ({
          id: message.id,
          content: message.content,
          sender: message.sender,
          conversationId: message.conversationId,
          createdAt: message.createdAt.toISOString(),
          conversationUpdatedAt: message.conversation?.updatedAt.toISOString(),
        })),
      });
    }

    const [conversations, unreadCount] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          participants: {
            some: {
              id: payload.userId,
            },
          },
        },
        include: {
          participants: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: limit,
      }),
      prisma.message.count({
        where: {
          receiverId: payload.userId,
          isRead: false,
        },
      }),
    ]);

    return NextResponse.json({
      unreadCount,
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        updatedAt: conversation.updatedAt.toISOString(),
        participants: conversation.participants,
        latestMessage: conversation.messages[0]
          ? {
              ...conversation.messages[0],
              createdAt: conversation.messages[0].createdAt.toISOString(),
            }
          : undefined,
      })),
    });
  } catch (error) {
    console.error("[API][/api/messages] Error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
