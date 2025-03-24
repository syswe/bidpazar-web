'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Product, getProducts, getProductsByCategory } from '@/lib/api';
import ProductGrid from '@/components/ProductGrid';
import CategoryFilter from '@/components/CategoryFilter';
import { useAuth } from '@/components/AuthProvider';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        let data: Product[];

        if (selectedCategoryId) {
          data = await getProductsByCategory(selectedCategoryId);
        } else {
          data = await getProducts();
        }

        setProducts(data);
        setError(null);
      } catch (err) {
        setError('Ürünler yüklenirken bir hata oluştu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategoryId]);

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Ürünler</h1>

        {isAuthenticated && (
          <Link
            href="/products/create"
            className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md hover:opacity-90 transition-opacity"
          >
            + Yeni Ürün Ekle
          </Link>
        )}
      </div>

      <CategoryFilter
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={handleCategoryChange}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="bg-[var(--secondary)] h-48 rounded-t-lg"></div>
              <div className="bg-[var(--background)] p-4 rounded-b-lg border border-[var(--border)]">
                <div className="h-4 bg-[var(--secondary)] rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-[var(--secondary)] rounded w-full mb-2"></div>
                <div className="h-3 bg-[var(--secondary)] rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-md">
          {error}
        </div>
      ) : (
        <ProductGrid
          products={products}
          emptyMessage={
            selectedCategoryId
              ? 'Bu kategoride henüz ürün bulunmuyor.'
              : 'Henüz ürün bulunmuyor.'
          }
        />
      )}
    </div>
  );
} 