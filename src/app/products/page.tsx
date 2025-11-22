'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Product, getProducts, getProductsByCategory } from '@/lib/api';
import ProductGrid from '@/components/ProductGrid';
import CategoryFilter from '@/components/CategoryFilter';
import FeaturedAuctionCard from '@/components/FeaturedAuctionCard';
import { useAuth } from '@/components/AuthProvider';
import { Award, ChevronRight } from 'lucide-react';

interface FeaturedProduct extends Product {
  auctions?: Array<{
    id: string;
    endTime?: Date | string | null;
    bids?: Array<{
      amount: number;
    }>;
  }>;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Fetch featured products
  useEffect(() => {
    async function loadFeaturedProducts() {
      try {
        setFeaturedLoading(true);
        const featuredRes = await fetch('/api/products/featured?limit=6');
        if (featuredRes.ok) {
          const featuredData = await featuredRes.json();
          setFeaturedProducts(featuredData.products || []);
        }
      } catch (error) {
        console.error('Error loading featured products:', error);
      } finally {
        setFeaturedLoading(false);
      }
    }

    loadFeaturedProducts();
  }, []);

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

        // Filter out featured products from the regular list to avoid duplication
        const featuredIds = new Set(featuredProducts.map(p => p.id));
        const filteredData = data.filter(p => !featuredIds.has(p.id));

        setProducts(filteredData);
        setError(null);
      } catch (err) {
        setError('Ürünler yüklenirken bir hata oluştu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategoryId, featuredProducts]);

  const handleCategoryChange = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] pb-16">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-8 px-4 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Koleksiyon Ürünleri</h1>
              <p className="mt-2 text-sm md:text-base opacity-90">
                Nadide parçaları keşfedin ve koleksiyonunuzu genişletin
              </p>
            </div>
            {isAuthenticated && (
              <Link
                href="/products/create"
                className="mt-4 md:mt-0 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-md hover:shadow-lg transition-all flex items-center border border-white/20 group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Yeni Ürün Ekle
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Featured Products Section */}
        {!selectedCategoryId && featuredProducts.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
                <span className="border-b-4 border-[var(--accent)] pb-1">Öne Çıkarılan Ürünler</span>
              </h2>
            </div>

            {featuredLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border-2 border-[var(--accent)]/30 bg-[var(--secondary)] animate-pulse">
                    <div className="h-52 md:h-64 bg-[var(--secondary)]"></div>
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-[var(--secondary)] rounded w-3/4"></div>
                      <div className="h-3 bg-[var(--secondary)] rounded w-1/2"></div>
                      <div className="h-8 bg-[var(--secondary)] rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
                {featuredProducts.map(product => (
                  <FeaturedAuctionCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Elegant Category Filter */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            <span className="border-b-3 border-[var(--accent)] pb-1">Kategoriler</span>
          </h2>
          <CategoryFilter
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={handleCategoryChange}
          />
        </div>

        {/* All Products Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">
                {selectedCategoryId ? 'Kategori Ürünleri' : 'Tüm Ürünler'}
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="bg-[var(--secondary)] h-64 rounded-t-xl"></div>
                  <div className="bg-[var(--background)] p-5 rounded-b-xl border border-[var(--border)] shadow-sm">
                    <div className="h-5 bg-[var(--secondary)] rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-[var(--secondary)] rounded w-full mb-2"></div>
                    <div className="h-4 bg-[var(--secondary)] rounded w-2/3 mb-3"></div>
                    <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
                      <div className="h-4 bg-[var(--secondary)] rounded w-1/4"></div>
                      <div className="h-5 bg-[var(--secondary)] rounded w-1/5"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-[var(--background)] p-8 rounded-xl border border-red-200 shadow-sm text-center">
              <div className="flex items-center justify-center text-red-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">{error}</h3>
              <p className="text-[var(--foreground)] opacity-70">
                Lütfen daha sonra tekrar deneyin veya sayfayı yenileyin.
              </p>
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
        </section>
      </div>
    </div>
  );
} 