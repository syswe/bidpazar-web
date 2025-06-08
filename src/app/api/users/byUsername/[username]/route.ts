import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from "@/lib/auth";
import { prisma } from '@/lib/prisma';

// Removed sampleUsers array

// This handler function follows Next.js 15.2.2 pattern for dynamic routes
export async function GET(request: NextRequest) {
  const url = request.nextUrl.pathname;
  console.log(`[API][${url}] GET request received`);
  // Extract username from the URL path
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const username = segments[segments.length - 1];
  console.log(`[API][${url}] Extracted username: ${username}`);

  try {
    if (!username) {
      console.warn(`[API][${url}] Bad Request (400): Username parameter is missing.`);
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Extract token from authorization header
    const authorization = request.headers.get('authorization');
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

    // Check if the requesting user is an admin (for access to sensitive fields)
    const isAdmin = payload.isAdmin === true;

    // Query user directly from the database
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive' // Case-insensitive search
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: isAdmin, // Only include email if admin
        phoneNumber: isAdmin, // Only include phone if admin
        isVerified: isAdmin, // Only include verification status if admin
        isAdmin: isAdmin, // Only include admin status if admin
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
            liveStreams: true
          }
        }
      }
    });

    if (!user) {
      console.error(`[API][${url}] Not Found (404): User with username '${username}' not found.`);
      return NextResponse.json({ error: `User '${username}' not found` }, { status: 404 });
    }

    console.log(`[API][${url}] Successfully fetched user data from database.`);
    return NextResponse.json(user);
    
  } catch (error: any) {
    console.error(`[API][${url}] Unexpected error in GET handler:`, error);
    // Return detailed error if available, otherwise generic message
    const errorMessage = error.message || "Internal Server Error";
    const errorStatus = error.status || 500;
    console.log(`[API][${url}] Returning error response (${errorStatus}): ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}

// Removed the fallback logic that used sampleUsers

// Removed the duplicate /api prefix if NEXT_PUBLIC_API_URL already includes it
// const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
// const apiUrl = baseUrl.endsWith('/api') 
//   ? `${baseUrl}/users/byUsername/${username}`
//   : `${baseUrl}/api/users/byUsername/${username}`;

// Directly fetch from the backend
// console.log(`Fetching user by username from: ${apiUrl}`);
// const response = await fetch(apiUrl, {
//   headers: {
//     'Authorization': `Bearer ${token}`,
//     'Content-Type': 'application/json',
//   },
// });

// Forward the backend response status and body
// const responseBody = await response.text();
// const status = response.status;

// Attempt to parse JSON, otherwise return text
// let data;
// try {
//   data = JSON.parse(responseBody);
// } catch (e) {
//   // If backend returned 404, keep the original error message if available
//   if (status === 404 && data?.error) {
//      // Keep backend's 404 error
//   } else {
//     data = { error: responseBody }; // Return raw text as error if not JSON
//   }
// }

// Return the backend response directly
// return NextResponse.json(data, { status }); 