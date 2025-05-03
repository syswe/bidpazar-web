import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';

// Schema for product update
const updateProductSchema = z.object({
  title: z.string().min(1, 'Başlık gereklidir').optional(),
  description: z.string().min(1, 'Açıklama gereklidir').optional(),
  price: z.number().positive('Fiyat pozitif olmalıdır').optional(),
  categoryId: z.string().min(1, 'Kategori gereklidir').optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure params.id is valid
    const { id } = params;
    
    const product = await prisma.product.findUnique({
      where: { id },
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

    if (!product) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Ürün getirilirken hata:', error);
    return NextResponse.json(
      { error: 'Ürün getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
        { error: 'Bu ürünü düzenleme yetkiniz yok' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateProductSchema.parse({
      ...body,
      price: body.price ? Number(body.price) : undefined,
    });

    const product = await prisma.product.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        category: true,
        media: true,
      },
    });

    return NextResponse.json(product);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Ürün güncellenirken hata:', error);
    return NextResponse.json(
      { error: 'Ürün güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
        { error: 'Bu ürünü silme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Delete product media first
    await prisma.productMedia.deleteMany({
      where: { productId: params.id },
    });

    // Delete the product
    await prisma.product.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('Ürün silinirken hata:', error);
    return NextResponse.json(
      { error: 'Ürün silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 