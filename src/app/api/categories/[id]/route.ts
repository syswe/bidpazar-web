import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';

// Schema for category update
const updateCategorySchema = z.object({
  name: z.string().min(1, 'Kategori adı gereklidir').optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        parent: true,
        children: true,
        products: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Kategori bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error: any) {
    console.error('Kategori getirilirken hata:', error);
    return NextResponse.json(
      { error: 'Kategori getirilirken bir hata oluştu' },
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
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);

    // Check for circular reference
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

      // Check if the new parent is not a child of the current category
      const isCircular = await checkCircularReference(
        params.id,
        validatedData.parentId
      );
      if (isCircular) {
        return NextResponse.json(
          { error: 'Döngüsel kategori ilişkisi oluşturulamaz' },
          { status: 400 }
        );
      }
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        parent: true,
        children: true,
      },
    });

    return NextResponse.json(category);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Kategori bulunamadı' },
        { status: 404 }
      );
    }

    console.error('Kategori güncellenirken hata:', error);
    return NextResponse.json(
      { error: 'Kategori güncellenirken bir hata oluştu' },
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
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }

    // Check if category has children
    const category = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        children: true,
        products: true,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Kategori bulunamadı' },
        { status: 404 }
      );
    }

    if (category.children.length > 0) {
      return NextResponse.json(
        { error: 'Alt kategorisi olan bir kategori silinemez' },
        { status: 400 }
      );
    }

    if (category.products.length > 0) {
      return NextResponse.json(
        { error: 'Ürünü olan bir kategori silinemez' },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { message: 'Kategori başarıyla silindi' },
      { status: 200 }
    );
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Kategori bulunamadı' },
        { status: 404 }
      );
    }

    console.error('Kategori silinirken hata:', error);
    return NextResponse.json(
      { error: 'Kategori silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Helper function to check for circular references
async function checkCircularReference(
  categoryId: string,
  newParentId: string
): Promise<boolean> {
  let currentId = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === categoryId) {
      return true; // Found a circular reference
    }

    if (visited.has(currentId)) {
      return false; // Found a cycle but not involving the target category
    }

    visited.add(currentId);

    const parent = await prisma.category.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (!parent || !parent.parentId) {
      break;
    }

    currentId = parent.parentId;
  }

  return false;
} 