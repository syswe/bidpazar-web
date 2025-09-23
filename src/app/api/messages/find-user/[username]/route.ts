import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

// Special route to find users through the messages API (bypassing user routes issue)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  
  try {
    // Extract username from context params
    const { username } = await params;
    console.log(`[API][${urlPath}] Extracted username: ${username}`);
    
    if (!username) {
      console.warn(`[API][${urlPath}] Bad Request (400): Username parameter is missing.`);
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
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

    // Find user by username (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        username: {
          mode: 'insensitive',
          equals: username
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        userType: true,
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!user) {
      console.log(`[API][${urlPath}] User not found with username: ${username}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.userType !== 'SELLER') {
      console.warn(`[API][${urlPath}] Forbidden (403): Attempt to message non-seller username: ${username}`);
      return NextResponse.json({ error: 'Only sellers can be messaged' }, { status: 403 });
    }

    // Don't return current user when searching
    if (user.id === payload.userId) {
      console.log(`[API][${urlPath}] User searched for themselves: ${username}`);
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    console.log(`[API][${urlPath}] Successfully found user data. Username: ${user.username}`);
    return NextResponse.json(user);

  } catch (error: any) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${urlPath}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
} 
