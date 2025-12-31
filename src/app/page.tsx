'use client';

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Product,
  getProducts,
  Story,
  LiveStream,
  getStories,
  createStory as createStoryAPI,
  getLiveStreamsForHomepage,
  uploadStoryImage,
  getCategories,
  Category
} from "@/app/api/client";
import Image from "next/image";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import FeaturedAuctionCard from "@/components/FeaturedAuctionCard";
import PopularStreamerCard from "@/components/PopularStreamerCard";
import FavoriteSellerCard from "@/components/FavoriteSellerCard";
import { X, ChevronRight, Clock, TrendingUp, Award, Users, Heart, Eye, ChevronDown, Video, Bookmark, Plus, ChevronLeft, Upload, ImageIcon, Calendar } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

// Deterministic helpers to avoid SSR/CSR mismatches (hydration errors)
const formatPrice = (value: number) => new Intl.NumberFormat('tr-TR').format(value);
const formatDateTR = (input: string | number | Date) =>
  new Date(input).toLocaleDateString('tr-TR', { timeZone: 'UTC' });

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

// Instagram-like Story Viewer Component
const StoryViewer = ({
  stories,
  currentStoryIndex,
  isOpen,
  onClose,
  onNext,
  onPrevious
}: {
  stories: Story[],
  currentStoryIndex: number,
  isOpen: boolean,
  onClose: () => void,
  onNext: () => void,
  onPrevious: () => void
}) => {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const storyDuration = 5000; // 5 seconds per story

  useEffect(() => {
    if (!isOpen || stories.length === 0 || isPaused) return;

    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          onNext();
          return 0;
        }
        return prev + (100 / (storyDuration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStoryIndex, isOpen, isPaused, onNext]);

  if (!isOpen || stories.length === 0) return null;

  const currentStory = stories[currentStoryIndex];
  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black" />

      {/* Story Container - Instagram style 9:16 aspect ratio */}
      <div className="relative w-full max-w-md mx-auto" style={{ aspectRatio: '9/16', maxHeight: '90vh' }}>
        <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
          {/* Progress bars */}
          <div className="absolute top-4 left-4 right-4 z-30 flex gap-1">
            {stories.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-white bg-opacity-30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{
                    width: index < currentStoryIndex ? '100%' :
                      index === currentStoryIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-12 left-4 right-4 z-30 flex items-center justify-between text-white">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] flex items-center justify-center text-white font-bold mr-3 shadow-lg">
                {(currentStory.user?.username || currentStory.user?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm drop-shadow-lg">{currentStory.user?.username || currentStory.user?.name || 'Anonim'}</p>
                <p className="text-xs opacity-70 drop-shadow-lg">
                  {formatDateTR(currentStory.createdAt)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors p-2 bg-black bg-opacity-30 rounded-full"
            >
              <X size={24} />
            </button>
          </div>

          {/* Story Content */}
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            {currentStory.type === 'IMAGE' && currentStory.mediaUrl ? (
              (() => {
                const base = process.env.NEXT_PUBLIC_APP_URL || '';
                const src = currentStory.mediaUrl.startsWith('http')
                  ? currentStory.mediaUrl
                  : `${base}${currentStory.mediaUrl}`;
                return (
                  <Image
                    src={src}
                    alt="Story"
                    fill
                    sizes="(max-width: 768px) 100vw, 500px"
                    className="object-contain"
                    unoptimized
                  />
                );
              })()
            ) : (
              <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-[var(--accent)] to-[var(--primary)]">
                <p className="text-white text-xl font-medium text-center leading-relaxed">
                  {currentStory.content}
                </p>
              </div>
            )}
          </div>
          {/* Navigation areas */}
          <div className="absolute inset-0 flex z-20">
            <button
              className="flex-1 bg-transparent"
              onClick={onPrevious}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            />
            <button
              className="flex-1 bg-transparent"
              onClick={onNext}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            />
          </div>

          {/* Navigation indicators (optional) */}
          <div className="absolute bottom-8 left-4 right-4 flex justify-between text-white opacity-50 z-20">
            {currentStoryIndex > 0 && (
              <button onClick={onPrevious} className="flex items-center bg-black bg-opacity-30 rounded-full p-2">
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="flex-1" />
            {currentStoryIndex < stories.length - 1 && (
              <button onClick={onNext} className="flex items-center bg-black bg-opacity-30 rounded-full p-2">
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Story Creation Modal with Image Upload
const StoryCreateModal = ({ isOpen, onClose, onCreateStory }: {
  isOpen: boolean,
  onClose: () => void,
  onCreateStory: (content: string, type?: "TEXT" | "IMAGE", mediaUrl?: string) => void
}) => {
  const [content, setContent] = useState('');
  const [storyType, setStoryType] = useState<"TEXT" | "IMAGE">("TEXT");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Görsel boyutu 5MB\'dan küçük olmalıdır');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Lütfen sadece görsel dosyası seçin');
        return;
      }

      setSelectedImage(file);
      setStoryType("IMAGE");

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setStoryType("TEXT");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (storyType === "TEXT" && !content.trim()) {
      toast.error('Lütfen hikaye içeriği girin');
      return;
    }

    if (storyType === "IMAGE" && !selectedImage) {
      toast.error('Lütfen bir görsel seçin');
      return;
    }

    setIsSubmitting(true);
    try {
      let mediaUrl: string | undefined = undefined;

      if (storyType === "IMAGE" && selectedImage) {
        console.log('Uploading image:', selectedImage.name);
        mediaUrl = await uploadStoryImage(selectedImage);
        console.log('Image uploaded successfully:', mediaUrl);
      }

      await onCreateStory(
        content.trim() || (storyType === "IMAGE" ? 'Görsel hikayesi' : ''),
        storyType,
        mediaUrl
      );
      setContent('');
      clearImage();
      onClose();
      toast.success('Hikaye başarıyla oluşturuldu!');
    } catch (error) {
      console.error('Story creation error:', error);
      toast.error('Hikaye oluşturulurken bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] rounded-xl shadow-2xl max-w-md w-full p-6 relative border border-[var(--border)] max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
          disabled={isSubmitting}
        >
          <X size={20} />
        </button>

        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-[var(--foreground)]">Hikaye Oluştur</h3>
        </div>

        {/* Type Selector */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setStoryType("TEXT");
              clearImage();
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${storyType === "TEXT"
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            disabled={isSubmitting}
          >
            Metin
          </button>
          <button
            type="button"
            onClick={() => setStoryType("IMAGE")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${storyType === "IMAGE"
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            disabled={isSubmitting}
          >
            Görsel
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {storyType === "IMAGE" && (
            <div className="mb-4">
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-64 border-2 border-dashed border-[var(--border)] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors"
                >
                  <Upload className="h-12 w-12 text-[var(--foreground)] opacity-50 mb-2" />
                  <p className="text-[var(--foreground)] opacity-70 text-sm text-center">
                    Görsel yüklemek için tıklayın<br />
                    <span className="text-xs">Max: 5MB, Dikey formatı tercih edilir</span>
                  </p>
                </div>
              ) : (
                <div className="relative w-full h-64 rounded-lg overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Story preview"
                    fill
                    sizes="400px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full p-1 hover:bg-opacity-80 transition-colors"
                    disabled={isSubmitting}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                disabled={isSubmitting}
              />
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={storyType === "IMAGE" ? "Görseliniz için açıklama yazın... (isteğe bağlı)" : "Hikayenizi yazın..."}
            className="w-full p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] resize-none h-32 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            maxLength={500}
            disabled={isSubmitting}
            required={storyType === "TEXT"}
          />
          <div className="text-right text-sm text-[var(--foreground)] opacity-70 mt-1">
            {content.length}/500
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[var(--border)] text-[var(--foreground)] rounded-lg font-medium hover:bg-[var(--muted)] transition-colors"
              disabled={isSubmitting}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (storyType === "TEXT" && !content.trim()) ||
                (storyType === "IMAGE" && !selectedImage)
              }
              className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Oluşturuluyor...' : 'Paylaş'}
            </button>
          </div>
        </form>
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

// API data types
interface FeaturedProduct extends Product {
  auctions?: Array<{
    id: string;
    endTime?: Date | string | null;
    bids?: Array<{
      amount: number;
    }>;
  }>;
}

interface PopularStreamer {
  id: string;
  username: string;
  name?: string | null;
  isVerified: boolean;
  totalStreams: number;
  totalProducts: number;
  isLive: boolean;
  currentViewers: number;
}

interface FavoriteSeller {
  id: string;
  username: string;
  name?: string | null;
  isVerified: boolean;
  totalProducts: number;
  activeProducts: number;
}

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [liveStreamsMeta, setLiveStreamsMeta] = useState({ totalLiveStreams: 0, hasActiveStreams: false });
  const [loading, setLoading] = useState(true);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [liveStreamsLoading, setLiveStreamsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupFeature, setPopupFeature] = useState('');
  const [storyCreateModalOpen, setStoryCreateModalOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [homeSearch, setHomeSearch] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [popularStreamers, setPopularStreamers] = useState<PopularStreamer[]>([]);
  const [favoriteSellers, setFavoriteSellers] = useState<FavoriteSeller[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [streamersLoading, setStreamersLoading] = useState(true);
  const [sellersLoading, setSellersLoading] = useState(true);

  const handleHomeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = homeSearch.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const handleMockLink = useCallback((featureName: string, e: React.MouseEvent) => {
    e.preventDefault();
    setPopupFeature(featureName);
    setPopupOpen(true);
  }, []);

  const handleStoryClick = useCallback((storyIndex: number) => {
    setCurrentStoryIndex(storyIndex);
    setStoryViewerOpen(true);
  }, []);

  const handleCreateStory = useCallback(async (content: string, type?: "TEXT" | "IMAGE", mediaUrl?: string) => {
    try {
      const newStory = await createStoryAPI({ content, type, mediaUrl });
      setStories(prev => [newStory, ...prev]);
    } catch (error) {
      console.error("Error creating story:", error);
      throw error;
    }
  }, []);

  const handleNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      setStoryViewerOpen(false);
    }
  }, [currentStoryIndex, stories.length]);

  const handlePreviousStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      setStoryViewerOpen(false);
    }
  }, [currentStoryIndex]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        // Load products, stories, live streams, and categories in parallel
        const [productsData, storiesData, liveStreamsData, categoriesData] = await Promise.all([
          getProducts().catch(() => []),
          getStories().catch(() => []),
          getLiveStreamsForHomepage().catch(() => ({ streams: [], meta: { totalLiveStreams: 0, hasActiveStreams: false } })),
          getCategories({ withProductCount: true }).catch(() => []),
        ]);

        console.log("Data loaded successfully:", {
          products: productsData.length,
          stories: storiesData.length,
          liveStreams: liveStreamsData.streams.length,
          categories: Array.isArray(categoriesData) ? categoriesData.length : 0,
        });

        setProducts(Array.isArray(productsData) ? productsData : []);
        setStories(Array.isArray(storiesData) ? storiesData : []);
        setLiveStreams(Array.isArray(liveStreamsData.streams) ? liveStreamsData.streams : []);
        setLiveStreamsMeta(liveStreamsData.meta || { totalLiveStreams: 0, hasActiveStreams: false });
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        console.error("Error loading data:", error);
        setError('Veriler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');

        // Ensure all state variables are arrays
        setProducts([]);
        setStories([]);
        setLiveStreams([]);
        setCategories([]);
        setLiveStreamsMeta({ totalLiveStreams: 0, hasActiveStreams: false });

        // Set mock data for development
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
              isSold: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              category: { id: "cat1", name: "Antika" },
              images: []
            },
          ]);

          // Mock categories if API fails
          setCategories([
            {
              id: '1',
              name: 'Antikalar',
              emoji: '🏺',
              productCount: 452,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: '2',
              name: 'Sanat',
              emoji: '🎨',
              productCount: 328,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: '3',
              name: 'Koleksiyon',
              emoji: '📚',
              productCount: 296,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: '4',
              name: 'Takı & Mücevher',
              emoji: '💎',
              productCount: 214,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: '5',
              name: 'Vintage Giyim',
              emoji: '👗',
              productCount: 183,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: '6',
              name: 'El Yapımı Ürünler',
              emoji: '✂️',
              productCount: 174,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
          ]);
        }
      } finally {
        setLoading(false);
        setStoriesLoading(false);
        setLiveStreamsLoading(false);
        setCategoriesLoading(false);
      }
    }

    loadData();
  }, []);

  // Load featured products, popular streamers, and favorite sellers
  useEffect(() => {
    async function loadFeaturedData() {
      try {
        // Fetch featured products
        setFeaturedLoading(true);
        const featuredRes = await fetch('/api/products/featured?limit=3');
        if (featuredRes.ok) {
          const featuredData = await featuredRes.json();
          setFeaturedProducts(featuredData.products || []);
        }
      } catch (error) {
        console.error('Error loading featured products:', error);
      } finally {
        setFeaturedLoading(false);
      }

      try {
        // Fetch popular streamers
        setStreamersLoading(true);
        const streamersRes = await fetch('/api/users/popular-streamers?limit=4');
        if (streamersRes.ok) {
          const streamersData = await streamersRes.json();
          setPopularStreamers(streamersData.streamers || []);
        }
      } catch (error) {
        console.error('Error loading popular streamers:', error);
      } finally {
        setStreamersLoading(false);
      }

      try {
        // Fetch favorite sellers
        setSellersLoading(true);
        const sellersRes = await fetch('/api/users/favorite-sellers?limit=5');
        if (sellersRes.ok) {
          const sellersData = await sellersRes.json();
          setFavoriteSellers(sellersData.sellers || []);
        }
      } catch (error) {
        console.error('Error loading favorite sellers:', error);
      } finally {
        setSellersLoading(false);
      }
    }

    loadFeaturedData();
  }, []);

  return (
    <>
      <ComingSoonPopup
        isOpen={popupOpen}
        onClose={() => setPopupOpen(false)}
        feature={popupFeature}
      />

      <StoryCreateModal
        isOpen={storyCreateModalOpen}
        onClose={() => setStoryCreateModalOpen(false)}
        onCreateStory={handleCreateStory}
      />

      <StoryViewer
        stories={stories}
        currentStoryIndex={currentStoryIndex}
        isOpen={storyViewerOpen}
        onClose={() => setStoryViewerOpen(false)}
        onNext={handleNextStory}
        onPrevious={handlePreviousStory}
      />

      <main className="flex-1 p-3 md:p-6 max-w-7xl mx-auto">
        {/* Hero Banner - Only show to non-authenticated users */}
        {!authLoading && !user && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white mb-6 md:mb-10 relative">
            <div className="p-6 md:p-12 md:w-2/3">
              <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">BidPazar'a Hoş Geldiniz</h1>
              <p className="text-base md:text-lg mb-4 md:mb-6 opacity-90">
                Canlı yayın müzayede platformunda benzersiz ürünleri keşfedin, teklif verin ve koleksiyonunuzu genişletin.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/live-streams"
                  className="bg-white text-[var(--accent)] font-medium px-6 py-2.5 rounded-lg hover:bg-opacity-90 transition-colors text-center"
                >
                  Canlı Yayınları Keşfet
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-transparent text-white border border-white font-medium px-6 py-2.5 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors text-center"
                >
                  Üye Ol
                </Link>
              </div>
            </div>
            <div className="hidden md:block absolute right-0 bottom-0 w-1/3 h-full">
              <div className="w-full h-full bg-black bg-opacity-20 flex items-center justify-center">
                <span className="opacity-0">Image</span>
              </div>
            </div>
          </div>
        )}

        {/* Search Section (above Stories) */}
        <section className="mb-6 md:mb-8">
          <form onSubmit={handleHomeSearchSubmit} className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--foreground)] opacity-60 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={homeSearch}
                onChange={(e) => setHomeSearch(e.target.value)}
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
        </section>

        {/* Instagram-like Stories Section */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Hikayeler</span>
            </h2>
          </div>

          {storiesLoading ? (
            <div className="flex space-x-4 md:space-x-6 overflow-x-auto pb-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 relative flex-shrink-0">
                    <div className="w-full h-full rounded-full bg-[var(--secondary)] animate-pulse"></div>
                  </div>
                  <div className="w-14 md:w-16 h-3 md:h-4 bg-[var(--secondary)] rounded mt-2 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex space-x-4 md:space-x-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-[var(--secondary)] scrollbar-thumb-[var(--accent)] scrollbar-thumb-rounded-full">
              {/* Add Story Button - Only show to authenticated users */}
              {user && (
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setStoryCreateModalOpen(true)}
                    className="w-16 h-16 md:w-20 md:h-20 relative flex-shrink-0"
                  >
                    <div className="w-full h-full rounded-full flex items-center justify-center bg-[var(--secondary)] border-2 border-[var(--accent)] hover:opacity-90 transition-opacity cursor-pointer">
                      <Plus className="h-6 w-6 md:h-8 md:w-8 text-[var(--accent)]" />
                    </div>
                  </button>
                  <span className="text-xs md:text-sm mt-2 text-center text-[var(--foreground)] font-medium">Hikaye Ekle</span>
                </div>
              )}

              {/* Real Stories */}
              {stories.length > 0 ? (
                stories.map(story => (
                  <div key={story.id} className="flex flex-col items-center">
                    <button
                      onClick={(e) => handleStoryClick(stories.indexOf(story))}
                      className="w-16 h-16 md:w-20 md:h-20 relative flex-shrink-0"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] p-[3px]">
                        <div className="w-full h-full rounded-full border-2 border-[var(--background)] bg-[var(--background)] relative overflow-hidden">
                          {story.type === 'IMAGE' && story.mediaUrl ? (
                            <div className="w-full h-full rounded-full overflow-hidden relative">
                              {(() => {
                                const base = process.env.NEXT_PUBLIC_APP_URL || '';
                                const src = story.mediaUrl.startsWith('http')
                                  ? story.mediaUrl
                                  : `${base}${story.mediaUrl}`;
                                return (
                                  <Image
                                    src={src}
                                    alt={(story.user?.username || story.user?.name || 'Hikaye') + ' hikayesi'}
                                    fill
                                    sizes="64px"
                                    className="object-cover rounded-full"
                                    unoptimized
                                  />
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="w-full h-full bg-[var(--secondary)] flex items-center justify-center rounded-full">
                              <span className="text-lg md:text-xl font-bold text-[var(--foreground)]">
                                {(story.user?.username || story.user?.name || 'A').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    <span className="text-xs md:text-sm mt-2 text-center truncate w-16 md:w-20 text-[var(--foreground)]">
                      {story.user?.username || story.user?.name || 'Anonim'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 text-center py-6 md:py-8">
                  <p className="text-[var(--foreground)] opacity-70 text-sm md:text-base">
                    {user ? 'İlk hikayeyi siz oluşturun!' : 'Henüz hikaye paylaşılmamış'}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Trending Categories */}
        <section className="mb-6 md:mb-10 bg-[var(--background)] border border-[var(--border)] p-4 md:p-6 rounded-xl">
          <div className="flex items-center mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Trend Kategoriler</span>
            </h2>
          </div>

          {categoriesLoading ? (
            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-[var(--secondary)] scrollbar-thumb-[var(--accent)] scrollbar-thumb-rounded-full">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex flex-col items-center p-3 md:p-4 border border-[var(--border)] rounded-lg bg-[var(--muted)] animate-pulse min-w-[100px] md:min-w-[120px] flex-shrink-0">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-[var(--secondary)] rounded mb-2"></div>
                  <div className="w-12 md:w-16 h-3 md:h-4 bg-[var(--secondary)] rounded mb-1"></div>
                  <div className="w-8 md:w-12 h-2 md:h-3 bg-[var(--secondary)] rounded"></div>
                </div>
              ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-track-[var(--secondary)] scrollbar-thumb-[var(--accent)] scrollbar-thumb-rounded-full">
              {categories.map(category => (
                <Link
                  href={`/categories/${category.id}`}
                  key={category.id}
                  className="flex flex-col items-center p-3 md:p-4 border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors bg-[var(--muted)] hover:bg-[var(--background)] group min-w-[100px] md:min-w-[120px] flex-shrink-0"
                >
                  <span className="text-2xl md:text-3xl mb-2 group-hover:scale-110 transition-transform">
                    {category.emoji || '📦'}
                  </span>
                  <span className="font-medium text-[var(--foreground)] text-center text-xs md:text-sm leading-tight mb-1">
                    {category.name}
                  </span>
                  <span className="text-xs text-[var(--foreground)] opacity-70">
                    {category.productCount || 0} ürün
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 md:py-8">
              <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-[var(--secondary)] rounded-full flex items-center justify-center mb-4">
                <span className="text-xl md:text-2xl">📦</span>
              </div>
              <p className="text-[var(--foreground)] opacity-70 text-sm md:text-base">
                Henüz kategori bulunmuyor.
              </p>
            </div>
          )}
        </section>

        {/* Live Streams Section */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Canlı Müzayedeler</span>
            </h2>
            <Link
              href="/live-streams"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          {liveStreamsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)]">
                  <div className="h-32 md:h-48 bg-[var(--secondary)] animate-pulse"></div>
                  <div className="p-3 md:p-4 space-y-2">
                    <div className="h-3 md:h-4 bg-[var(--secondary)] rounded animate-pulse"></div>
                    <div className="h-2 md:h-3 bg-[var(--secondary)] rounded animate-pulse w-2/3"></div>
                    <div className="h-4 md:h-6 bg-[var(--secondary)] rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : liveStreams.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {liveStreams.map(stream => {
                const isLive = stream.status === 'LIVE';
                const isScheduled = stream.status === 'SCHEDULED';

                // Format scheduled start time
                const formatScheduledTime = (startTime: string | undefined) => {
                  if (!startTime) return '';
                  const date = new Date(startTime);
                  const now = new Date();
                  const isToday = date.toDateString() === now.toDateString();
                  const tomorrow = new Date(now);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const isTomorrow = date.toDateString() === tomorrow.toDateString();

                  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                  if (isToday) return `Bugün ${timeStr}`;
                  if (isTomorrow) return `Yarın ${timeStr}`;
                  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                };

                return (
                  <Link
                    href={`/live-streams/${stream.id}`}
                    key={stream.id}
                    className={`rounded-xl overflow-hidden border bg-[var(--background)] hover:shadow-md transition group cursor-pointer ${isScheduled
                      ? 'border-amber-500/50'
                      : 'border-[var(--border)]'
                      }`}
                  >
                    <div className="relative h-32 md:h-48 bg-[var(--secondary)]">
                      {stream.thumbnailUrl ? (
                        <Image
                          src={stream.thumbnailUrl}
                          alt={stream.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 350px"
                          className={`object-cover ${isScheduled ? 'opacity-80' : ''}`}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[var(--foreground)] text-opacity-70 text-xs md:text-sm">Yayın Görseli</span>
                        </div>
                      )}

                      {/* Live Badge - Only show for LIVE streams */}
                      {isLive && (
                        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                          <span className="mr-1 flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                          </span>
                          CANLI
                        </div>
                      )}

                      {/* Scheduled Badge - Show for SCHEDULED streams */}
                      {isScheduled && (
                        <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          PLANLI
                        </div>
                      )}

                      {/* Viewer Count - Only show for LIVE streams */}
                      {isLive && (
                        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                          <Eye className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                          {stream.viewerCount || 0}
                        </div>
                      )}

                      {/* Scheduled Time Badge - Show for SCHEDULED streams */}
                      {isScheduled && stream.startTime && (
                        <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                          <Calendar className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                          {formatScheduledTime(stream.startTime)}
                        </div>
                      )}

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30">
                        <div className="bg-white bg-opacity-90 rounded-full p-2 md:p-3">
                          <Video className="h-4 w-4 md:h-8 md:w-8 text-[var(--accent)]" />
                        </div>
                      </div>

                      {/* Scheduled Overlay - Semi-transparent overlay for scheduled streams */}
                      {isScheduled && (
                        <div className="absolute inset-0 bg-gradient-to-t from-amber-900/40 to-transparent pointer-events-none" />
                      )}
                    </div>

                    <div className="p-3 md:p-4">
                      <h3 className="font-semibold text-[var(--foreground)] text-xs md:text-base mb-1 truncate group-hover:text-[var(--accent)] transition-colors">{stream.title}</h3>
                      <p className="text-xs md:text-sm text-[var(--foreground)] opacity-80 mb-2 md:mb-3">{stream.user?.username || stream.user?.name || 'Anonim Yayıncı'}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--foreground)] opacity-70">
                          {stream.listings && stream.listings.length > 0 ? `${stream.listings.length} ürün` : 'Henüz ürün yok'}
                        </span>
                        <span className={`font-bold text-xs md:text-sm ${isScheduled ? 'text-amber-500' : 'text-[var(--primary)]'}`}>
                          {isScheduled
                            ? 'Yakında'
                            : stream.listings && stream.listings.length > 0 && stream.listings[0].product
                              ? `${formatPrice(stream.listings[0].product.price)} ₺`
                              : 'Başladı'
                          }
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 md:py-12 bg-[var(--muted)] rounded-xl">
              <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-[var(--secondary)] rounded-full flex items-center justify-center mb-4">
                <Video className="h-6 w-6 md:h-8 md:w-8 text-[var(--foreground)] opacity-50" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-[var(--foreground)] mb-2">Henüz Aktif Yayın Yok</h3>
              <p className="text-[var(--foreground)] opacity-70 mb-4 text-sm md:text-base px-4">
                Şu anda canlı müzayede yayını bulunmuyor. Yakında başlayacak yayınlar için takipte kalın!
              </p>
              <Link
                href="/live-streams"
                className="inline-flex items-center px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm md:text-base"
              >
                Tüm Yayınları Görüntüle
              </Link>
            </div>
          )}
        </section>

        {/* Featured Auctions Section */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Öne Çıkan Açık Arttırmalar</span>
            </h2>
            <Link
              href="/products"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          {featuredLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
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
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {featuredProducts.map(product => (
                <FeaturedAuctionCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[var(--muted)] rounded-xl">
              <Award className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)] opacity-50" />
              <p className="text-[var(--foreground)] opacity-70">Şu anda öne çıkan açık arttırma bulunmuyor.</p>
            </div>
          )}
        </section>

        {/* Popular Streamers Section */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Popüler Yayıncılar</span>
            </h2>
            <Link
              href="/sellers"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          {streamersLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--secondary)] animate-pulse">
                  <div className="bg-gradient-to-br from-purple-500/30 to-indigo-600/30 p-6">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[var(--secondary)] mx-auto"></div>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-[var(--secondary)] rounded w-3/4 mx-auto"></div>
                    <div className="h-3 bg-[var(--secondary)] rounded w-1/2 mx-auto"></div>
                    <div className="h-8 bg-[var(--secondary)] rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : popularStreamers.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {popularStreamers.map(streamer => (
                <PopularStreamerCard key={streamer.id} streamer={streamer} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[var(--muted)] rounded-xl">
              <Video className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)] opacity-50" />
              <p className="text-[var(--foreground)] opacity-70">Şu anda popüler yayıncı bulunmuyor.</p>
            </div>
          )}
        </section>

        {/* Products Section -> Renamed to Auctions */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Açık Arttırmalar</span>
            </h2>
            <Link
              href="/products"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-6 md:py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-4 border-[var(--secondary)] border-t-[var(--primary)]"></div>
              <p className="mt-2 text-[var(--foreground)] text-sm md:text-base">Açık arttırmalar yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="text-center py-6 md:py-8 text-red-500 text-sm md:text-base">{error}</div>
          ) : (
            <ProductGrid
              products={products}
              emptyMessage="Henüz açık arttırma bulunmuyor."
            />
          )}
        </section>

        {/* Favorite Sellers Section */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Favori Satıcılar</span>
            </h2>
            <Link
              href="/sellers"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          {sellersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--secondary)] animate-pulse">
                  <div className="p-5 space-y-3 flex flex-col items-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[var(--secondary)]"></div>
                    <div className="h-4 bg-[var(--secondary)] rounded w-3/4"></div>
                    <div className="h-3 bg-[var(--secondary)] rounded w-1/2"></div>
                    <div className="h-8 bg-[var(--secondary)] rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : favoriteSellers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {favoriteSellers.map(seller => (
                <FavoriteSellerCard key={seller.id} seller={seller} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[var(--muted)] rounded-xl">
              <Users className="h-12 w-12 mx-auto mb-4 text-[var(--foreground)] opacity-50" />
              <p className="text-[var(--foreground)] opacity-70">Şu anda favori satıcı bulunmuyor.</p>
            </div>
          )}
        </section>

        {/* Become Seller Section - Only show to non-sellers */}
        {user?.userType !== 'SELLER' && (
          <section className="mb-6 md:mb-10 bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] rounded-xl p-4 md:p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-1">BidPazar'da Satıcı Olun</h3>
                  <p className="text-sm opacity-90">
                    Canlı yayın müzayedeleriyle koleksiyonunuzu satışa sunun
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                {user ? (
                  <Link
                    href="/dashboard/seller-request"
                    className="inline-flex items-center px-4 py-2 md:px-6 md:py-3 bg-white text-[var(--accent)] font-medium rounded-lg hover:bg-opacity-90 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-4 4" />
                    </svg>
                    Başvuru Yap
                  </Link>
                ) : (
                  <Link
                    href="/login?redirect=seller"
                    className="inline-flex items-center px-4 py-2 md:px-6 md:py-3 bg-white text-[var(--accent)] font-medium rounded-lg hover:bg-opacity-90 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                    </svg>
                    Giriş Yap
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
