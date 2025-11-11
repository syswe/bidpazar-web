'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Clock, TrendingUp, Award } from 'lucide-react';
import { useState, useEffect } from 'react';

interface FeaturedAuctionCardProps {
  product: {
    id: string;
    title: string;
    price: number;
    buyNowPrice?: number | null;
    media?: { url: string; type: string }[];
    user?: {
      username?: string;
      name?: string;
      isVerified?: boolean;
    };
    category?: {
      name: string;
      emoji?: string;
    };
    auctions?: Array<{
      id: string;
      endTime?: Date | string | null;
      bids?: Array<{
        amount: number;
      }>;
    }>;
  };
}

export default function FeaturedAuctionCard({ product }: FeaturedAuctionCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const currentBidPrice = product.auctions && product.auctions.length > 0 && product.auctions[0].bids && product.auctions[0].bids.length > 0
    ? Math.max(...product.auctions[0].bids.map(b => b.amount))
    : product.price;

  const imageUrl = product.media && product.media.length > 0 ? product.media[0].url : null;

  useEffect(() => {
    if (product.auctions && product.auctions.length > 0 && product.auctions[0].endTime) {
      const updateTimeLeft = () => {
        const endTime = new Date(product.auctions![0].endTime!);
        const now = new Date();
        const diff = endTime.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft('Sona erdi');
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 24) {
          const days = Math.floor(hours / 24);
          setTimeLeft(`${days} gün ${hours % 24} saat`);
        } else {
          setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };

      updateTimeLeft();
      const interval = setInterval(updateTimeLeft, 1000);

      return () => clearInterval(interval);
    }
  }, [product.auctions]);

  return (
    <Link
      href={`/products/${product.id}`}
      className="group block relative rounded-2xl overflow-hidden border-2 border-[var(--accent)] bg-gradient-to-br from-[var(--accent)]/10 to-[var(--primary)]/10 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
    >
      {/* Featured Badge */}
      <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-lg">
        <Award className="h-3 w-3 mr-1" />
        ÖNE ÇIKAN
      </div>

      {/* Image Section */}
      <div className="relative h-52 md:h-64 bg-[var(--secondary)] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
            unoptimized={true}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--secondary)] to-[var(--muted)]">
            <span className="text-4xl md:text-5xl opacity-30">
              {product.category?.emoji || '📦'}
            </span>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

        {/* Countdown */}
        {timeLeft && (
          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center">
            <Clock className="h-3 w-3 mr-1.5" />
            {timeLeft}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 md:p-5">
        {/* Category */}
        {product.category && (
          <div className="mb-2 flex items-center text-xs text-[var(--accent)] font-medium">
            {product.category.emoji && <span className="mr-1">{product.category.emoji}</span>}
            {product.category.name}
          </div>
        )}

        {/* Title */}
        <h3 className="font-bold text-[var(--foreground)] text-base md:text-lg mb-2 line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
          {product.title}
        </h3>

        {/* Seller Info */}
        <div className="flex items-center text-xs md:text-sm text-[var(--foreground)] opacity-70 mb-3">
          <span className="flex items-center">
            {product.user?.isVerified && <span className="mr-1">✓</span>}
            {product.user?.name || product.user?.username || 'Anonim'}
          </span>
        </div>

        {/* Price Section */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div>
            <p className="text-xs text-[var(--foreground)] opacity-60 mb-1">Güncel Teklif</p>
            <p className="text-xl md:text-2xl font-bold text-[var(--accent)] flex items-center">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 mr-1" />
              {formatPrice(currentBidPrice)} ₺
            </p>
          </div>
          {product.buyNowPrice && (
            <div className="text-right">
              <p className="text-xs text-[var(--foreground)] opacity-60 mb-1">Hemen Al</p>
              <p className="text-base md:text-lg font-bold text-[var(--foreground)]">
                {formatPrice(product.buyNowPrice)} ₺
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

