import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from "@/lib/backend-auth"; // Use backend-auth
import { env } from "@/lib/env"; // Import env config

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
    const token = getTokenFromRequest(req); // Use backend-auth helper
    console.log(`[API][${url}] Token found: ${!!token}`);

    if (!token) {
      console.error(`[API][${url}] Unauthorized: No token found`);
      return NextResponse.json({ error: 'Unauthorized - no token' }, { status: 401 });
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;

    // Try fetching online users first
    try {
      const onlineApiUrl = baseUrl.endsWith('/api') 
        ? `${baseUrl}/users/online`
        : `${baseUrl}/api/users/online`;

      console.log(`[API][${url}] Attempting to fetch ONLINE users from backend: ${onlineApiUrl}`);
      const onlineResponse = await fetch(onlineApiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`[API][${url}] Backend ONLINE response status: ${onlineResponse.status}`);

      if (onlineResponse.ok) {
        const data = await onlineResponse.json();
        console.log(`[API][${url}] Successfully fetched online users from backend.`);
        return NextResponse.json(data);
      }
      
      // If it's a 404 or 403, the endpoint likely doesn't exist
      console.warn(`[API][${url}] Backend ONLINE fetch failed (${onlineResponse.status}). Falling back to regular users endpoint.`);
    } catch (error) {
      console.error(`[API][${url}] Error fetching ONLINE users from backend:`, error);
      console.warn(`[API][${url}] Falling back to regular users endpoint due to error.`);
    }

    // Fall back to regular users endpoint since online users may not be implemented
    const usersApiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/users`
      : `${baseUrl}/api/users`;

    console.log(`[API][${url}] Fetching ALL users from backend: ${usersApiUrl}`);
    const usersResponse = await fetch(usersApiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`[API][${url}] Backend ALL users response status: ${usersResponse.status}`);

    if (usersResponse.ok) {
      const userData = await usersResponse.json();
      console.log(`[API][${url}] Successfully fetched ALL users. Raw data:`, userData);
      
      // Format the response to look like an online users response
      // Exclude current user from the list
      const currentUserId = req.headers.get('x-user-id'); // Assuming frontend sends this
      console.log(`[API][${url}] Current User ID from header: ${currentUserId}`);
      let users: User[] = Array.isArray(userData) ? userData : (userData.users || []);
      
      if (currentUserId) {
        users = users.filter((user: User) => user.id !== currentUserId);
        console.log(`[API][${url}] Filtered out current user. Users remaining: ${users.length}`);
      }
      
      // Mark all as "online" for now - in a real implementation, you'd have a way to track this
      users = users.map((user: User) => ({
        ...user,
        isOnline: true // Mocking online status
      }));
      
      console.log(`[API][${url}] Sending processed users (mocked as online):`, users);
      return NextResponse.json({ users });
    }
    
    // If we still can't get users, return mock data with proper names/usernames
    console.warn(`[API][${url}] Backend ALL users fetch failed (${usersResponse.status}). Falling back to mock data.`);
    const mockUsers = [
      { id: 'user1', username: 'johndoe', name: 'John Doe', isOnline: true },
      { id: 'user2', username: 'janedoe', name: 'Jane Doe', isOnline: true },
      { id: 'user3', username: 'bobsmith', name: 'Bob Smith', isOnline: true },
    ];
    console.log(`[API][${url}] Returning mock online users:`, mockUsers);
    return NextResponse.json({ users: mockUsers });

  } catch (error) {
    console.error(`[API][${url}] Unexpected error in GET handler:`, error);
    // Return mock data during development if there's an error
    const mockUsers = [
      { id: 'user1', username: 'johndoe', name: 'John Doe', isOnline: true },
      { id: 'user2', username: 'janedoe', name: 'Jane Doe', isOnline: true },
      { id: 'user3', username: 'bobsmith', name: 'Bob Smith', isOnline: true },
    ];
    console.log(`[API][${url}] Returning mock online users due to error:`, mockUsers);
    return NextResponse.json({ users: mockUsers }, { status: 500 });
  }
} 