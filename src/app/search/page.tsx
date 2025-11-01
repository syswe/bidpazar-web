'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Product, getProducts } from '@/lib/api';
import ProductGrid from '@/components/ProductGrid';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') || '').trim();

  const [inputValue, setInputValue] = useState(q);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep input in sync when user navigates with back/forward
  useEffect(() => {
    setInputValue(q);
  }, [q]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true);
        const data = await getProducts();
        setProducts(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        console.error('Ürünler yüklenirken bir hata oluştu:', err);
        setError('Ürünler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return products.filter(p => p.title?.toLowerCase().includes(lower));
  }, [products, q]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextQ = inputValue.trim();
    router.push(nextQ ? `/search?q=${encodeURIComponent(nextQ)}` : '/search');
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-6 px-4 mb-6 md:mb-8 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold mb-2">Arama</h1>
          <p className="text-sm opacity-90">İlanları isimlerine göre arayın</p>
        </div>
      </div>

      {/* Search input */}
      <div className="max-w-7xl mx-auto px-4 mb-4 md:mb-6">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--foreground)] opacity-60 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ürün veya ilan ara"
              className="w-full bg-transparent outline-none text-[var(--foreground)] placeholder-[var(--foreground)] placeholder-opacity-60"
              aria-label="Arama"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-opacity-90 transition-colors"
          >
            Ara
          </button>
        </form>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-[var(--secondary)] h-64 rounded-t-xl" />
                <div className="bg-[var(--background)] p-5 rounded-b-xl border border-[var(--border)] shadow-sm">
                  <div className="h-5 bg-[var(--secondary)] rounded w-3/4 mb-3" />
                  <div className="h-4 bg-[var(--secondary)] rounded w-full mb-2" />
                  <div className="h-4 bg-[var(--secondary)] rounded w-2/3 mb-3" />
                  <div className="h-4 bg-[var(--secondary)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-[var(--background)] p-8 rounded-xl border border-red-200 shadow-sm text-center">
            <div className="flex items-center justify-center text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">{error}</h3>
            <p className="text-[var(--foreground)] opacity-70">Lütfen daha sonra tekrar deneyiniz.</p>
          </div>
        ) : q ? (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-[var(--foreground)]">
                “{q}” için sonuçlar
              </h2>
              <span className="text-sm text-[var(--foreground)] opacity-70">{filtered.length} sonuç</span>
            </div>
            <ProductGrid products={filtered} emptyMessage="Sonuç bulunamadı." />
          </div>
        ) : (
          <div className="bg-[var(--background)] p-8 rounded-xl border border-[var(--border)] shadow-sm text-center">
            <div className="flex items-center justify-center text-[var(--foreground)] opacity-80 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Arama yapın</h3>
            <p className="text-[var(--foreground)] opacity-70">Ürün adlarında arama yapabilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  );
}

