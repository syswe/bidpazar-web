import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth"; 
import { prisma } from '@/lib/prisma';

// Remove RouteParams type alias
// type RouteParams = {
//   params: {
//     id: string;
//   };
// };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract the other user ID from the context params
    const { id: otherUserId } = await params;
    console.log(`[API][${urlPath}] Extracted otherUserId: ${otherUserId}`);

    if (!otherUserId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Other User ID parameter is missing.`);
      return NextResponse.json({ error: 'Other User ID is required' }, { status: 400 });
    }

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
    
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      console.error(`[API][${urlPath}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID from token
    const currentUserId = payload.userId;
    
    // Check if users are the same
    if (currentUserId === otherUserId) {
      console.warn(`[API][${urlPath}] Bad Request (400): Cannot create conversation with yourself`);
      return NextResponse.json({ error: 'Cannot create conversation with yourself' }, { status: 400 });
    }
    
    // Check if other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, username: true, name: true }
    });
    
    if (!otherUser) {
      console.warn(`[API][${urlPath}] Not Found (404): Other user does not exist`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find existing conversation between these users
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: { id: currentUserId }
            }
          },
          {
            participants: {
              some: { id: otherUserId }
            }
          }
        ]
      },
      include: {
        participants: {
          select: { id: true, username: true, name: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // If conversation exists, return it
    if (existingConversation) {
      console.log(`[API][${urlPath}] Found existing conversation: ${existingConversation.id}`);
      return NextResponse.json(existingConversation);
    }

    // Create new conversation
    console.log(`[API][${urlPath}] Creating new conversation between users: ${currentUserId} and ${otherUserId}`);
    const newConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [
            { id: currentUserId },
            { id: otherUserId }
          ]
        }
      },
      include: {
        participants: {
          select: { id: true, username: true, name: true }
        }
      }
    });

    console.log(`[API][${urlPath}] Successfully created new conversation: ${newConversation.id}`);
    return NextResponse.json(newConversation);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 