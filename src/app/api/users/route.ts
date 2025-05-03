import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config
import { logger } from '@/lib/logger';

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
    const token = getTokenFromRequest(req); // Use backend-auth helper
    logger.debug(`[API][${url}] Token found`, { hasToken: !!token });

    if (!token) {
      console.error(`[API][${url}] Unauthorized: No token found`);
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/users`
      : `${baseUrl}/api/users`;

    // Try to fetch real users first
    try {
      logger.info(`[API][${url}] Fetching users from backend`, { apiUrl });
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      logger.info(`[API][${url}] Backend response status`, { status: response.status });

      if (response.ok) {
        const data = await response.json();
        const users = Array.isArray(data) ? data : data.users || [];
        logger.info(`[API][${url}] Successfully fetched users from backend`, { count: users.length });
        return NextResponse.json(users);
      }
      
      logger.warn(`[API][${url}] Backend fetch failed`, { status: response.status });
    } catch (error) {
      logger.error(`[API][${url}] Error fetching from backend API`, error);
    }
    
    // Return sample data if API call fails
    logger.info(`[API][${url}] Returning sample users data`);
    return NextResponse.json(sampleUsers);
  } catch (error) {
    logger.error(`[API][${url}] Unexpected error in GET handler`, error);
    logger.info(`[API][${url}] Returning sample users data due to error`);
    // Ensure fallback returns something consistent
    return NextResponse.json(sampleUsers, { status: 500 }); // Return 500 but still provide sample data
  }
} 