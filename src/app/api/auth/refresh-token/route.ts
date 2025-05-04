import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    logger.info('[API] POST /api/auth/refresh-token - Attempting to refresh token');
    
    // Extract token from request
    let token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      // Try to get token from cookies
      token = req.cookies.get('token')?.value;
    }
    
    if (!token) {
      logger.warn('[API] Refresh token failed - No token provided');
      return NextResponse.json(
        { message: 'No token provided' },
        { status: 401 }
      );
    }
    
    // Verify the token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
        username: string;
        isAdmin: boolean;
      };
      
      // Fetch the user to ensure they still exist
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          phoneNumber: true,
          isVerified: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        logger.warn('[API] Refresh token failed - User not found');
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }

      // Generate a new token
      const newToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin ?? false,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Create response
      const response = NextResponse.json({
        message: 'Token refreshed successfully',
        token: newToken,
        user: user,
      });

      // Set cookie
      response.cookies.set('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      logger.info('[API] Token refreshed successfully for user:', user.username);
      return response;
    } catch (error) {
      logger.error('[API] Token verification failed:', error);
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    logger.error('[API] Error refreshing token:', error);
    return NextResponse.json(
      { message: 'Failed to refresh token' },
      { status: 500 }
    );
  }
} 