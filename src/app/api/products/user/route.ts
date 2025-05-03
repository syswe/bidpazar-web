import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';

export async function GET(request: Request) {
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

    const products = await prisma.product.findMany({
      where: { userId: user.id },
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