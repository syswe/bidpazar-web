'use client';

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Product, getProducts } from "@/lib/api";
import Image from "next/image";
import Footer from "@/components/Footer";
import { X, ChevronRight, Clock, TrendingUp, Award, Users, Heart, Eye, ChevronDown, Video, Bookmark } from "lucide-react";

// Coming Soon Popup component
const ComingSoonPopup = ({ isOpen, onClose, feature }: { isOpen: boolean, onClose: () => void, feature: string }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] rounded-xl shadow-2xl max-w-md w-full p-6 relative border border-[var(--border)]">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="text-center mb-4">
          <div className="mx-auto w-16 h-16 bg-[var(--accent)] bg-opacity-10 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-[var(--accent)]" />
          </div>
          <h3 className="text-xl font-bold text-[var(--foreground)]">Çok Yakında</h3>
        </div>
        
        <p className="text-center text-[var(--foreground)] opacity-90 mb-6">
          "{feature}" özelliği çok yakında BidPazar'da olacak. Gelişmelerden haberdar olmak için bizi takip edin!
        </p>
        
        <button 
          onClick={onClose}
          className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors"
        >
          Anladım
        </button>
      </div>
    </div>
  );
};

// Stories and Live Streams (mock data - can be moved to real API later)
const stories = [
  { id: 1, username: 'ahmet', hasNewStory: true, image: '/images/profile1.jpg' },
  { id: 2, username: 'selin', hasNewStory: true, image: '/images/profile2.jpg' },
  { id: 3, username: 'mehmet', hasNewStory: false, image: '/images/profile3.jpg' },
  { id: 4, username: 'ayşe', hasNewStory: true, image: '/images/profile4.jpg' },
  { id: 5, username: 'can', hasNewStory: false, image: '/images/profile5.jpg' },
  { id: 6, username: 'zeynep', hasNewStory: false, image: '/images/profile6.jpg' },
  { id: 7, username: 'buse', hasNewStory: true, image: '/images/profile7.jpg' },
  { id: 8, username: 'emre', hasNewStory: false, image: '/images/profile8.jpg' },
];

const liveStreams = [
  { id: 1, title: 'Nadir Osmanlı Sikkeleri', sellerName: 'Antika Koleksiyoncusu', viewerCount: 243, currentBid: 5600, thumbnailUrl: '/images/stream1.jpg' },
  { id: 2, title: 'Vintage Saat Koleksiyonu', sellerName: 'SaatDünyası', viewerCount: 154, currentBid: 3200, thumbnailUrl: '/images/stream2.jpg' },
  { id: 3, title: 'El Yapımı Gümüş Takılar', sellerName: 'Gümüş Ustası', viewerCount: 87, currentBid: 1450, thumbnailUrl: '/images/stream3.jpg' },
  { id: 4, title: 'Antika Mobilya Mezatı', sellerName: 'Eski Zaman Eserleri', viewerCount: 325, currentBid: 8700, thumbnailUrl: '/images/stream4.jpg' },
];

const featuredAuctions = [
  { id: 1, title: 'El Yapımı Bakır Vazo', sellerName: 'Bakırcı Emre', currentBid: 2850, imageUrl: '/images/auction1.jpg', endTime: '2 saat', bidCount: 37 },
  { id: 2, title: 'Antika Cep Saati', sellerName: 'Antikacı Kemal', currentBid: 4750, imageUrl: '/images/auction2.jpg', endTime: '5 saat', bidCount: 24 },
  { id: 3, title: 'Sanat Eseri Tablo', sellerName: 'Galeri İstanbul', currentBid: 7300, imageUrl: '/images/auction3.jpg', endTime: '1 gün', bidCount: 42 },
];

const popularStreamers = [
  { id: 1, username: 'AntikaUstası', followers: 15420, image: '/images/streamer1.jpg', category: 'Antika' },
  { id: 2, username: 'KoleksiyonDünyası', followers: 8765, image: '/images/streamer2.jpg', category: 'Koleksiyon' },
  { id: 3, username: 'SanatSever', followers: 12340, image: '/images/streamer3.jpg', category: 'Sanat' },
  { id: 4, username: 'TakıTasarım', followers: 6890, image: '/images/streamer4.jpg', category: 'Takı' },
];

