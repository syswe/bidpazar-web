import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract the conversation ID from context params
    const { id: conversationId } = await params;
    console.log(`[API][${urlPath}] Extracted conversationId: ${conversationId}`);

    if (!conversationId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Conversation ID parameter is missing.`);
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Extract token from authorization header
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      console.error(`[API][${urlPath}] Unauthorized (401): No authorization header`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.error(`[API][${urlPath}] Unauthorized (401): Invalid authorization format`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = parts[1];
    console.log(`[API][${urlPath}] Token found: ${!!token}`);
    
    // Verify token
    const payload = await verifyToken(token);
    if (!payload) {
      console.error(`[API][${urlPath}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is participant in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: {
          some: {
            id: payload.userId
          }
        }
      }
    });

    if (!conversation) {
      console.error(`[API][${urlPath}] Forbidden (403): User not participant in conversation`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Fetch Messages
    console.log(`[API][${urlPath}] Fetching messages for conversation: ${conversationId}`);
    const messages = await prisma.message.findMany({
      where: {
        conversationId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      }
    });
    console.log(`[API][${urlPath}] Fetched ${messages.length} messages`);

    // Fetch Conversation Details (Participants)
    console.log(`[API][${urlPath}] Fetching conversation details`);
    const details = await prisma.conversation.findUnique({
      where: {
        id: conversationId
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      }
    });

    let participants = [];
    if (details && details.participants) {
      participants = details.participants;
      console.log(`[API][${urlPath}] Successfully fetched ${participants.length} participants.`);
    } else {
      console.error(`[API][${urlPath}] Could not fetch participants. Proceeding without them.`);
    }

    // Mark messages as read if they're not from the current user
    await prisma.message.updateMany({
      where: {
        conversationId,
        receiverId: payload.userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });
    console.log(`[API][${urlPath}] Marked user's unread messages as read`);

    // Combine the data and return
    const responsePayload = { id: conversationId, messages, participants };
    console.log(`[API][${urlPath}] Returning combined data (messages: ${messages.length}, participants: ${participants.length})`);
    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 