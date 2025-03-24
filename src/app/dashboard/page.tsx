'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Product, getUserProducts } from '@/lib/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserProducts() {
      if (!user) return;

      try {
        setIsLoading(true);
        const data = await getUserProducts(user.id);
        setProducts(data);
      } catch (err) {
        console.error('Ürünler yüklenirken hata oluştu:', err);
        setError('Ürünleriniz yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserProducts();
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <header className="bg-[var(--background)] border-b border-[var(--border)] mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Profilim</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--foreground)] opacity-80">
                Hoşgeldiniz, {user?.name || user?.username || user?.email}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-md hover:opacity-90 transition-opacity"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[var(--background)] p-6 rounded-lg border border-[var(--border)]">
            <h2 className="text-xl font-semibold mb-4 text-[var(--foreground)]">Hesap Bilgileri</h2>
            <div className="space-y-2">
              <p className="text-[var(--foreground)]">
                <span className="font-medium">Kullanıcı Adı:</span> {user?.username}
              </p>
              {user?.name && (
                <p className="text-[var(--foreground)]">
                  <span className="font-medium">Ad Soyad:</span> {user.name}
                </p>
              )}
              <p className="text-[var(--foreground)]">
                <span className="font-medium">Email:</span> {user?.email}
              </p>
              <p className="flex items-center text-[var(--foreground)]">
                <span className="font-medium mr-2">Doğrulama Durumu:</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  <span className="mr-1">📱</span> SMS Onaylı Üye
                </span>
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Ürünlerim</h2>
              <Link
                href="/products/create"
                className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md hover:opacity-90 transition-opacity text-sm"
              >
                + Yeni Ürün Ekle
              </Link>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--secondary)] border-t-[var(--primary)]"></div>
                <p className="mt-2 text-[var(--foreground)]">Ürünleriniz yükleniyor...</p>
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
                {error}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-[var(--background)] p-6 rounded-lg border border-[var(--border)] text-center">
                <p className="text-[var(--foreground)] mb-4">Henüz ürün eklememiş görünüyorsunuz.</p>
                <Link
                  href="/products/create"
                  className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md hover:opacity-90 transition-opacity inline-block"
                >
                  İlk Ürününüzü Ekleyin
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <Link
                    href={`/products/${product.id}`}
                    key={product.id}
                    className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-md transition block"
                  >
                    <div className="h-48 relative bg-[var(--secondary)]">
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.title}
                          fill
                          className="object-cover"
                          unoptimized={true}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[var(--foreground)] text-opacity-70">Ürün Görseli</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-[var(--foreground)]">{product.title}</h3>
                        <span className="bg-[var(--secondary)] text-[var(--foreground)] text-xs px-2 py-1 rounded">
                          {product.category?.name || 'Kategori'}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--foreground)] opacity-80 mb-3 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--foreground)] opacity-70">
                          {new Date(product.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                        <span className="font-bold text-[var(--primary)]">{product.price} ₺</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 