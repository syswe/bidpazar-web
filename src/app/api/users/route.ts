import { NextRequest, NextResponse } from 'next/server';
import { getToken } from "@/lib/auth";
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
  try {
    const token = getToken(); // Use getToken from auth library

    if (!token) {
      console.error('API route /api/users: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/users`
      : `${baseUrl}/api/users`;

    // Try to fetch real users first
    try {
      console.log(`Trying to fetch users from: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(Array.isArray(data) ? data : data.users || []);
      }
      
      console.log(`Users API returned ${response.status} - falling back to sample data`);
    } catch (error) {
      console.error("Error accessing users API:", error);
    }
    
    // Return sample data if API call fails
    console.log('Returning sample users data');
    return NextResponse.json(sampleUsers);
  } catch (error) {
    console.error('Error in users API route:', error);
    return NextResponse.json(sampleUsers);
  }
} 