'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Product, ProductAuction, getProductAuctionByProductId } from '@/lib/api';
import VerifiedSellerBadge from './VerifiedSellerBadge';
import BidModal from './BidModal';
import BuyNowModal from './BuyNowModal';
import { Clock } from 'lucide-react';
import { calculateMinimumBidAmount } from '@/lib/utils';
import ContentMenu from './ContentMenu';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [showBidModal, setShowBidModal] = useState(false);
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [auction, setAuction] = useState<ProductAuction | null>(null);
  const [isLoadingAuction, setIsLoadingAuction] = useState(true);

  // Ürün resmi varsa ilkini al, yoksa placeholder kullan
  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/images/product-placeholder.jpg';

  // Fiyatı formatla (₺ sembolü olmadan)
  const formatPrice = (price: number) => new Intl.NumberFormat('tr-TR').format(price);

  // Fetch auction data on mount
  useEffect(() => {
    const fetchAuction = async () => {
      try {
        setIsLoadingAuction(true);
        const auctionData = await getProductAuctionByProductId(product.id);
        setAuction(auctionData);
      } catch (error) {
        console.error('Error fetching auction for product:', product.id, error);
      } finally {
        setIsLoadingAuction(false);
      }
    };
    fetchAuction();
  }, [product.id]);

  // Calculate the display price (current bid or next bid amount)
  const displayPrice = auction ? calculateMinimumBidAmount(auction.currentPrice) : product.price;
  const hasBuyNowPrice = !!product.buyNowPrice;

  const handleBidClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBidModal(true);
  };

  const handleBuyNowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBuyNowModal(true);
  };

  return (
    <>
      <Link
        href={`/products/${product.id}`}
        className="product-card group block rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-lg hover:border-[var(--accent)] transition-all duration-300"
      >
        {/* Ürün Görseli */}
        <div className="relative h-48 sm:h-56 md:h-64 w-full bg-[var(--secondary)] overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Kategori Badge - Sol üst */}
          {product.category && (
            <div className="absolute top-2 left-2">
              <span className="inline-block px-2.5 py-1 bg-[var(--background)]/90 backdrop-blur-sm text-[var(--accent)] text-xs font-medium rounded-md border border-[var(--border)]">
                {product.category.name}
              </span>
            </div>
          )}

          {/* Content Menu - Sağ üst */}
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.preventDefault()}>
            <ContentMenu
              contentType="PRODUCT"
              contentId={product.id}
              showShare={true}
              onShare={() => {
                if (navigator.share) {
                  navigator.share({
                    title: product.title,
                    text: `Check out this product: ${product.title}`,
                    url: window.location.origin + `/products/${product.id}`,
                  });
                }
              }}
            />
          </div>
        </div>

        {/* Ürün Bilgileri */}
        <div className="p-3 sm:p-4">
          {/* Ürün Başlığı */}
          <h3 className="text-sm sm:text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors duration-300 line-clamp-2 mb-2 min-h-[2.5rem] sm:min-h-[3rem]">
            {product.title}
          </h3>

          {/* Satıcı Bilgisi ve Tarih */}
          <div className="flex items-center justify-between text-xs text-[var(--foreground)] opacity-70 mb-3 pb-3 border-b border-[var(--border)]">
            {product.user && (
              <div className="flex items-center gap-1 min-w-0 flex-1 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="truncate flex items-center">
                  {product.user.username}
                  <VerifiedSellerBadge userType={product.user.userType} variant="inline" className="scale-75 ml-0.5" />
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3 w-3" />
              <span className="whitespace-nowrap">
                {new Date(product.createdAt).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'short'
                })}
              </span>
            </div>
          </div>

          {/* Fiyat Bilgileri ve Aksiyon Butonları */}
          {hasBuyNowPrice ? (
            // İki butonlu layout (Teklif Ver + Hemen Al)
            <div className="grid grid-cols-2 gap-2">
              {/* Sol: Teklif Ver */}
              <button
                onClick={handleBidClick}
                className="flex flex-col items-center justify-center py-2 px-2 bg-[var(--secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">
                  Teklif Ver
                </span>
                {isLoadingAuction ? (
                  <div className="h-5 w-16 bg-[var(--secondary)] animate-pulse rounded"></div>
                ) : (
                  <span className="text-sm sm:text-base font-bold text-[var(--accent)]">
                    {formatPrice(displayPrice)} ₺
                  </span>
                )}
              </button>

              {/* Sağ: Hemen Al */}
              <button
                onClick={handleBuyNowClick}
                className="flex flex-col items-center justify-center py-2 px-2 bg-[var(--secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1">
                  Hemen Al
                </span>
                <span className="text-sm sm:text-base font-bold text-[var(--accent)]">
                  {formatPrice(product.buyNowPrice!)} ₺
                </span>
              </button>
            </div>
          ) : (
            // Tek butonlu layout (Sadece Teklif Ver - Ortalanmış)
            <button
              onClick={handleBidClick}
              className="flex flex-col items-center justify-center py-3 px-3 bg-[var(--secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer w-full"
            >
              <span className="text-xs font-medium text-[var(--foreground)] opacity-70 mb-1.5">
                Teklif Ver
              </span>
              {isLoadingAuction ? (
                <div className="h-6 w-20 bg-[var(--secondary)] animate-pulse rounded"></div>
              ) : (
                <span className="text-lg font-bold text-[var(--accent)]">
                  {formatPrice(displayPrice)} ₺
                </span>
              )}
            </button>
          )}
        </div>
      </Link>

      {/* Modals */}
      <BidModal
        isOpen={showBidModal}
        onClose={() => setShowBidModal(false)}
        product={product}
      />
      <BuyNowModal
        isOpen={showBuyNowModal}
        onClose={() => setShowBuyNowModal(false)}
        product={product}
      />
    </>
  );
}

