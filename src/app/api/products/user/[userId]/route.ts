import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const products = await prisma.product.findMany({
      where: { userId: params.userId },
      include: {
        category: true,
        media: true,
      },
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error('Kullanıcı ürünleri getirilirken hata:', error);
    return NextResponse.json(
      { error: 'Kullanıcı ürünleri getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 