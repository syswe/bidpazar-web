'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SellerCard from '@/components/SellerCard';
import { Users, Store, TrendingUp } from 'lucide-react';

interface Seller {
  id: string;
  username: string;
  name?: string | null;
  isVerified: boolean;
  isPopularStreamer?: boolean;
  isFavoriteSeller?: boolean;
  totalProducts: number;
  activeProducts: number;
  totalStreams?: number;
  isLive?: boolean;
  currentViewers?: number;
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'popular' | 'favorite'>('all');

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        setIsLoading(true);
        const queryParam = filter !== 'all' ? `?featured=${filter}` : '';
        const response = await fetch(`/api/users/sellers${queryParam}`);

        if (!response.ok) {
          throw new Error('Failed to fetch sellers');
        }

        const data = await response.json();
        setSellers(data.sellers || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching sellers:', err);
        setError('Satıcılar yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, [filter]);

  // Separate sellers by type for display
  const popularStreamers = sellers.filter(s => s.isPopularStreamer);
  const favoriteSellers = sellers.filter(s => s.isFavoriteSeller && !s.isPopularStreamer);
  const regularSellers = sellers.filter(s => !s.isPopularStreamer && !s.isFavoriteSeller);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-16">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-8 px-4 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Satıcılar</h1>
              <p className="text-sm md:text-base opacity-90">
                Güvenilir satıcıları keşfedin ve benzersiz ürünleri inceleyin
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Filter Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3 border-b border-[var(--border)] pb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'all'
                ? 'bg-[var(--accent)] text-white shadow-md'
                : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)]'
                }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Tüm Satıcılar
            </button>
            <button
              onClick={() => setFilter('popular')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'popular'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)]'
                }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Popüler Yayıncılar
            </button>
            <button
              onClick={() => setFilter('favorite')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'favorite'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)]'
                }`}
            >
              <Store className="h-4 w-4 inline mr-2" />
              Favori Satıcılar
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-[var(--secondary)] rounded-2xl overflow-hidden">
                  <div className="h-32 bg-[var(--muted)]"></div>
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-[var(--muted)] rounded w-3/4 mx-auto"></div>
                    <div className="h-3 bg-[var(--muted)] rounded w-1/2 mx-auto"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-16 bg-[var(--muted)] rounded"></div>
                      <div className="h-16 bg-[var(--muted)] rounded"></div>
                    </div>
                    <div className="h-8 bg-[var(--muted)] rounded"></div>
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
        ) : sellers.length === 0 ? (
          <div className="text-center py-12 bg-[var(--muted)] rounded-xl">
            <Users className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)] opacity-50" />
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {filter === 'popular' ? 'Popüler Yayıncı Bulunamadı' :
                filter === 'favorite' ? 'Favori Satıcı Bulunamadı' :
                  'Satıcı Bulunamadı'}
            </h3>
            <p className="text-[var(--foreground)] opacity-70 mb-4">
              Şu anda bu kategoride satıcı bulunmuyor.
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="inline-flex items-center px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Tüm Satıcıları Görüntüle
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Popular Streamers Section */}
            {filter === 'all' && popularStreamers.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
                    <span className="border-b-4 border-purple-600 pb-1">Popüler Yayıncılar</span>
                  </h2>
                  <button
                    onClick={() => setFilter('popular')}
                    className="text-sm text-purple-600 font-medium hover:underline"
                  >
                    Tümünü Gör →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {popularStreamers.slice(0, 5).map(seller => (
                    <SellerCard key={seller.id} seller={seller} />
                  ))}
                </div>
              </section>
            )}

            {/* Favorite Sellers Section */}
            {filter === 'all' && favoriteSellers.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
                    <span className="border-b-4 border-amber-600 pb-1">Favori Satıcılar</span>
                  </h2>
                  <button
                    onClick={() => setFilter('favorite')}
                    className="text-sm text-amber-600 font-medium hover:underline"
                  >
                    Tümünü Gör →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {favoriteSellers.slice(0, 5).map(seller => (
                    <SellerCard key={seller.id} seller={seller} />
                  ))}
                </div>
              </section>
            )}

            {/* All Sellers or Filtered View */}
            {(filter !== 'all' || (filter === 'all' && regularSellers.length > 0)) && (
              <section>
                {filter === 'all' && (
                  <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
                      <span className="border-b-4 border-[var(--accent)] pb-1">Tüm Satıcılar</span>
                    </h2>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {(filter === 'all' ? regularSellers : sellers).map(seller => (
                    <SellerCard key={seller.id} seller={seller} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
