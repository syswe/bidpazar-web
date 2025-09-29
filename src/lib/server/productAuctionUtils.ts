import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createOrderConversationMessage } from '@/lib/server/conversationMessaging';

const AUCTION_END_NO_BIDS_MESSAGE = (title: string) =>
  `"${title}" ürünü için açık artırma sona erdi. Ürününüzün satışı gerçekleştirilemedi. Hiç teklif almadınız.`;

/**
 * Finalize a single product auction if it has expired.
 * Returns true if the auction was transitioned away from ACTIVE state.
 */
export const finalizeProductAuctionIfExpired = async (
  auctionId: string
): Promise<{
  finalized: boolean;
  hadBids: boolean;
}> => {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.productAuction.findUnique({
      where: { id: auctionId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            userId: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!auction) {
      logger.warn('Attempted to finalize non-existent auction', { auctionId });
      return { finalized: false, hadBids: false };
    }

    if (auction.status !== 'ACTIVE') {
      return { finalized: false, hadBids: auction.winningBidId !== null };
    }

    if (!auction.endTime) {
      // Auction without an end time should remain active.
      return { finalized: false, hadBids: auction.winningBidId !== null };
    }

    const now = new Date();
    if (auction.endTime > now) {
      return { finalized: false, hadBids: auction.winningBidId !== null };
    }

    const bidCount = await tx.bid.count({
      where: { productAuctionId: auction.id },
    });

    await tx.productAuction.update({
      where: { id: auction.id },
      data: {
        status: 'COMPLETED',
        endTime: auction.endTime ?? now,
      },
    });

    logger.info('Product auction finalized due to expiration', {
      auctionId,
      bidCount,
      productId: auction.productId,
    });

    if (bidCount === 0) {
      await tx.notification.create({
        data: {
          userId: auction.product.userId,
          content: AUCTION_END_NO_BIDS_MESSAGE(auction.product.title),
          type: 'AUCTION_ENDED_NO_BIDS',
          relatedId: auction.productId,
        },
      });
    }

    if (bidCount > 0) {
      let winningBid = await tx.bid.findFirst({
        where: {
          productAuctionId: auction.id,
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
        orderBy: {
          amount: 'desc',
        },
      });

      if (!winningBid) {
        winningBid = await tx.bid.findFirst({
          where: { productAuctionId: auction.id },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
          orderBy: { amount: 'desc' },
        });
      }

      if (winningBid && winningBid.user) {
        const formattedPrice = new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
        }).format(winningBid.amount);

        await tx.notification.create({
          data: {
            userId: auction.product.userId,
            content: `${winningBid.user.username || 'Bir kullanıcı'} "${auction.product.title}" ürününüzü ${formattedPrice} teklif ile kazandı.`,
            type: 'PURCHASE',
            relatedId: auction.productId,
          },
        });

        await tx.notification.create({
          data: {
            userId: winningBid.user.id,
            content: `"${auction.product.title}" ürününü ${formattedPrice} teklifinizle kazandınız. Satıcı ile iletişim kurabilirsiniz.`,
            type: 'PURCHASE',
            relatedId: auction.productId,
          },
        });

        await createOrderConversationMessage({
          tx,
          buyer: {
            id: winningBid.user.id,
            username: winningBid.user.username,
            name: winningBid.user.name,
          },
          seller: {
            id: auction.product.userId,
            username: auction.product.user?.username,
            name: auction.product.user?.name,
          },
          product: {
            id: auction.product.id,
            title: auction.product.title,
          },
          price: winningBid.amount,
          context: 'auction',
        });
      }
    }

    return { finalized: true, hadBids: bidCount > 0 };
  });
};

/**
 * Sweep and finalize all expired product auctions.
 */
export const finalizeExpiredProductAuctions = async (): Promise<void> => {
  const now = new Date();
  const expiredAuctions = await prisma.productAuction.findMany({
    where: {
      status: 'ACTIVE',
      endTime: {
        not: null,
        lte: now,
      },
    },
    select: { id: true },
  });

  if (expiredAuctions.length === 0) {
    return;
  }

  logger.info('Finalizing expired product auctions', {
    count: expiredAuctions.length,
  });

  for (const { id } of expiredAuctions) {
    try {
      await finalizeProductAuctionIfExpired(id);
    } catch (error: any) {
      logger.error('Failed to finalize expired auction', {
        auctionId: id,
        error: error?.message ?? error,
      });
    }
  }
};
