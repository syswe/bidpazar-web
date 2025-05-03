import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const products = await prisma.product.findMany({
      where: { userId },
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