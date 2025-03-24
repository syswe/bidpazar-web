'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { Product, getProducts } from "@/lib/api";
import Image from "next/image";

// Stories and Live Streams (mock data - can be moved to real API later)
const stories = [
  { id: 1, username: 'ahmet', hasNewStory: true },
  { id: 2, username: 'selin', hasNewStory: true },
  { id: 3, username: 'mehmet', hasNewStory: false },
  { id: 4, username: 'ayşe', hasNewStory: true },
  { id: 5, username: 'can', hasNewStory: false },
  { id: 6, username: 'zeynep', hasNewStory: false },
  { id: 7, username: 'buse', hasNewStory: true },
  { id: 8, username: 'emre', hasNewStory: false },
];

const liveStreams = [
  { id: 1, title: 'Nadir Osmanlı Sikkeleri', sellerName: 'Antika Koleksiyoncusu', viewerCount: 243, currentBid: 5600 },
  { id: 2, title: 'Vintage Saat Koleksiyonu', sellerName: 'SaatDünyası', viewerCount: 154, currentBid: 3200 },
  { id: 3, title: 'El Yapımı Gümüş Takılar', sellerName: 'Gümüş Ustası', viewerCount: 87, currentBid: 1450 },
  { id: 4, title: 'Antika Mobilya Mezatı', sellerName: 'Eski Zaman Eserleri', viewerCount: 325, currentBid: 8700 },
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await getProducts();
        setProducts(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading products:", error);
        setError('Ürünler yüklenirken bir hata oluştu.');
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto">
      {/* CSS Test Banners */}
      <div className="bg-blue-500 text-white font-bold p-4 mb-8 rounded-lg shadow-lg text-center">
        If you can see this blue banner with white text, Tailwind CSS is working!
      </div>

      <div className="test-blue-bg">
        If you can see this blue banner with white text, direct CSS is working!
      </div>

      {/* Instagram-like Stories Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--foreground)]">Hikayeler</h2>
          <Link href="/stories" className="text-sm text-[var(--primary)]">
            Tümünü Gör
          </Link>
        </div>

        <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[var(--secondary)]">
          {/* Add Story Button */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 relative flex-shrink-0">
              <div className="w-full h-full rounded-full flex items-center justify-center bg-[var(--secondary)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <span className="text-xs mt-1 text-center text-[var(--foreground)]">Hikaye Ekle</span>
          </div>

          {/* Stories */}
          {stories.map(story => (
            <div key={story.id} className="flex flex-col items-center">
              <div className="w-16 h-16 relative flex-shrink-0">
                <div className={`absolute inset-0 rounded-full ${story.hasNewStory ? 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600' : 'bg-[var(--secondary)]'} p-[2px]`}>
                  <div className="w-full h-full rounded-full border-2 border-[var(--background)] overflow-hidden">
                    {/* Fallback if image is not available */}
                    <div className="w-full h-full bg-[var(--secondary)] flex items-center justify-center">
                      <span className="text-lg font-bold text-[var(--foreground)]">
                        {story.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <span className="text-xs mt-1 text-center truncate w-16 text-[var(--foreground)]">{story.username}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Live Streams Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--foreground)]">Canlı Müzayedeler</h2>
          <Link href="/live" className="text-sm text-[var(--primary)]">
            Tümünü Gör
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {liveStreams.map(stream => (
            <div key={stream.id} className="rounded-lg overflow-hidden border border-[var(--secondary)] bg-[var(--background)] hover:shadow-md transition">
              <div className="relative h-48 bg-[var(--secondary)]">
                {/* Placeholder for missing images */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[var(--foreground)] text-opacity-70">Yayın Görseli</span>
                </div>

                {/* Live Badge */}
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                  CANLI
                </div>

                {/* Viewer Count */}
                <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {stream.viewerCount}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-[var(--foreground)] mb-1">{stream.title}</h3>
                <p className="text-sm text-[var(--foreground)] opacity-80 mb-2">{stream.sellerName}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--foreground)] opacity-70">Güncel Teklif:</span>
                  <span className="font-bold text-[var(--primary)]">{stream.currentBid} ₺</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Products Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--foreground)]">İlanlar</h2>
          <Link href="/products" className="text-sm text-[var(--primary)]">
            Tümünü Gör
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--secondary)] border-t-[var(--primary)]"></div>
            <p className="mt-2 text-[var(--foreground)]">Ürünler yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-[var(--foreground)]">Henüz ilan bulunmuyor.</div>
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
                      {product.user?.name || product.user?.username || 'Anonim'}
                    </span>
                    <span className="font-bold text-[var(--primary)]">{product.price} ₺</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
