import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Product } from '@/lib/api';
import VerifiedSellerBadge from './VerifiedSellerBadge';
import { useAuth } from './AuthProvider';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const [isBuying, setIsBuying] = useState(false);

  // Ürün resmi varsa ilkini al, yoksa placeholder kullan
  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].url
    : '/images/product-placeholder.jpg';

  // Fiyatı Türk Lirası formatında göster
  const formattedPrice = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(product.price);

  const formattedBuyNowPrice = product.buyNowPrice ? new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(product.buyNowPrice) : null;

  const handleBuyNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/products/${product.id}`)}`;
      return;
    }

    if (user.id === product.userId) {
      alert('Kendi ürününüzü satın alamazsınız.');
      return;
    }

    try {
      setIsBuying(true);
      // TODO: Implement buy now API call
      const response = await fetch(`/api/products/${product.id}/buy-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Satın alma işlemi başarısız oldu');
      }

      const result = await response.json();
      alert('Ürün başarıyla satın alındı!');
      // Optionally refresh the page or redirect to orders
      window.location.reload();
    } catch (error: any) {
      console.error('Buy now error:', error);
      alert(error.message || 'Satın alma işlemi sırasında bir hata oluştu');
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="group relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-lg hover:border-[var(--accent)] transition-all duration-300">
      <Link href={`/products/${product.id}`} className="block h-full">
        <div className="relative h-64 w-full bg-[var(--secondary)] overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Price badges */}
          <div className="absolute bottom-3 right-3 space-y-1">
            <div className="bg-[var(--background)] px-3 py-1.5 rounded-full shadow-md font-bold text-[var(--accent)]">
              {formattedPrice}
            </div>
            {formattedBuyNowPrice && (
              <div className="bg-green-600 px-3 py-1.5 rounded-full shadow-md font-bold text-white text-sm">
                Hemen Al: {formattedBuyNowPrice}
              </div>
            )}
          </div>

          {/* Quick view and buy now buttons */}
          <div className="absolute inset-0 bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="flex flex-col gap-2 items-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              <span className="bg-white text-[var(--accent)] px-4 py-2 rounded-md font-medium">
                İncele
              </span>
              {formattedBuyNowPrice && (
                <button
                  onClick={handleBuyNow}
                  disabled={isBuying}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isBuying ? 'İşleniyor...' : 'Hemen Al'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors duration-300 line-clamp-1">
              {product.title}
            </h3>
            <span className="ml-2 px-2 py-0.5 bg-[var(--accent)] bg-opacity-10 text-[var(--accent)] text-xs rounded-md whitespace-nowrap">
              {product.category?.name || 'Kategori Yok'}
            </span>
          </div>

          <p className="text-sm text-[var(--foreground)] opacity-70 mb-4 line-clamp-2 min-h-[40px]">
            {product.description}
          </p>

          <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
            {product.user && (
              <span className="text-xs text-[var(--foreground)] opacity-70 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="flex items-center">
                  {product.user.username}
                  <VerifiedSellerBadge userType={product.user.userType} variant="inline" className="scale-75" />
                </span>
              </span>
            )}

            <div className="flex items-center text-xs text-[var(--foreground)] opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {new Date(product.createdAt).toLocaleDateString('tr-TR')}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
} 