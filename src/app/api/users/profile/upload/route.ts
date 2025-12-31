import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Profil fotoğrafı gereklidir' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Sadece resim dosyaları kabul edilir' },
        { status: 400 }
      );
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Dosya boyutu en fazla 5MB olabilir' },
        { status: 400 }
      );
    }

    // Create uploads directory if not exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${user.id}-${timestamp}.webp`;
    const filePath = path.join(uploadDir, fileName);

    // Convert to WebP and resize
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await sharp(buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(filePath);

    // Generate public URL
    const profileImageUrl = `/uploads/profiles/${fileName}`;

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { profileImageUrl },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        profileImageUrl: true,
        bio: true,
        userType: true,
      },
    });

    return NextResponse.json({
      message: 'Profil fotoğrafı başarıyla yüklendi',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Profil fotoğrafı yüklenirken hata:', error);
    return NextResponse.json(
      { error: 'Profil fotoğrafı yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}
