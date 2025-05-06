import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, verifyToken } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/validate
 * Validates a token and returns the associated user's information
 */
export async function GET(request: Request) {
  logger.info('[API][/api/auth/validate] Processing token validation request');
  
  try {
    // Extract the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    let token: string | null = null;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }
    
    // If no Authorization header, check for token in cookies
    if (!token) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const tokenCookie = cookies.find(c => c.startsWith('token='));
        if (tokenCookie) {
          token = tokenCookie.substring('token='.length);
        }
      }
    }
    
    if (!token) {
      logger.warn('[API][/api/auth/validate] No token found in request');
      return NextResponse.json({ error: 'Authentication token is missing' }, { status: 401 });
    }
    
    logger.info('[API][/api/auth/validate] Verifying token');
    
    // Verify the token
    const payload = await verifyToken(token);
    if (!payload) {
      logger.warn('[API][/api/auth/validate] Invalid or expired token');
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    
    // Retrieve user information
    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('[API][/api/auth/validate] User not found for valid token');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    logger.info(`[API][/api/auth/validate] User authenticated: ${user.username}`);
    
    // Generate a fresh token to extend the session
    const newToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin || false
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    // Set the token in a HTTP-only cookie as well
    const response = NextResponse.json({
      user,
      token: newToken
    });
    
    // Set cookie with 7-day expiration
    response.cookies.set({
      name: 'token',
      value: newToken,
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax'
    });
    
    return response;
  } catch (error) {
    logger.error('[API][/api/auth/validate] Error validating token', error);
    return NextResponse.json({ error: 'Failed to validate token' }, { status: 500 });
  }
}