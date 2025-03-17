'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Product, getProductById } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        const data = await getProductById(id);
        setProduct(data);
        setError(null);
      } catch (err) {
        setError('Ürün detayları yüklenirken bir hata oluştu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  // Fiyatı Türk Lirası formatında göster
  const formattedPrice = product
    ? new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(product.price)
    : '';

  // Ürün sahibi kontrolü
  const isOwner = user && product && user.id === product.userId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/2">
                <div className="bg-gray-200 dark:bg-gray-700 h-96 rounded-lg"></div>
              </div>
              <div className="w-full md:w-1/2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-6"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
            {error || 'Ürün bulunamadı.'}
          </div>
          <div className="mt-4">
            <Link
              href="/products"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Ürünlere geri dön
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />

      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-4">
          <Link
            href="/products"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Ürünlere geri dön
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Ürün Görselleri */}
          <div className="w-full md:w-1/2">
            <div className="relative h-96 w-full mb-4 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <Image
                  src={product.images[activeImageIndex].url}
                  alt={product.title}
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">Görsel bulunamadı</p>
                </div>
              )}
            </div>

            {/* Küçük Görseller */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden border-2 ${activeImageIndex === index
                      ? 'border-blue-600 dark:border-blue-400'
                      : 'border-transparent'
                      }`}
                  >
                    <Image
                      src={image.url}
                      alt={`${product.title} - Görsel ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized={true}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ürün Bilgileri */}
          <div className="w-full md:w-1/2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {product.title}
            </h1>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-full">
                {product.category?.name || 'Kategori Yok'}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Satıcı: {product.user?.username || 'Bilinmiyor'}
              </span>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-line">
              {product.description}
            </p>

            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6">
              {formattedPrice}
            </div>

            {isOwner ? (
              <div className="flex gap-4">
                <Link
                  href={`/products/${product.id}/edit`}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Düzenle
                </Link>
                <button
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors"
                  onClick={() => {
                    // Silme işlemi burada yapılacak
                    if (confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
                      // Silme API çağrısı
                    }
                  }}
                >
                  Sil
                </button>
              </div>
            ) : (
              <button
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => {
                  // Satın alma veya iletişim işlemi burada yapılacak
                  if (!user) {
                    router.push('/sign-in?redirect=' + encodeURIComponent(`/products/${product.id}`));
                    return;
                  }
                  // İletişim veya satın alma işlemi
                }}
              >
                İletişime Geç
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 