const favoriteSellers = [
  { id: 1, name: 'Antika Sandığı', rating: 4.8, products: 124, followers: 1.2, image: '/images/seller1.jpg' },
  { id: 2, name: 'Kuyumcu Ahmet', rating: 4.9, products: 87, followers: 3.4, image: '/images/seller2.jpg' },
  { id: 3, name: 'Vintage Koleksiyoncu', rating: 4.7, products: 56, followers: 0.8, image: '/images/seller3.jpg' },
  { id: 4, name: 'Sanat Eserleri', rating: 5.0, products: 32, followers: 2.1, image: '/images/seller4.jpg' },
  { id: 5, name: 'Nadir Bulunanlar', rating: 4.6, products: 92, followers: 1.5, image: '/images/seller5.jpg' },
];

const trendingCategories = [
  { id: 1, name: 'Antikalar', count: 452, icon: '🏺' },
  { id: 2, name: 'Sanat', count: 328, icon: '🎨' },
  { id: 3, name: 'Koleksiyon', count: 296, icon: '📚' },
  { id: 4, name: 'Takı & Mücevher', count: 214, icon: '💎' },
  { id: 5, name: 'Vintage Giyim', count: 183, icon: '👗' },
  { id: 6, name: 'El Yapımı Ürünler', count: 174, icon: '✂️' },
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupFeature, setPopupFeature] = useState('');

  const handleMockLink = useCallback((featureName: string, e: React.MouseEvent) => {
    e.preventDefault();
    setPopupFeature(featureName);
    setPopupOpen(true);
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try {
        console.log("Fetching products...");
        const data = await getProducts();
        console.log("Products fetched successfully:", data);
        setProducts(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading products:", error);
        setError('Ürünler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        setLoading(false);
        
        // Set mock data for development to avoid breaking the UI
        if (process.env.NODE_ENV === 'development') {
          setProducts([
            {
              id: "mock-1",
              title: "Demo Ürün 1",
              description: "Bu bir demo ürünüdür.",
              price: 1200,
              currency: "TRY",
              userId: "user1",
              categoryId: "cat1",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              category: { id: "cat1", name: "Antika", description: "Antika ürünler", createdAt: "", updatedAt: "" }
            },
            {
              id: "mock-2",
              title: "Demo Ürün 2",
              description: "Bu bir başka demo ürünüdür.",
              price: 2500,
              currency: "TRY",
              userId: "user2",
              categoryId: "cat2",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              category: { id: "cat2", name: "Sanat", description: "Sanat eserleri", createdAt: "", updatedAt: "" }
            }
          ]);
        }
      }
    }

    loadProducts();
  }, []);

  return (
    <>
      <ComingSoonPopup 
        isOpen={popupOpen} 
        onClose={() => setPopupOpen(false)} 
        feature={popupFeature} 
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto">
        {/* Hero Banner */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white mb-10 relative">
          <div className="p-8 md:p-12 md:w-2/3">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">BidPazar'a Hoş Geldiniz</h1>
            <p className="text-lg mb-6 opacity-90">
              Canlı yayın müzayede platformunda benzersiz ürünleri keşfedin, teklif verin ve koleksiyonunuzu genişletin.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link 
                href="/live-streams" 
                className="bg-white text-[var(--accent)] font-medium px-6 py-2.5 rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Canlı Yayınları Keşfet
              </Link>
              <button 
                onClick={(e) => handleMockLink('Premium üyelik', e)}
                className="bg-transparent text-white border border-white font-medium px-6 py-2.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                Premium Üye Ol
              </button>
            </div>
          </div>
          <div className="hidden md:block absolute right-0 bottom-0 w-1/3 h-full">
            {/* This would be an image - for now it's a placeholder */}
            <div className="w-full h-full bg-black bg-opacity-20 flex items-center justify-center">
              <span className="opacity-0">Image</span>
            </div>
          </div>
        </div>

        {/* Trending Categories */}
        <section className="mb-10 bg-[var(--background)] border border-[var(--border)] p-6 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Trend Kategoriler</span>
            </h2>
            <Link 
              href="/categories" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
              onClick={(e) => handleMockLink('Tüm kategoriler', e)}
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {trendingCategories.map(category => (
              <Link 
                href={`/categories/${category.id}`}
                key={category.id}
                className="flex flex-col items-center p-4 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors bg-[var(--muted)] hover:bg-[var(--background)]"
                onClick={(e) => handleMockLink(`${category.name} kategorisi`, e)}
              >
                <span className="text-3xl mb-2">{category.icon}</span>
                <span className="font-medium text-[var(--foreground)]">{category.name}</span>
                <span className="text-xs text-[var(--foreground)] opacity-70">{category.count} ürün</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Instagram-like Stories Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Hikayeler</span>
            </h2>
            <Link 
              href="/stories" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
              onClick={(e) => handleMockLink('Tüm hikayeler', e)}
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-thin">
            {/* Add Story Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={(e) => handleMockLink('Hikaye ekleme', e)} 
                className="w-20 h-20 relative flex-shrink-0"
              >
                <div className="w-full h-full rounded-full flex items-center justify-center bg-[var(--secondary)] border-2 border-[var(--accent)] hover:opacity-90 transition-opacity cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </button>
              <span className="text-sm mt-2 text-center text-[var(--foreground)] font-medium">Hikaye Ekle</span>
            </div>

            {/* Stories */}
            {stories.map(story => (
              <div key={story.id} className="flex flex-col items-center">
                <button
                  onClick={(e) => handleMockLink(`${story.username} hikayesi`, e)}
                  className="w-20 h-20 relative flex-shrink-0"
                >
                  <div className={`absolute inset-0 rounded-full ${story.hasNewStory ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--primary)]' : 'bg-[var(--secondary)]'} p-[2px]`}>
                    <div className="w-full h-full rounded-full border-2 border-[var(--background)] overflow-hidden bg-[var(--background)]">
                      {/* Fallback if image is not available */}
                      <div className="w-full h-full bg-[var(--secondary)] flex items-center justify-center">
                        <span className="text-xl font-bold text-[var(--foreground)]">
                          {story.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                <span className="text-sm mt-2 text-center truncate w-20 text-[var(--foreground)]">{story.username}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Live Streams Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Canlı Müzayedeler</span>
            </h2>
            <Link 
              href="/live-streams" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
              onClick={(e) => handleMockLink('Tüm canlı müzayedeler', e)}
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveStreams.map(stream => (
              <div 
                key={stream.id} 
                className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-md transition group cursor-pointer"
                onClick={(e) => handleMockLink(`${stream.title} canlı yayını`, e)}
              >
                <div className="relative h-48 bg-[var(--secondary)]">
                  {/* Placeholder for missing images */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[var(--foreground)] text-opacity-70">Yayın Görseli</span>
                  </div>

                  {/* Live Badge */}
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center">
                    <span className="mr-1.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    CANLI
                  </div>

                  {/* Viewer Count */}
                  <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {stream.viewerCount}
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30">
                    <div className="bg-white bg-opacity-90 rounded-full p-3">
                      <Video className="h-8 w-8 text-[var(--accent)]" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-[var(--foreground)] mb-1 truncate group-hover:text-[var(--accent)] transition-colors">{stream.title}</h3>
                  <p className="text-sm text-[var(--foreground)] opacity-80 mb-3">{stream.sellerName}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--foreground)] opacity-70">Güncel Teklif:</span>
                    <span className="font-bold text-[var(--primary)]">{stream.currentBid.toLocaleString()} ₺</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Auctions Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Öne Çıkan Açık Arttırmalar</span>
            </h2>
            <Link 
              href="/auctions/featured" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
              onClick={(e) => handleMockLink('Öne çıkan açık arttırmalar', e)}
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredAuctions.map(auction => (
              <div 
                key={auction.id} 
                className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-lg transition group cursor-pointer relative"
                onClick={(e) => handleMockLink(`${auction.title} açık arttırması`, e)}
              >
                <div className="absolute top-3 right-3 z-10">
                  <button className="bg-white bg-opacity-90 rounded-full p-2 shadow-md hover:bg-[var(--accent)] hover:text-white transition-colors">
                    <Bookmark className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative h-52 bg-[var(--secondary)]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[var(--foreground)] text-opacity-70">Ürün Görseli</span>
                  </div>
                  
                  {/* Countdown Badge */}
                  <div className="absolute bottom-3 right-3 bg-[var(--background)] text-[var(--foreground)] text-xs font-medium px-2 py-1 rounded-md flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {auction.endTime} kaldı
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-[var(--foreground)] mb-1 truncate group-hover:text-[var(--accent)] transition-colors">{auction.title}</h3>
                  <p className="text-sm text-[var(--foreground)] opacity-80 mb-3">{auction.sellerName}</p>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center text-xs text-[var(--foreground)] opacity-70">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>{auction.bidCount} teklif</span>
                    </div>
                    <span className="font-bold text-[var(--primary)]">{auction.currentBid.toLocaleString()} ₺</span>
                  </div>
                  
                  <button className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors">
                    Teklif Ver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Popular Streamers Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Popüler Yayıncılar</span>
            </h2>
            <Link 
              href="/streamers" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
              onClick={(e) => handleMockLink('Popüler yayıncılar', e)}
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {popularStreamers.map(streamer => (
              <div 
                key={streamer.id} 
                className="rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-colors bg-[var(--background)] cursor-pointer"
                onClick={(e) => handleMockLink(`${streamer.username} yayıncı profili`, e)}
              >
                <div className="bg-gradient-to-b from-[var(--accent)] to-[var(--primary)] p-3">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden">
                      {/* Placeholder for streamer image */}
                      <div className="w-full h-full bg-[var(--muted)] flex items-center justify-center">
                        <span className="text-xl font-bold text-[var(--foreground)]">
                          {streamer.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 text-center">
                  <h3 className="font-semibold text-[var(--foreground)] mb-1">{streamer.username}</h3>
                  <p className="text-xs text-[var(--foreground)] opacity-70 mb-3">{streamer.category}</p>
                  
                  <div className="flex items-center justify-center text-sm">
                    <Users className="h-4 w-4 mr-1 text-[var(--accent)]" />
                    <span className="text-[var(--foreground)]">{(streamer.followers / 1000).toFixed(1)}K takipçi</span>
                  </div>
                  
                  <button className="mt-3 w-full py-1.5 text-xs border border-[var(--accent)] text-[var(--accent)] rounded-md font-medium hover:bg-[var(--accent)] hover:text-white transition-colors">
                    Takip Et
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Products Section -> Renamed to Auctions */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Açık Arttırmalar</span>
            </h2>
            <Link 
              href="/auctions" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--secondary)] border-t-[var(--primary)]"></div>
              <p className="mt-2 text-[var(--foreground)]">Açık arttırmalar yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-[var(--foreground)]">Henüz açık arttırma bulunmuyor.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-md transition block group"
                >
                  <div className="h-48 relative bg-[var(--secondary)]">
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized={true}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[var(--foreground)] text-opacity-70">Ürün Görseli</span>
                      </div>
                    )}
                    
                    {/* Bid Count Badge */}
                    <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {Math.floor(Math.random() * 50) + 5} teklif
                    </div>
                    
                    {/* Time Left Badge */}
                    <div className="absolute bottom-3 right-3 bg-[var(--background)] text-[var(--foreground)] text-xs font-medium px-2 py-1 rounded-md flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {Math.floor(Math.random() * 12) + 1} saat
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">{product.title}</h3>
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
                      <span className="font-bold text-[var(--primary)]">{product.price.toLocaleString()} ₺</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Favorite Sellers Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Favori Satıcılar</span>
            </h2>
            <Link 
              href="/sellers" 
              className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
              onClick={(e) => handleMockLink('Tüm satıcılar', e)}
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {favoriteSellers.map(seller => (
              <div 
                key={seller.id} 
                className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={(e) => handleMockLink(`${seller.name} satıcı profili`, e)}
              >
                <div className="p-4 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-white flex items-center justify-center mb-3 font-bold text-xl">
                    {seller.name.charAt(0)}
                  </div>
                  <h3 className="font-medium text-center mb-1 group-hover:text-[var(--accent)] transition-colors">{seller.name}</h3>
                  <div className="flex items-center text-amber-500 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="ml-1 text-sm">{seller.rating}</span>
                  </div>
                  <div className="text-xs text-[var(--foreground)] opacity-70 flex justify-between w-full mt-2">
                    <span>{seller.products} Ürün</span>
                    <span>{seller.followers}K Takipçi</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="mb-10 bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] rounded-xl p-8 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">BidPazar'ın Ayrıcalıklarından Yararlanın</h2>
            <p className="mb-6 opacity-90">
              Özel teklifler, yeni açık arttırmalar ve canlı yayın duyuruları için bültenimize abone olun.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <input 
                type="email" 
                placeholder="E-posta adresiniz" 
                className="px-4 py-2.5 rounded-lg text-[var(--foreground)] bg-white w-full sm:w-auto sm:min-w-[300px]"
              />
              <button
                onClick={(e) => handleMockLink('Bültene abone olma', e)}
                className="px-6 py-2.5 bg-white text-[var(--accent)] font-medium rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Abone Ol
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
