import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserFromTokenInNode } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * GET handler for user conversations
 * Uses direct database query with Prisma
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] GET request received for conversations`);
  
  // Extract token from authorization header
  const authorization = req.headers.get('authorization');
  if (!authorization) {
    logger.error(`[API][${url}] Unauthorized (401): No authorization header`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.error(`[API][${url}] Unauthorized (401): Invalid authorization format`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const token = parts[1];
  
  try {
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get user data from token
    const userData = await getUserFromTokenInNode(token);
    if (!userData) {
      logger.error(`[API][${url}] Unauthorized (401): User not found`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    logger.info(`[API][${url}] Authenticated user: ${userData.username}`);
    
    // Fetch conversations for the user
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            id: userData.id
          }
        }
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            name: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Process the data to simplify the response
    const processedConversations = conversations.map((conv: any) => {
      // Filter out the current user from participants
      const otherParticipants = conv.participants.filter((p: { id: string }) => p.id !== userData.id);
      
      return {
        id: conv.id,
        participants: conv.participants,
        otherParticipants: otherParticipants,
        latestMessage: conv.messages[0] || null,
        messageCount: conv._count.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });
    
    logger.info(`[API][${url}] Successfully fetched ${conversations.length} conversations`);
    return NextResponse.json(processedConversations);
    
  } catch (error) {
    logger.error(`[API][${url}] Error in conversations API:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 