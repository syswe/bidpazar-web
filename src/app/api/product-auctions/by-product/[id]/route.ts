import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { finalizeProductAuctionIfExpired } from '@/lib/server/productAuctionUtils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    logger.info('API GET /api/product-auctions/by-product/[id]', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id }
    });
    
    logger.debug('Fetching product auction by product ID', { productId: id });
    
    // Find active auction for this product
    const auction = await prisma.productAuction.findFirst({
      where: { 
        productId: id,
        status: 'ACTIVE'
      },
      include: {
        product: {
          include: {
            media: true,
            category: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        bids: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            amount: 'desc',
          },
          take: 10,
        },
      },
    });
    
    if (!auction) {
      logger.debug('No active auction found for product', { productId: id });
      return NextResponse.json(null);
    }

    if (auction.endTime && auction.endTime <= new Date()) {
      await finalizeProductAuctionIfExpired(auction.id);
      return NextResponse.json(null);
    }
    
    // Add images property to product by filtering media items of type 'image'
    const auctionWithImages = {
      ...auction,
      product: auction.product ? {
        ...auction.product,
        images: auction.product.media?.filter((m: any) => m.type === 'image') || []
      } : null
    };
    
    logger.info('Successfully retrieved auction by product ID', { 
      productId: id,
      auctionId: auction.id
    });

    return NextResponse.json(auctionWithImages);
  } catch (error: any) {
    logger.error('Error retrieving auction by product ID', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      productId: (await params).id
    });
    
    return NextResponse.json(
      { error: 'Açık artırma getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 
