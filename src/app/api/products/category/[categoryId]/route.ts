import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
  try {
    const products = await prisma.product.findMany({
      where: { categoryId: params.categoryId },
      include: {
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
    console.error('Kategori ürünleri getirilirken hata:', error);
    return NextResponse.json(
      { error: 'Kategori ürünleri getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 