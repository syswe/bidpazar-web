import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateVerificationCode, sendVerificationCode } from '@/lib/sms';
import { logger } from '@/lib/logger';

const registerSchema = z.object({
  email: z.string()
    .email('Geçersiz e-posta adresi. Lütfen geçerli bir e-posta adresi giriniz (örn: user@example.com)')
    .refine(email => {
      // Additional email validation to ensure domain has at least 2 chars (.com, .org, etc)
      const parts = email.split('@');
      if (parts.length !== 2) return false;
      
      const domain = parts[1];
      const domainParts = domain.split('.');
      
      return domainParts.length >= 2 && domainParts[domainParts.length - 1].length >= 2;
    }, {
      message: 'E-posta adresi geçerli bir domain içermelidir (örn: example.com)'
    }),
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalıdır'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API POST /api/auth/register', { headers, body });
  try {
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username },
          ...(validatedData.phoneNumber ? [{ phoneNumber: validatedData.phoneNumber }] : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email, username, or phone number already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Generate verification code if phone number is provided
    let verificationCode = null;
    if (validatedData.phoneNumber) {
      verificationCode = generateVerificationCode();
      const smsSent = await sendVerificationCode(validatedData.phoneNumber, verificationCode);
      
      if (!smsSent) {
        return NextResponse.json(
          { error: 'Failed to send verification SMS' },
          { status: 500 }
        );
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        password: hashedPassword,
        name: validatedData.name,
        phoneNumber: validatedData.phoneNumber,
        verificationCode,
        isVerified: !validatedData.phoneNumber, // If no phone number, mark as verified
      },
    });

    // Remove sensitive data from response
    const { password, verificationCode: _, ...userWithoutSensitiveInfo } = user;

    let token = null;
    if (!validatedData.phoneNumber) {
      // Auto-verified, issue JWT
      token = require('jsonwebtoken').sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin ?? false,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
    }

    return NextResponse.json(
      { 
        message: validatedData.phoneNumber 
          ? 'User created successfully. Please verify your phone number.' 
          : 'User created successfully.',
        user: userWithoutSensitiveInfo,
        requireVerification: !!validatedData.phoneNumber,
        ...(token ? { token } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid input data in register', error);
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Registration error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 