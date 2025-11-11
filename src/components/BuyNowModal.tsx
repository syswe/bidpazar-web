'use client';

import { useState } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { Product } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { getToken } from '@/lib/frontend-auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface BuyNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export default function BuyNowModal({ isOpen, onClose, product }: BuyNowModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const formatPrice = (price: number) => new Intl.NumberFormat('tr-TR').format(price);

  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/images/product-placeholder.jpg';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Satın almak için giriş yapmalısınız');
      router.push(`/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`);
      return;
    }

    if (user.id === product.userId) {
      toast.error('Kendi ürününüzü satın alamazsınız');
      return;
    }

    if (!agreed) {
      toast.error('Lütfen kullanım koşullarını kabul edin');
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

      const response = await fetch(`/api/products/${product.id}/buy-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Satın alma işlemi başarısız oldu');
      }

      const result = await response.json();
      toast.success('Ürün başarıyla satın alındı!');
      onClose();

      // Siparişler sayfasına yönlendir
      setTimeout(() => {
        router.push('/dashboard/orders');
      }, 500);
    } catch (error: any) {
      console.error('Buy now error:', error);
      toast.error(error.message || 'Satın alma işlemi sırasında bir hata oluştu');
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
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-lg font-bold text-[var(--foreground)]">Hemen Al</h3>
          </div>
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
            <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[var(--secondary)] flex-shrink-0">
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                unoptimized={true}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[var(--foreground)] text-base line-clamp-2 mb-2">
                {product.title}
              </h4>
              {product.category && (
                <span className="inline-block text-xs px-2 py-0.5 bg-[var(--secondary)] text-[var(--foreground)] rounded">
                  {product.category.name}
                </span>
              )}
            </div>
          </div>

          {/* Fiyat Özeti */}
          <div className="bg-[var(--secondary)] rounded-lg p-4 mb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)] opacity-70">Ürün Fiyatı</span>
                <span className="font-medium text-[var(--foreground)]">
                  {formatPrice(product.buyNowPrice || product.price)} ₺
                </span>
              </div>
              <div className="border-t border-[var(--border)] pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">Toplam</span>
                  <span className="text-xl font-bold text-[var(--accent)]">
                    {formatPrice(product.buyNowPrice || product.price)} ₺
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Satıcı Bilgisi */}
          {product.user && (
            <div className="bg-[var(--muted)] rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--foreground)] opacity-70">Satıcı</span>
                <span className="font-medium text-[var(--foreground)]">
                  {product.user.username || product.user.name}
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Onay Checkbox */}
            <div className="mb-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[var(--accent)] border-[var(--border)] rounded focus:ring-[var(--accent)]"
                  disabled={isSubmitting}
                />
                <span className="text-xs text-[var(--foreground)] opacity-80">
                  Satın alma koşullarını okudum ve kabul ediyorum. Bu işlem geri alınamaz.
                </span>
              </label>
            </div>

            {/* Bilgilendirme */}
            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3 mb-4">
              <p className="text-xs text-[var(--foreground)]">
                <strong className="font-semibold">Önemli:</strong> Hemen al seçeneği ile ürünü anında satın alırsınız.
                Bu işlem sonrası satıcı ile iletişime geçerek ödeme ve teslimat detaylarını görüşebilirsiniz.
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
                disabled={isSubmitting || !agreed}
              >
                {isSubmitting ? 'İşleniyor...' : 'Satın Al'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

