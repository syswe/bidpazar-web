import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    
    logger.info('API GET /api/products/category/[categoryId]', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { categoryId }
    });
    
    logger.debug('Fetching products by category', { categoryId });
    const products = await prisma.product.findMany({
      where: { categoryId },
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
    
    // Add images property to each product by filtering media items of type 'image'
    const productsWithImages = products.map(product => ({
      ...product,
      images: product.media?.filter(m => m.type === 'image') || []
    }));
    
    logger.info('Successfully retrieved products by category', { 
      categoryId,
      count: products.length,
      productIds: products.map(p => p.id)
    });

    return NextResponse.json(productsWithImages);
  } catch (error: any) {
    // Ensure we have a valid categoryId for logging
    let errorCategoryId = "unknown";
    try {
      errorCategoryId = (await params)?.categoryId || "unknown";
    } catch {
      // If we can't get the categoryId, we'll use the default "unknown"
    }
    
    logger.error('Error retrieving category products', {
      error: error.message,
      stack: error.stack,
      categoryId: errorCategoryId
    });
    
    return NextResponse.json(
      { error: 'Kategori ürünleri getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 