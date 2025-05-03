import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    const products = await prisma.product.findMany({
      where: { categoryId },
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