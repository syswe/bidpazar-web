import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserFromToken, getTokenFromRequest } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { validateBidAmount, calculateMinimumBidIncrement } from '@/lib/utils';
import { finalizeProductAuctionIfExpired } from '@/lib/server/productAuctionUtils';

// Validation schema
const bidSchema = z.object({
  amount: z.number().positive('Teklif tutarı pozitif olmalıdır'),
});

// GET /api/product-auctions/[id]/bids - Get bids for a product auction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    logger.info('API GET /api/product-auctions/[id]/bids', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id }
    });
    
    // Get bids for the product auction
    logger.debug('Fetching bids for product auction', { auctionId: id });
    const bids = await prisma.bid.findMany({
      where: { 
        productAuctionId: id 
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        amount: 'desc',
      },
    });

    logger.info('Successfully retrieved auction bids', { 
      auctionId: id,
      bidCount: bids.length
    });

    return NextResponse.json(bids);
  } catch (error: any) {
    logger.error('Error fetching auction bids', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      auctionId: (await params).id
    });
    
    return NextResponse.json(
      { error: 'Teklifler getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// POST /api/product-auctions/[id]/bids - Place a bid on a product auction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    logger.info('API POST /api/product-auctions/[id]/bids', {
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      params: { id }
    });
    
    // Verify user is authenticated
    const token = getTokenFromRequest(request);
    if (!token) {
      logger.warn('Bid attempt without authentication token', { auctionId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(token);
    if (!user) {
      logger.warn('Bid attempt with invalid token', { auctionId: id });
      return NextResponse.json(
        { error: 'Kimlik doğrulama gereklidir' },
        { status: 401 }
      );
    }

    // Parse and validate the bid data
    const body = await request.json();
    logger.debug('Validating bid data', { 
      auctionId: id, 
      userId: user.id,
      bidAmount: body.amount
    });
    
    const validatedData = bidSchema.parse(body);

    // Find the auction using Prisma client
    logger.debug('Retrieving auction details', { auctionId: id });
    const auction = await prisma.productAuction.findUnique({
      where: { id },
      include: {
        product: true,
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
        },
      },
    });

    if (!auction) {
      logger.warn('Bid attempt on non-existent auction', { auctionId: id, userId: user.id });
      return NextResponse.json(
        { error: 'Açık artırma bulunamadı' },
        { status: 404 }
      );
    }

    // Check if product is sold
    if (auction.product.isSold) {
      logger.warn('Bid attempt on sold product', {
        auctionId: id,
        userId: user.id,
        productId: auction.product.id
      });
      return NextResponse.json(
        { error: 'Bu ürün satılmıştır, teklif verilemez' },
        { status: 400 }
      );
    }

    if (auction.endTime && auction.endTime <= new Date()) {
      await finalizeProductAuctionIfExpired(auction.id);
      return NextResponse.json(
        { error: 'Bu açık artırma sona erdi' },
        { status: 400 }
      );
    }

    // Validate auction is active and not owned by bidder
    logger.debug('Validating auction status and ownership', { 
      auctionId: id, 
      userId: user.id, 
      status: auction.status,
      productOwner: auction.product.userId
    });
    
    if (auction.status !== 'ACTIVE') {
      logger.warn('Bid attempt on inactive auction', { auctionId: id, userId: user.id, status: auction.status });
      return NextResponse.json(
        { error: 'Bu açık artırmaya teklif yapılamaz' },
        { status: 400 }
      );
    }

    if (auction.product.userId === user.id) {
      logger.warn('User attempted to bid on their own auction', { auctionId: id, userId: user.id });
      return NextResponse.json(
        { error: 'Kendi ürününüze teklif veremezsiniz' },
        { status: 400 }
      );
    }

    // Validate bid amount against minimum increment rules
    logger.debug('Validating bid amount against increment rules', { 
      auctionId: id, 
      userId: user.id, 
      bidAmount: validatedData.amount,
      currentPrice: auction.currentPrice
    });
    
    // Check if user already has the winning bid
    if (auction.bids.length > 0 && auction.bids[0].userId === user.id) {
      logger.warn('User attempted to outbid their own winning bid', {
        auctionId: id,
        userId: user.id,
        existingBidAmount: auction.bids[0].amount
      });
      
      return NextResponse.json(
        { error: 'Zaten en yüksek teklifi siz verdiniz. Başka bir kullanıcının teklif vermesini bekleyin.' },
        { status: 400 }
      );
    }
    
    const validation = validateBidAmount(auction.currentPrice, validatedData.amount);
    
    if (!validation.isValid) {
      logger.warn('Bid amount does not meet minimum increment requirements', { 
        auctionId: id, 
        userId: user.id, 
        bidAmount: validatedData.amount,
        currentPrice: auction.currentPrice,
        minimumAmount: validation.minimumAmount,
        requiredIncrement: validation.increment
      });
      
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Create the bid
    logger.debug('Creating new bid', { 
      auctionId: id, 
      userId: user.id, 
      amount: validatedData.amount 
    });
    
    const bid = await prisma.bid.create({
      data: {
        amount: validatedData.amount,
        userId: user.id,
        productAuctionId: id,
        isWinning: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });

    // Update any previous winning bids to no longer be winning
    if (auction.bids.length > 0) {
      logger.debug('Updating previous winning bid', { 
        auctionId: id, 
        previousBidId: auction.bids[0].id,
        newBidId: bid.id
      });
      
      await prisma.bid.updateMany({
        where: {
          id: { not: bid.id },
          productAuctionId: id,
          isWinning: true,
        },
        data: {
          isWinning: false,
          isBackup: true,
        },
      });

      // Create outbid notification for previous highest bidder
      logger.debug('Creating outbid notification', {
        userId: auction.bids[0].userId,
        newBidAmount: validatedData.amount,
        productTitle: auction.product.title
      });
      
      await prisma.notification.create({
        data: {
          userId: auction.bids[0].userId,
          content: `Teklifiniz "${auction.product.title}" ürünü için geçildi. Yeni en yüksek teklif: ${validatedData.amount} TL`,
          type: 'BID_OUTBID',
          relatedId: auction.productId,
        },
      });
    }

    // Calculate new minimum bid increment based on updated current price
    const newMinimumBidIncrement = calculateMinimumBidIncrement(validatedData.amount);
    
    // Update the auction with the new current price, winning bid, and minimum increment
    logger.debug('Updating auction with new winning bid and minimum increment', {
      auctionId: id,
      bidId: bid.id,
      newPrice: validatedData.amount,
      newMinimumIncrement: newMinimumBidIncrement
    });
    
    // Use transaction to ensure data consistency
    await prisma.productAuction.update({
      where: { id },
      data: {
        currentPrice: validatedData.amount,
        minimumBidIncrement: newMinimumBidIncrement,
        winningBidId: bid.id,
      },
    });

    // Create notification for product owner
    logger.debug('Creating notification for product owner', {
      ownerId: auction.product.userId,
      productTitle: auction.product.title,
      bidAmount: validatedData.amount
    });
    
    await prisma.notification.create({
      data: {
        userId: auction.product.userId,
        content: `"${auction.product.title}" ürününüz için yeni bir teklif var: ${validatedData.amount} TL`,
        type: 'BID_OUTBID',
        relatedId: auction.productId,
      },
    });

    logger.info('Bid placed successfully', { 
      auctionId: id, 
      bidId: bid.id,
      userId: user.id,
      amount: validatedData.amount,
      productId: auction.productId
    });

    return NextResponse.json(bid, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn('Bid validation error', { 
        errors: error.errors,
        params: await params.catch(() => ({})) 
      });
      
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    logger.error('Error placing bid', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      params: await params.catch(() => ({}))
    });
    
    return NextResponse.json(
      { error: 'Teklif verilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 
