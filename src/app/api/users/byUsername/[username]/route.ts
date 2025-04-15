import { NextRequest, NextResponse } from 'next/server';

// Sample users from the main users route
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
    // Extract the username from the URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const usernameIndex = pathParts.indexOf('byUsername');
    const username = usernameIndex >= 0 ? pathParts[usernameIndex + 1] : null;
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Only check request headers for token (server-side can't access localStorage)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      console.error('API route /api/users/byUsername/[username]: No token found in request headers');
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Remove the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/users/byUsername/${username}`
      : `${baseUrl}/api/users/byUsername/${username}`;

    // Try to fetch real user first
    try {
      console.log(`Trying to fetch user by username from: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      
      console.log(`Users API returned ${response.status} - falling back to sample data`);
    } catch (error) {
      console.error("Error accessing user API:", error);
    }
    
    // Fall back to sample data if API call fails
    const sampleUser = sampleUsers.find(user => 
      user.username.toLowerCase() === username.toLowerCase()
    );
    
    // Add "bbb" as a valid username for testing
    if (username.toLowerCase() === 'bbb') {
      const bbbUser = {
        id: 'user-bbb',
        username: 'bbb',
        name: 'Test User BBB',
        email: 'bbb@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return NextResponse.json(bbbUser);
    }
    
    if (!sampleUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(sampleUser);
  } catch (error) {
    console.error('Error in users/byUsername API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 