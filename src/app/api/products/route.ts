import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Schema for product creation
const createProductSchema = z.object({
  title: z.string().min(1, 'Başlık gereklidir'),
  description: z.string().min(1, 'Açıklama gereklidir'),
  price: z.number().positive('Fiyat pozitif olmalıdır'),
  categoryId: z.string().min(1, 'Kategori gereklidir'),
});

export async function GET(request: Request) {
  logger.info('API GET /api/products', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
  });
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        media: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(products);
  } catch (error: any) {
    logger.error('Ürünler getirilirken hata', error);
    return NextResponse.json(
      { error: 'Ürünler getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API POST /api/products', { headers, body });
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

    const validatedData = createProductSchema.parse({
      ...body,
      price: Number(body.price),
    });

    const product = await prisma.product.create({
      data: {
        ...validatedData,
        userId: user.id,
      },
      include: {
        category: true,
        media: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    logger.error('Ürün oluşturulurken hata', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Ürün oluşturulurken bir hata oluştu' },
      { status: 500 }
    );
  }
} 