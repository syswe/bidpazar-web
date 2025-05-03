import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Schema for category creation
const createCategorySchema = z.object({
  name: z.string().min(1, 'Kategori adı gereklidir'),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

// Schema for category update
const updateCategorySchema = z.object({
  name: z.string().min(1, 'Kategori adı gereklidir').optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

export async function GET(request: Request) {
  logger.info('API GET /api/categories', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
  });
  try {
    const categories = await prisma.category.findMany({
      include: {
        parent: true,
        children: true,
        products: true,
      },
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    logger.error('Kategoriler getirilirken hata', error);
    return NextResponse.json(
      { error: 'Kategoriler getirilirken bir hata oluştu' },
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
  logger.info('API POST /api/categories', { headers, body });
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }

    const validatedData = createCategorySchema.parse(body);

    // If parentId is provided, check if parent category exists
    if (validatedData.parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: validatedData.parentId },
      });

      if (!parentCategory) {
        return NextResponse.json(
          { error: 'Belirtilen üst kategori bulunamadı' },
          { status: 404 }
        );
      }
    }

    const category = await prisma.category.create({
      data: validatedData,
      include: {
        parent: true,
        children: true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    logger.error('Kategori oluşturulurken hata', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Kategori oluşturulurken bir hata oluştu' },
      { status: 500 }
    );
  }
} 