'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product, ProductAuction, addBidToProductAuction, getProductAuctionByProductId } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { getToken } from '@/lib/frontend-auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { calculateMinimumBidAmount, calculateMinimumBidIncrement } from '@/lib/utils';

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export default function BidModal({ isOpen, onClose, product }: BidModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auction, setAuction] = useState<ProductAuction | null>(null);
  const [isLoadingAuction, setIsLoadingAuction] = useState(true);

  const formatPrice = (price: number) => new Intl.NumberFormat('tr-TR').format(price);

  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/images/product-placeholder.jpg';

  // Fetch auction data when modal opens
  useEffect(() => {
    if (isOpen && product.id) {
      const fetchAuction = async () => {
        try {
          setIsLoadingAuction(true);
          const auctionData = await getProductAuctionByProductId(product.id);
          setAuction(auctionData);
        } catch (error) {
          console.error('Error fetching auction:', error);
          toast.error('Açık artırma bilgileri yüklenemedi');
        } finally {
          setIsLoadingAuction(false);
        }
      };
      fetchAuction();
    }
  }, [isOpen, product.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Teklif vermek için giriş yapmalısınız');
      router.push(`/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }

    if (user.id === product.userId) {
      toast.error('Kendi ürününüze teklif veremezsiniz');
      return;
    }

    if (!auction) {
      toast.error('Bu ürün için aktif bir açık artırma bulunmuyor');
      return;
    }

    // Calculate auto-increment amount
    const nextBidAmount = calculateMinimumBidAmount(auction.currentPrice);

    try {
      setIsSubmitting(true);
      const token = getToken();

      if (!token) {
        toast.error('Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.');
        router.push(`/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
        return;
      }

      // Place bid using real API
      await addBidToProductAuction(auction.id, nextBidAmount);

      toast.success('Teklifiniz başarıyla verildi!');
      onClose();

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('Bid error:', error);
      toast.error(error.message || 'Teklif verilirken bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background)] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Teklif Ver</h3>
          <button
            onClick={onClose}
            className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors p-1"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Ürün Bilgisi */}
          <div className="flex gap-3 mb-4 pb-4 border-b border-[var(--border)]">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[var(--secondary)] flex-shrink-0">
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                unoptimized={true}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[var(--foreground)] text-sm line-clamp-2 mb-1">
                {product.title}
              </h4>
              {product.category && (
                <span className="inline-block text-xs px-2 py-0.5 bg-[var(--secondary)] text-[var(--foreground)] rounded">
                  {product.category.name}
                </span>
              )}
            </div>
          </div>

          {isLoadingAuction ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto"></div>
              <p className="text-sm text-[var(--foreground)] mt-2">Yükleniyor...</p>
            </div>
          ) : !auction ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-600">Bu ürün için aktif bir açık artırma bulunmuyor.</p>
            </div>
          ) : (
            <>
              {/* Mevcut Fiyat */}
              <div className="bg-[var(--secondary)] rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--foreground)] opacity-70">
                    Mevcut Teklif
                  </span>
                  <span className="text-lg font-bold text-[var(--accent)]">
                    {formatPrice(auction.currentPrice)} ₺
                  </span>
                </div>
              </div>

              {/* Auto-calculated Next Bid */}
              <div className="bg-[var(--primary)]/10 rounded-lg p-4 border border-[var(--primary)]/20 mb-4">
                <div className="text-center">
                  <p className="text-sm text-[var(--foreground)] opacity-70 mb-2">
                    Sonraki Teklif Tutarınız
                  </p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {formatPrice(calculateMinimumBidAmount(auction.currentPrice))} ₺
                  </p>
                  {auction.currentPrice === auction.startPrice && (
                    <p className="text-xs text-green-600 mt-2">
                      İlk teklif: Başlangıç fiyatı kadar teklif verebilirsiniz
                    </p>
                  )}
                  <p className="text-xs text-[var(--foreground)] opacity-70 mt-2">
                    Artış: {formatPrice(calculateMinimumBidIncrement(auction.currentPrice))} ₺
                  </p>
                </div>
              </div>

              {/* Teklif Formu */}
              <form onSubmit={handleSubmit}>
                {/* Bilgilendirme */}
                <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3 mb-4">
                  <p className="text-xs text-[var(--foreground)]">
                    <strong className="font-semibold">Not:</strong> Teklifiniz otomatik olarak hesaplanmıştır ve onaylandığında ürünü satın alma yükümlülüğünüz olacaktır.
                  </p>
                </div>

                {/* Butonlar */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 border border-[var(--border)] text-[var(--foreground)] rounded-lg font-medium hover:bg-[var(--muted)] transition-colors"
                    disabled={isSubmitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Gönderiliyor...' : 'Teklif Ver'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

