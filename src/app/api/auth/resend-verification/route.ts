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
    const smsSent = await sendVerificationCode(user.phoneNumber, verificationCode);

    if (!smsSent) {
      return NextResponse.json(
        { error: 'Failed to send verification SMS' },
        { status: 500 }
      );
    }

    // Update user with new verification code
    await prisma.user.update({
      where: { id: userId },
      data: { verificationCode },
    });

    return NextResponse.json({
      message: 'Verification code sent successfully',
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