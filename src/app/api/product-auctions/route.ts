import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { calculateMinimumBidIncrement } from '@/lib/utils';
import { finalizeExpiredProductAuctions } from '@/lib/server/productAuctionUtils';

// Schema for product auction creation
const createProductAuctionSchema = z.object({
  productId: z.string().min(1, 'Ürün ID gereklidir'),
  startPrice: z.number().positive('Başlangıç fiyatı pozitif olmalıdır'),
  duration: z.number().refine(val => [1, 3, 5, 7].includes(val), {
    message: 'Açık artırma süresi 1, 3, 5 veya 7 gün olmalıdır'
  }),
});

// GET /api/product-auctions - Get all product auctions
export async function GET(request: Request) {
  logger.info('API GET /api/product-auctions', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
    query: Object.fromEntries(new URL(request.url).searchParams.entries()),
  });
  
  try {
    await finalizeExpiredProductAuctions();
    logger.debug('Fetching product auctions from database');
    
    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    
    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }

    logger.debug('Executing prisma query with filters', { where });
    
    // Execute prisma query
    const auctions = await (prisma as any).productAuction.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Add images property to products by filtering media items of type 'image'
    logger.debug('Processing auction results to add image properties', { auctionCount: auctions.length });
    
    const auctionsWithImages = auctions.map((auction: any) => ({
      ...auction,
      product: auction.product ? {
        ...auction.product,
        images: auction.product.media?.filter((m: any) => m.type === 'image') || []
      } : null
    }));
    
    logger.info('Successfully retrieved product auctions', { 
      count: auctions.length
    });

    return NextResponse.json(auctionsWithImages);
  } catch (error: any) {
    logger.error('Error retrieving product auctions from database', {
      error: error.message,
      stack: error.stack,
      url: request.url
    });
    return NextResponse.json(
      { error: 'Açık artırmalar getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// POST /api/product-auctions - Create a product auction
export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  
  logger.info('API POST /api/product-auctions - Request received', { 
    url: request.url,
    headers: {
      ...headers,
      authorization: headers.authorization ? 'Bearer [REDACTED]' : undefined
    }
  });
  
  try {
    body = await request.json();
    logger.debug('Request body for product auction creation', { 
      productId: body.productId,
      startPrice: body.startPrice,
      duration: body.duration
    });
  } catch (error) {
    logger.error('Failed to parse request body for product auction creation', { error });
    body = undefined;
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }
  
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      logger.warn('Product auction creation attempt without authentication token');
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Verifying user authentication token');
    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('Product auction creation attempt with invalid token');
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    logger.debug('Validating product auction data', { userId: user.id });
    const validatedData = createProductAuctionSchema.parse(body);

    // Check if product exists and belongs to the user
    logger.debug('Checking product ownership', { productId: validatedData.productId, userId: user.id });
    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId }
    });

    if (!product) {
      logger.warn('Product not found for auction creation', { 
        productId: validatedData.productId,
        userId: user.id 
      });
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    if (product.userId !== user.id) {
      logger.warn('User attempted to create auction for another user\'s product', { 
        productId: validatedData.productId,
        productOwner: product.userId,
        requestingUser: user.id 
      });
      return NextResponse.json(
        { error: 'Bu ürün için açık artırma oluşturma yetkiniz yok' },
        { status: 403 }
      );
    }

    // Check if there's already an active auction for this product
    logger.debug('Checking for existing active auctions', { productId: validatedData.productId });
    const existingAuction = await prisma.productAuction.findFirst({
      where: {
        productId: validatedData.productId,
        status: {
          in: ['PENDING', 'ACTIVE']
        }
      }
    });

    if (existingAuction) {
      logger.warn('Attempted to create duplicate auction for product', { 
        productId: validatedData.productId,
        existingAuctionId: existingAuction.id,
        userId: user.id 
      });
      return NextResponse.json(
        { error: 'Bu ürün için zaten aktif bir açık artırma bulunmaktadır' },
        { status: 400 }
      );
    }

    // Calculate the end time based on duration (in days)
    const startTime = new Date();
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + validatedData.duration);

    logger.debug('Creating product auction in database', { 
      userId: user.id,
      productId: validatedData.productId,
      duration: validatedData.duration,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });
    
    // Calculate minimum bid increment based on start price
    const minimumBidIncrement = calculateMinimumBidIncrement(validatedData.startPrice);
    
    logger.debug('Calculated minimum bid increment', { 
      startPrice: validatedData.startPrice,
      minimumBidIncrement
    });
    
    // Execute create
    const auction = await prisma.productAuction.create({
      data: {
        productId: validatedData.productId,
        startPrice: validatedData.startPrice,
        currentPrice: validatedData.startPrice,
        minimumBidIncrement,
        duration: validatedData.duration,
        status: 'ACTIVE',
        startTime,
        endTime,
      },
      include: {
        product: {
          include: {
            media: true,
            category: true,
          },
        },
      },
    });

    logger.info('Product auction created successfully', { 
      auctionId: auction.id,
      userId: user.id,
      productId: auction.productId,
      endTime: auction.endTime
    });

    // Add images property to product by filtering media items of type 'image'
    const auctionWithImages = {
      ...auction,
      product: auction.product ? {
        ...auction.product,
        images: auction.product.media?.filter((m: any) => m.type === 'image') || []
      } : null
    };

    return NextResponse.json(auctionWithImages, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn('Product auction creation validation error', { 
        errors: error.errors,
        body 
      });
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    logger.error('Product auction creation failed', { 
      error: error.message,
      stack: error.stack,
      body: body ? {
        productId: body.productId,
        startPrice: body.startPrice,
        duration: body.duration
      } : 'No body'
    });

    return NextResponse.json(
      { error: 'Açık artırma oluşturulurken bir hata oluştu' },
      { status: 500 }
    );
  }
} 
