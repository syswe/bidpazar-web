import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  logger.info('API GET /api/products/user', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url
  });
  
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      logger.warn('Unauthorized access attempt to user products', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('Invalid token for user products access', {
        url: request.url,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Fetching products for user', { userId: user.id });
    const products = await prisma.product.findMany({
      where: { userId: user.id },
      include: {
        category: true,
        media: true,
      },
    });
    
    // Add images property to each product by filtering media items of type 'image'
    const productsWithImages = products.map(product => ({
      ...product,
      images: product.media?.filter(m => m.type === 'image') || []
    }));
    
    logger.info('Successfully retrieved user products', { 
      userId: user.id,
      count: products.length,
      productIds: products.map(p => p.id)
    });

    return NextResponse.json(productsWithImages);
  } catch (error: any) {
    logger.error('Error retrieving user products', {
      error: error.message,
      stack: error.stack,
      url: request.url
    });
    
    return NextResponse.json(
      { error: 'Kullanıcı ürünleri getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 