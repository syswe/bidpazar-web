import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

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
  console.log(`[API][${url}] GET request received`);
  try {
    const token = getTokenFromRequest(req); // Use backend-auth helper
    console.log(`[API][${url}] Token found: ${!!token}`);

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
      console.log(`[API][${url}] Fetching users from backend: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`[API][${url}] Backend response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        const users = Array.isArray(data) ? data : data.users || [];
        console.log(`[API][${url}] Successfully fetched ${users.length} users from backend`);
        return NextResponse.json(users);
      }
      
      console.warn(`[API][${url}] Backend fetch failed (${response.status}). Falling back to sample data.`);
    } catch (error) {
      console.error(`[API][${url}] Error fetching from backend API:`, error);
    }
    
    // Return sample data if API call fails
    console.log(`[API][${url}] Returning sample users data`);
    return NextResponse.json(sampleUsers);
  } catch (error) {
    console.error(`[API][${url}] Unexpected error in GET handler:`, error);
    console.log(`[API][${url}] Returning sample users data due to error`);
    // Ensure fallback returns something consistent
    return NextResponse.json(sampleUsers, { status: 500 }); // Return 500 but still provide sample data
  }
} 