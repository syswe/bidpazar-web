import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Check if product exists and belongs to user
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    if (existingProduct.userId !== user.id) {
      return NextResponse.json(
        { error: 'Bu ürüne dosya yükleme yetkiniz yok' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'En az bir dosya yüklenmelidir' },
        { status: 400 }
      );
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    const uploadedFiles = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate unique filename
      const extension = file.name.split('.').pop();
      const filename = `${uuidv4()}.${extension}`;
      const path = join(uploadsDir, filename);

      // Save file
      await writeFile(path, buffer);

      // Create media record
      const media = await prisma.productMedia.create({
        data: {
          productId: params.id,
          url: `/uploads/${filename}`,
          type: file.type.startsWith('image/') ? 'image' : 'video',
        },
      });

      uploadedFiles.push(media);
    }

    return NextResponse.json(uploadedFiles, { status: 201 });
  } catch (error: any) {
    console.error('Dosya yüklenirken hata:', error);
    return NextResponse.json(
      { error: 'Dosya yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 