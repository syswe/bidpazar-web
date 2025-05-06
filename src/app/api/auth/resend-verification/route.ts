import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { generateVerificationCode, sendVerificationCode } from '@/lib/sms';
import { logger } from '@/lib/logger';

const resendSchema = z.object({
  userId: z.string(),
});

export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API POST /api/auth/resend-verification', { headers, body });
  try {
    const { userId } = resendSchema.parse(body);

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
      smsSent = await sendVerificationCode(user.phoneNumber, verificationCode);
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