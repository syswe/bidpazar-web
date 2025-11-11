'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Product } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { getToken } from '@/lib/frontend-auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export default function BidModal({ isOpen, onClose, product }: BidModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [bidAmount, setBidAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPrice = (price: number) => new Intl.NumberFormat('tr-TR').format(price);
  const minBidAmount = product.price + 1;

  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/images/product-placeholder.jpg';

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

    const amount = parseFloat(bidAmount.replace(/\./g, '').replace(',', '.'));

    if (isNaN(amount) || amount < minBidAmount) {
      toast.error(`Minimum teklif tutarı ${formatPrice(minBidAmount)} ₺ olmalıdır`);
      return;
    }

    try {
      setIsSubmitting(true);
      const token = getToken();

      if (!token) {
        toast.error('Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.');
        router.push(`/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
        return;
      }

      // TODO: API endpoint'i ile entegre edilecek
      // Şimdilik başarılı gibi davran
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success('Teklifiniz başarıyla verildi!');
      onClose();

      // Sayfayı yenile veya ürün detayına git
      setTimeout(() => {
        router.push(`/products/${product.id}`);
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

          {/* Mevcut Fiyat */}
          <div className="bg-[var(--secondary)] rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--foreground)] opacity-70">
                Mevcut Teklif
              </span>
              <span className="text-lg font-bold text-[var(--accent)]">
                {formatPrice(product.price)} ₺
              </span>
            </div>
          </div>

          {/* Teklif Formu */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Teklifiniz (Minimum: {formatPrice(minBidAmount)} ₺)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={bidAmount}
                  onChange={(e) => {
                    // Sadece sayı ve virgül/nokta kabul et
                    const value = e.target.value.replace(/[^\d.,]/g, '');
                    setBidAmount(value);
                  }}
                  placeholder={formatPrice(minBidAmount)}
                  className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  disabled={isSubmitting}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--foreground)] opacity-70 font-medium">
                  ₺
                </span>
              </div>
            </div>

            {/* Bilgilendirme */}
            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3 mb-4">
              <p className="text-xs text-[var(--foreground)]">
                <strong className="font-semibold">Not:</strong> Teklifiniz onaylandığında ürünü satın alma yükümlülüğünüz olacaktır.
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
        </div>
      </div>
    </div>
  );
}

