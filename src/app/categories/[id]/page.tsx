'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product, Category, getProductsByCategory, getCategoryById } from '@/lib/api';
import ProductGrid from '@/components/ProductGrid';
import { ChevronLeft } from 'lucide-react';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.id as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!categoryId) return;

      try {
        setIsLoading(true);
        const [categoryData, productsData] = await Promise.all([
          getCategoryById(categoryId),
          getProductsByCategory(categoryId)
        ]);

        setCategory(categoryData);
        setProducts(productsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching category data:', err);
        setError('Kategori bilgileri yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [categoryId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-16">
        <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-8 px-4 mb-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-10 bg-white/20 rounded w-64 mb-4"></div>
              <div className="h-4 bg-white/20 rounded w-96"></div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-[var(--secondary)] h-64 rounded-t-xl"></div>
                <div className="bg-[var(--background)] p-5 rounded-b-xl border border-[var(--border)] shadow-sm">
                  <div className="h-5 bg-[var(--secondary)] rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-[var(--secondary)] rounded w-full mb-2"></div>
                  <div className="h-4 bg-[var(--secondary)] rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-16">
        <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-8 px-4 mb-8">
          <div className="max-w-7xl mx-auto">
            <Link
              href="/products"
              className="inline-flex items-center text-white hover:text-white/80 transition-colors mb-4"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Ürünlere Dön
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-[var(--background)] p-8 rounded-xl border border-red-200 shadow-sm text-center">
            <div className="flex items-center justify-center text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              {error || 'Kategori bulunamadı'}
            </h3>
            <p className="text-[var(--foreground)] opacity-70 mb-4">
              Lütfen başka bir kategori deneyin.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Ürünlere Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-16">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-8 px-4 mb-8">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/products"
            className="inline-flex items-center text-white hover:text-white/80 transition-colors mb-4"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Ürünlere Dön
          </Link>

          <div className="flex items-center gap-4">
            {category.emoji && (
              <div className="text-5xl md:text-6xl">
                {category.emoji}
              </div>
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{category.name}</h1>
              <p className="mt-2 text-sm md:text-base opacity-90">
                {category.description || `${category.name} kategorisindeki tüm ürünler`}
              </p>
              <p className="mt-1 text-sm opacity-75">
                {products.length} ürün bulundu
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <ProductGrid
          products={products}
          emptyMessage={`${category.name} kategorisinde henüz ürün bulunmuyor.`}
        />
      </div>
    </div>
  );
}

