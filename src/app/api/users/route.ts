import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// Sample users with proper fields
const sampleUsers = [
  { 
    id: 'user1', 
    username: 'johndoe', 
    name: 'John Doe', 
    email: 'john@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  { 
    id: 'user2', 
    username: 'janedoe', 
    name: 'Jane Doe', 
    email: 'jane@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  { 
    id: 'user3', 
    username: 'bobsmith', 
    name: 'Bob Smith', 
    email: 'bob@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  { 
    id: 'user4', 
    username: 'alicejones', 
    name: 'Alice Jones', 
    email: 'alice@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  { 
    id: 'user5', 
    username: 'sarahlee', 
    name: 'Sarah Lee', 
    email: 'sarah@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] GET request received`, {
    headers: Object.fromEntries(req.headers.entries()),
    url: req.url,
    query: req.nextUrl.searchParams.toString(),
  });
  
  try {
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
    logger.debug(`[API][${url}] Token found`, { hasToken: !!token });

    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.error(`[API][${url}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin for full user list
    const isAdmin = payload.isAdmin === true;
    
    // Get query parameters for filtering and pagination
    const searchQuery = req.nextUrl.searchParams.get('search') || '';
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;
    
    logger.info(`[API][${url}] Fetching users`, { isAdmin, searchQuery, page, limit });

    // Build search condition
    const searchCondition = searchQuery 
      ? {
          OR: [
            { username: { contains: searchQuery, mode: 'insensitive' } },
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } }
          ]
        } 
      : {};
      
    // Fetch users with proper filters - admins can see all, regular users see limited data
    const users = await prisma.user.findMany({
      where: {
        ...searchCondition,
        // Optional: Add additional filters if needed
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: isAdmin, // Only include email for admins
        isVerified: isAdmin, // Only include verification status for admins
        isAdmin: isAdmin, // Only include admin status for admins
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get total count for pagination
    const totalCount = await prisma.user.count({
      where: searchCondition
    });

    logger.info(`[API][${url}] Successfully fetched users`, { count: users.length, totalCount });
    
    return NextResponse.json({
      users,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    logger.error(`[API][${url}] Unexpected error in GET handler`, error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 