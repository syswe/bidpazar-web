import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { generateVerificationCode, sendVerificationCode, canSendSMS } from '@/lib/sms';
import { logger } from '@/lib/logger';
import { headers } from 'next/headers';

const resendSchema = z.object({
  userId: z.string(),
});

// Helper to get client IP from headers - needs to be async since headers() returns Promise in Next.js 15
async function getClientIp(req: Request): Promise<string> {
  const headersList = await headers();
  
  // Try standard headers first
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    // Get the first IP if there are multiple
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try other common headers
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fall back to request remote address or a default
  return req.headers.get('host') || '127.0.0.1';
}

export async function POST(request: Request) {
  // Get client IP asynchronously
  const clientIp = await getClientIp(request);
  const requestHeaders = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API POST /api/auth/resend-verification', { 
    headers: requestHeaders, 
    body, 
    clientIp 
  });
  
  try {
    const { userId } = resendSchema.parse(body);

    // Rate limit check by IP first (to prevent abuse before DB lookup)
    const ipRateLimit = canSendSMS(clientIp);
    if (!ipRateLimit.allowed) {
      logger.warn('SMS rate limit exceeded for IP', { 
        clientIp, 
        reason: ipRateLimit.reason, 
        remainingDaily: ipRateLimit.dailyRemaining 
      });
      
      let statusCode = 429; // Too Many Requests
      let errorMessage = 'Too many verification attempts';
      
      if (ipRateLimit.reason === 'cooldown') {
        const retryAfterSec = Math.ceil((ipRateLimit.retryAfterMs || 0) / 1000);
        return NextResponse.json(
          { 
            error: 'Please wait before requesting another code', 
            retryAfterSec
          },
          { 
            status: statusCode,
            headers: {
              'Retry-After': retryAfterSec.toString()
            }
          }
        );
      } else {
        return NextResponse.json(
          { error: 'Daily verification limit reached. Please try again tomorrow.' },
          { status: statusCode }
        );
      }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.isVerified) {
      return NextResponse.json(
        { error: 'User is already verified' },
        { status: 400 }
      );
    }

    if (!user.phoneNumber) {
      return NextResponse.json(
        { error: 'User does not have a registered phone number' },
        { status: 400 }
      );
    }
    
    // Double rate limit check using userId (more specific than IP)
    const userRateLimit = canSendSMS(`user_${userId}`);
    if (!userRateLimit.allowed) {
      logger.warn('SMS rate limit exceeded for user', { 
        userId, 
        reason: userRateLimit.reason,
        remainingDaily: userRateLimit.dailyRemaining
      });
      
      let statusCode = 429; // Too Many Requests
      
      if (userRateLimit.reason === 'cooldown') {
        const retryAfterSec = Math.ceil((userRateLimit.retryAfterMs || 0) / 1000);
        return NextResponse.json(
          { 
            error: 'Please wait before requesting another code', 
            retryAfterSec
          },
          { 
            status: statusCode,
            headers: {
              'Retry-After': retryAfterSec.toString()
            }
          }
        );
      } else {
        return NextResponse.json(
          { error: 'Daily verification limit reached. Please try again tomorrow.' },
          { status: statusCode }
        );
      }
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    
    // Log attempt to send SMS
    logger.info(`Attempting to resend verification SMS to ${user.phoneNumber}`, {
      userId,
      phoneNumber: user.phoneNumber,
      environment: process.env.NODE_ENV,
      sendMessageMode: process.env.SEND_MESSAGE || 'undefined'
    });
    
    let smsSent = false;
    try {
      // Pass userId for rate limiting tracking
      smsSent = await sendVerificationCode(user.phoneNumber, verificationCode, `user_${userId}`);
      logger.info(`SMS resend result: ${smsSent ? 'success' : 'failed'}`);
    } catch (smsError) {
      logger.error('Error sending SMS during resend verification', { 
        error: smsError, 
        userId,
        phoneNumber: user.phoneNumber 
      });
      // We'll continue even if SMS fails
    }
    
    // If SMS failed and we're in production, log detailed error
    if (!smsSent && process.env.NODE_ENV === 'production') {
      logger.error('SMS verification resend failed in production', {
        userId,
        phoneNumber: user.phoneNumber,
        smsApiUrl: process.env.SMS_API_URL,
        smsOrigin: process.env.SMS_ORIGIN,
        // Don't log password or actual credentials
        smsUsernameSet: !!process.env.SMS_USERNAME,
        smsPasswordSet: !!process.env.SMS_PASSWORD
      });
    }

    // Update user with new verification code
    await prisma.user.update({
      where: { id: userId },
      data: { verificationCode },
    });

    return NextResponse.json({
      message: 'Verification code sent successfully',
      smsSent: smsSent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input data in resend-verification', error);
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Resend verification error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 