import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Schema for profile update
const updateProfileSchema = z.object({
  username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalıdır').optional(),
  name: z.string().min(2, 'İsim en az 2 karakter olmalıdır').optional(),
  email: z.string().email('Geçerli bir e-posta adresi giriniz').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermelidir')
    .regex(/[a-z]/, 'Şifre en az bir küçük harf içermelidir')
    .regex(/[0-9]/, 'Şifre en az bir rakam içermelidir')
    .optional(),
});

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Get user profile
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phoneNumber: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('Profil bilgileri getirilirken hata:', error);
    return NextResponse.json(
      { error: 'Profil bilgileri getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // If changing password, verify current password
    if (validatedData.newPassword) {
      if (!validatedData.currentPassword) {
        return NextResponse.json(
          { error: 'Mevcut şifre gereklidir' },
          { status: 400 }
        );
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });

      if (!currentUser) {
        return NextResponse.json(
          { error: 'Kullanıcı bulunamadı' },
          { status: 404 }
        );
      }

      const isPasswordValid = await bcrypt.compare(
        validatedData.currentPassword,
        currentUser.password
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Mevcut şifre yanlış' },
          { status: 400 }
        );
      }
    }

    // Check if username or email is already taken
    if (validatedData.username || validatedData.email) {
      const whereConditions = [];
      
      if (validatedData.username) {
        whereConditions.push({
          username: validatedData.username,
          NOT: { id: user.id }
        });
      }
      
      if (validatedData.email) {
        whereConditions.push({
          email: validatedData.email,
          NOT: { id: user.id }
        });
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: whereConditions
        },
      });

      if (existingUser) {
        return NextResponse.json(
          {
            error: `Bu ${
              existingUser.username === validatedData.username
                ? 'kullanıcı adı'
                : 'e-posta adresi'
            } zaten kullanılıyor`,
          },
          { status: 400 }
        );
      }
    }

    // Update user profile
    const updateData: any = {
      ...(validatedData.username && { username: validatedData.username }),
      ...(validatedData.name && { name: validatedData.name }),
      ...(validatedData.email && { email: validatedData.email }),
      ...(validatedData.newPassword && {
        password: await bcrypt.hash(validatedData.newPassword, 10),
      }),
    };

    const updatedProfile = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phoneNumber: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: 'Profil başarıyla güncellendi',
      user: updatedProfile,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Profil güncellenirken hata:', error);
    return NextResponse.json(
      { error: 'Profil güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 