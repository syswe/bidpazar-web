import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
    value
  );

const resolveDisplayName = (
  user?: { username?: string | null; name?: string | null }
): string => {
  if (!user) return 'kullanıcı';
  return user.name?.trim() || user.username?.trim() || 'kullanıcı';
};

const buildProductUrl = (productId: string) => {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.APP_URL?.replace(/\/$/, '') ||
    'https://bidpazar.com';
  return `${base}/products/${productId}`;
};

const sanitizePreview = (content: string) => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
};

const ensureConversation = async (
  tx: Prisma.TransactionClient,
  buyerId: string,
  sellerId: string
) => {
  let conversation = await tx.conversation.findFirst({
    where: {
      AND: [
        {
          participants: {
            some: { id: buyerId },
          },
        },
        {
          participants: {
            some: { id: sellerId },
          },
        },
      ],
    },
  });

  if (!conversation) {
    conversation = await tx.conversation.create({
      data: {
        participants: {
          connect: [{ id: buyerId }, { id: sellerId }],
        },
      },
    });
    logger.info('Created new conversation for order', {
      conversationId: conversation.id,
      buyerId,
      sellerId,
    });
  }

  return conversation;
};

interface OrderConversationMessageParams {
  tx: Prisma.TransactionClient;
  buyer: { id: string; username?: string | null; name?: string | null };
  seller: { id: string; username?: string | null; name?: string | null };
  product: { id: string; title: string };
  price: number;
  context: 'buy-now' | 'auction';
  skipBuyerNotification?: boolean;
}

export const createOrderConversationMessage = async ({
  tx,
  buyer,
  seller,
  product,
  price,
  context,
  skipBuyerNotification = false,
}: OrderConversationMessageParams) => {
  const conversation = await ensureConversation(tx, buyer.id, seller.id);

  const buyerName = resolveDisplayName(buyer);
  const sellerName = resolveDisplayName(seller);
  const formattedPrice = formatCurrency(price);
  const productUrl = buildProductUrl(product.id);

  const baseMessage =
    context === 'auction'
      ? `Merhaba ${sellerName}, ben ${buyerName}. "${product.title}" ürününe verdiğim ${formattedPrice} teklif açık artırmayı kazandı. Teslimat ve ödeme detaylarını bu sohbet üzerinden konuşabilir miyiz?`
      : `Merhaba ${sellerName}, ben ${buyerName}. "${product.title}" ürününüzü ${formattedPrice} bedelle satın aldım. Teslimat ve ödeme detaylarını bu sohbet üzerinden konuşabilir miyiz?`;

  const messageContent = `${baseMessage} Ürün bağlantısı: ${productUrl}`;

  const message = await tx.message.create({
    data: {
      content: messageContent,
      senderId: buyer.id,
      receiverId: seller.id,
      conversationId: conversation.id,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  await tx.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: message.createdAt },
  });

  const sellerPreview = sanitizePreview(messageContent);

  await tx.notification.create({
    data: {
      userId: seller.id,
      content: `${buyerName} size yeni bir mesaj gönderdi: ${sellerPreview}`,
      type: 'MESSAGE',
      relatedId: conversation.id,
    },
  });

  if (!skipBuyerNotification) {
    await tx.notification.create({
      data: {
        userId: buyer.id,
        content: `"${product.title}" ürünü için satıcıyla sohbet başlatıldı. Detayları bu sohbet üzerinden konuşabilirsiniz.`,
        type: 'MESSAGE',
        relatedId: conversation.id,
      },
    });
  }

  logger.info('Created order conversation message', {
    conversationId: conversation.id,
    messageId: message.id,
    context,
  });

  return conversation.id;
};
