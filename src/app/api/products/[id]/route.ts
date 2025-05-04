import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Schema for product update
const updateProductSchema = z.object({
  title: z.string().min(1, 'Başlık gereklidir').optional(),
  description: z.string().min(1, 'Açıklama gereklidir').optional(),
  price: z.number().positive('Fiyat pozitif olmalıdır').optional(),
  categoryId: z.string().min(1, 'Kategori gereklidir').optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure params.id is valid
    const { id } = await params;
    
    logger.info('API GET /api/products/[id]', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id }
    });
    
    logger.debug('Fetching product from database', { productId: id });
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
      logger.warn('Product not found', { productId: id });
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    // Add images property by mapping the media array to maintain backward compatibility
    const productWithImages = {
      ...product,
      images: product.media?.filter(m => m.type === 'image') || []
    };

    logger.info('Product retrieved successfully', { 
      productId: id,
      title: product.title,
      userId: product.userId,
      mediaCount: product.media?.length || 0,
      imagesCount: productWithImages.images.length
    });
    
    return NextResponse.json(productWithImages);
  } catch (error: any) {
    logger.error('Error retrieving product', {
      error: error.message,
      stack: error.stack,
      url: request.url
    });
    return NextResponse.json(
      { error: 'Ürün getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    logger.info('API PUT /api/products/[id]', {
      url: request.url,
      params: { id }
    });
    
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      logger.warn('Product update attempt without authentication token', { productId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Verifying user authentication for product update', { productId: id });
    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('Product update attempt with invalid token', { productId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Check if product exists and belongs to user
    logger.debug('Checking product ownership', { productId: id, userId: user.id });
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      logger.warn('Product not found for update', { productId: id, userId: user.id });
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    if (existingProduct.userId !== user.id) {
      logger.warn('Unauthorized product update attempt', { 
        productId: id, 
        requestingUserId: user.id,
        ownerUserId: existingProduct.userId
      });
      return NextResponse.json(
        { error: 'Bu ürünü düzenleme yetkiniz yok' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
      logger.debug('Request body for product update', { 
        productId: id,
        updatedFields: Object.keys(body)
      });
    } catch (error) {
      logger.error('Failed to parse request body for product update', { 
        error, 
        productId: id 
      });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    logger.debug('Validating product update data', { productId: id });
    const validatedData = updateProductSchema.parse({
      ...body,
      price: body.price ? Number(body.price) : undefined,
    });

    logger.debug('Updating product in database', { productId: id, fields: Object.keys(validatedData) });
    const product = await prisma.product.update({
      where: { id },
      data: validatedData,
      include: {
        category: true,
        media: true,
      },
    });

    logger.info('Product updated successfully', { 
      productId: id,
      userId: user.id,
      title: product.title
    });

    return NextResponse.json(product);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn('Product update validation error', { 
        errors: error.errors,
        params: await params
      });
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    logger.error('Error updating product', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      params: await params.catch(() => ({}))
    });
    return NextResponse.json(
      { error: 'Ürün güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    logger.info('API DELETE /api/products/[id]', {
      url: request.url,
      params: { id }
    });
    
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      logger.warn('Product deletion attempt without authentication token', { productId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Verifying user authentication for product deletion', { productId: id });
    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('Product deletion attempt with invalid token', { productId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Check if product exists and belongs to user
    logger.debug('Checking product ownership before deletion', { productId: id, userId: user.id });
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      logger.warn('Product not found for deletion', { productId: id, userId: user.id });
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    if (existingProduct.userId !== user.id) {
      logger.warn('Unauthorized product deletion attempt', { 
        productId: id, 
        requestingUserId: user.id,
        ownerUserId: existingProduct.userId
      });
      return NextResponse.json(
        { error: 'Bu ürünü silme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Delete product media first
    logger.debug('Deleting product media', { productId: id });
    const mediaDeleteResult = await prisma.productMedia.deleteMany({
      where: { productId: id },
    });
    logger.debug('Media deletion result', { 
      productId: id, 
      deletedCount: mediaDeleteResult.count 
    });

    // Delete the product
    logger.debug('Deleting product', { productId: id });
    await prisma.product.delete({
      where: { id },
    });

    logger.info('Product deleted successfully', { 
      productId: id,
      userId: user.id,
      title: existingProduct.title
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logger.error('Error deleting product', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      params: await params.catch(() => ({}))
    });
    return NextResponse.json(
      { error: 'Ürün silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 