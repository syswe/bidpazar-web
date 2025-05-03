import { NextRequest, NextResponse } from 'next/server';
// Use the Node.js compatible function here
import { getUserFromTokenInNode } from '@/lib/auth'; 

export async function GET(request: NextRequest) {
  console.log('[/api/auth/validate:Node] Received request.');
  // Try to get token from Authorization header first
  let token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  console.log(`[/api/auth/validate:Node] Token from header: ${!!token}`);

  // If not in header, try to get from cookies
  if (!token) {
    token = request.cookies.get('token')?.value;
    console.log(`[/api/auth/validate:Node] Token from cookies: ${!!token}`);
  }

  if (!token) {
    console.log('[/api/auth/validate:Node] No token found, returning 401.');
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  // Use the Node.js function which verifies and fetches from DB
  const user = await getUserFromTokenInNode(token);
  if (!user) {
    console.log('[/api/auth/validate:Node] getUserFromTokenInNode failed, returning 401.');
    // Clear the invalid cookie on the client side by sending back an expired cookie instruction
    const response = NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    response.cookies.set('token', '', { path: '/', maxAge: 0 });
    return response;
  }

  console.log('[/api/auth/validate:Node] Token valid, user found, returning user and token.', { userId: user.id });
  // Return both user and token for client-side storage
  const response = NextResponse.json({ user, token });
  
  // Also ensure the cookie is set with the valid token
  // Use same-site strict for security and httpOnly for XSS protection
  response.cookies.set('token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 // 1 week
  });
  
  return response;
}