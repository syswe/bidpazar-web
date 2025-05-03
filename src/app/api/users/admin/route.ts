import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';

// Schema for admin role update
const updateAdminRoleSchema = z.object({
  userId: z.string().min(1, 'Kullanıcı ID gereklidir'),
  isAdmin: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const adminUser = await getUserFromToken(token);
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateAdminRoleSchema.parse(body);

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Update user's admin status
    const updatedUser = await prisma.user.update({
      where: { id: validatedData.userId },
      data: { isAdmin: validatedData.isAdmin },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: `Kullanıcı ${validatedData.isAdmin ? 'admin yapıldı' : 'admin yetkisi kaldırıldı'}`,
      user: updatedUser,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Admin rolü güncellenirken hata:', error);
    return NextResponse.json(
      { error: 'Admin rolü güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 