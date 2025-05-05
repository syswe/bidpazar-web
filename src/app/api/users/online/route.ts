import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from '@/lib/prisma';

// Add a type for users
interface User {
  id: string;
  username: string;
  name?: string;
  [key: string]: any; // Allow for other properties
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.pathname;
  console.log(`[API][${url}] GET request received`);
  
  try {
    // Extract token from authorization header
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      console.error(`[API][${url}] Unauthorized (401): No authorization header`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.error(`[API][${url}] Unauthorized (401): Invalid authorization format`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const token = parts[1];
    console.log(`[API][${url}] Token found: ${!!token}`);
    
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      console.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user ID from token (to exclude from results)
    const currentUserId = payload.userId;
    console.log(`[API][${url}] Current User ID from token: ${currentUserId}`);
    
    // Get query parameters
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
    
    // In a production app, you would implement online status tracking
    // For now, we'll simulate by returning recent users
    // Typically this would use a Redis or similar system to track active sessions
    
    // Get recently active users (example implementation - in production this would check a session store)
    const recentUsers = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId // Exclude current user
        },
        // In a real app, you might have a lastActive field to check
        // lastActive: { gte: new Date(Date.now() - 15 * 60 * 1000) } // Active in last 15 minutes
      },
      select: {
        id: true,
        username: true,
        name: true,
        // Don't include sensitive fields like email
      },
      orderBy: {
        updatedAt: 'desc' // Most recently updated first (proxy for activity)
      },
      take: limit
    });
    
    // Mark all as "online" for this example
    const onlineUsers = recentUsers.map((user: User) => ({
      ...user,
      isOnline: true
    }));
    
    console.log(`[API][${url}] Returning ${onlineUsers.length} users marked as online`);
    return NextResponse.json({ users: onlineUsers });

  } catch (error) {
    console.error(`[API][${url}] Unexpected error in GET handler:`, error);
    
    // Return error response
    return NextResponse.json(
      { error: 'Internal server error', users: [] }, 
      { status: 500 }
    );
  }
} 