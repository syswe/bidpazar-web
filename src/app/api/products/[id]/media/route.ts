import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';

// Schema for media creation
const mediaSchema = z.object({
  url: z.string().url('Geçerli bir URL gereklidir'),
  type: z.enum(['image', 'video'], {
    errorMap: () => ({ message: "Medya tipi 'image' veya 'video' olmalıdır" }),
  }),
});

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
        { error: 'Bu ürüne medya ekleme yetkiniz yok' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = mediaSchema.parse(body);

    const media = await prisma.productMedia.create({
      data: {
        ...validatedData,
        productId: params.id,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Medya eklenirken hata:', error);
    return NextResponse.json(
      { error: 'Medya eklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 