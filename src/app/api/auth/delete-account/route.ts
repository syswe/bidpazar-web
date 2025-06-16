import { NextRequest } from 'next/server';
import { getUserFromTokenInNode } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json(
        { error: 'Yetkilendirme token\'ı gerekli' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return Response.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      );
    }

    console.log(`[DeleteAccount] Deleting account for user: ${user.username} (${user.id})`);

    // Delete user and all related data manually (since cascade delete is not fully configured)
    // We need to delete in the correct order to avoid foreign key constraint violations
    
    await prisma.$transaction(async (tx) => {
      // Delete notifications
      await tx.notification.deleteMany({ where: { userId: user.id } });
      
      // Delete messages (both sent and received)
      await tx.message.deleteMany({ 
        where: { 
          OR: [
            { senderId: user.id },
            { receiverId: user.id }
          ]
        }
      });
      
      // Delete bids
      await tx.bid.deleteMany({ where: { userId: user.id } });
      
      // Delete chat messages
      await tx.chatMessage.deleteMany({ where: { userId: user.id } });
      
      // Delete stream-related data
      await tx.streamViewTime.deleteMany({ where: { userId: user.id } });
      await tx.streamShare.deleteMany({ where: { userId: user.id } });
      await tx.streamModeration.deleteMany({ where: { userId: user.id } });
      
      // Delete auction listings (from user's live streams)
      const userStreams = await tx.liveStream.findMany({
        where: { userId: user.id },
        select: { id: true }
      });
      
      if (userStreams.length > 0) {
        const streamIds = userStreams.map(s => s.id);
        
        // Delete bids from auction listings in user's streams
        await tx.bid.deleteMany({ 
          where: { 
            listing: { 
              liveStreamId: { in: streamIds } 
            } 
          } 
        });
        
        // Delete auction listings
        await tx.auctionListing.deleteMany({ 
          where: { liveStreamId: { in: streamIds } } 
        });
        
        // Delete stream analytics, highlights, rewards, etc.
        await tx.streamAnalytics.deleteMany({ where: { liveStreamId: { in: streamIds } } });
        await tx.streamHighlight.deleteMany({ where: { liveStreamId: { in: streamIds } } });
        await tx.streamReward.deleteMany({ where: { liveStreamId: { in: streamIds } } });
        await tx.chatMessage.deleteMany({ where: { liveStreamId: { in: streamIds } } });
      }
      
      // Delete user's live streams
      await tx.liveStream.deleteMany({ where: { userId: user.id } });
      
      // Delete product auctions and related bids
      const userProducts = await tx.product.findMany({
        where: { userId: user.id },
        select: { id: true }
      });
      
      if (userProducts.length > 0) {
        const productIds = userProducts.map(p => p.id);
        
        // Delete bids from product auctions
        await tx.bid.deleteMany({ 
          where: { 
            productAuction: { 
              productId: { in: productIds } 
            } 
          } 
        });
        
        // Delete product auctions
        await tx.productAuction.deleteMany({ 
          where: { productId: { in: productIds } } 
        });
        
        // Delete product media
        await tx.productMedia.deleteMany({ 
          where: { productId: { in: productIds } } 
        });
      }
      
      // Delete user's products
      await tx.product.deleteMany({ where: { userId: user.id } });
      
      // Delete user's stories
      await tx.story.deleteMany({ where: { userId: user.id } });
      
      // Delete seller requests
      // TODO: Fix Prisma model name for seller requests
      // await tx.sellerRequest.deleteMany({ where: { userId: user.id } });
      
      // Remove user from conversations (many-to-many relationship)
      await tx.user.update({
        where: { id: user.id },
        data: {
          conversations: {
            set: [] // Remove from all conversations
          },
          viewedStreams: {
            set: [] // Remove from viewed streams
          },
          receivedRewards: {
            set: [] // Remove from received rewards
          }
        }
      });
      
      // Finally, delete the user
      await tx.user.delete({
        where: { id: user.id }
      });
    });

    console.log(`[DeleteAccount] Successfully deleted account for user: ${user.username}`);

    return Response.json(
      { message: 'Hesabınız başarıyla silindi' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[DeleteAccount] Error deleting account:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return Response.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    return Response.json(
      { error: 'Hesap silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 