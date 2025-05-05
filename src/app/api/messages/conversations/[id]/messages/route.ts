import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  const queryParams = request.nextUrl.searchParams;
  console.log(`[API][${urlPath}] GET request received. Query:`, queryParams.toString());
  
  // Extract token from authorization header
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    console.error(`[API][${urlPath}] Unauthorized (401): No authorization header`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.error(`[API][${urlPath}] Unauthorized (401): Invalid authorization format`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const token = parts[1];
  console.log(`[API][${urlPath}] Token found: ${!!token}`);
  
  try {
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      console.error(`[API][${urlPath}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the conversationId from context params
    const { id: conversationId } = await params;
    console.log(`[API][${urlPath}] Extracted conversationId: ${conversationId}`);
    const page = parseInt(queryParams.get("page") || "1");
    const limit = parseInt(queryParams.get("limit") || "20");
    console.log(`[API][${urlPath}] Using pagination - Page: ${page}, Limit: ${limit}`);

    if (!conversationId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Conversation ID parameter is missing.`);
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Verify the user is a participant in this conversation
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
      console.error(`[API][${urlPath}] Forbidden (403): User is not a participant in this conversation`);
      return NextResponse.json({ 
        error: 'You do not have access to this conversation' 
      }, { status: 403 });
    }

    // Get total count for pagination
    const totalCount = await prisma.message.count({
      where: {
        conversationId
      }
    });

    // Fetch messages with pagination
    const messages = await prisma.message.findMany({
      where: {
        conversationId
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    console.log(`[API][${urlPath}] Successfully fetched ${messages.length} messages from database`);
    
    // Mark messages as read if they're not from the current user
    if (messages.length > 0) {
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
    }

    return NextResponse.json({
      messages,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 