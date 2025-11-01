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
import { X, ChevronRight, Clock, TrendingUp, Award, Users, Heart, Eye, ChevronDown, Video, Bookmark, Plus, ChevronLeft, Upload, ImageIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

// Deterministic helpers to avoid SSR/CSR mismatches (hydration errors)
const formatPrice = (value: number) => new Intl.NumberFormat('tr-TR').format(value);
const formatDateTR = (input: string | number | Date) =>
  new Date(input).toLocaleDateString('tr-TR', { timeZone: 'UTC' });
const seededNumber = (seed: string, min: number, max: number) => {
  // Simple deterministic hash -> [min, max]
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  const range = max - min + 1;
  const unsigned = (h >>> 0);
  return min + (unsigned % range);
};

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

      {/* Story Container */}
      <div className="relative w-full max-w-md h-full max-h-[800px] bg-black rounded-lg overflow-hidden">
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] flex items-center justify-center text-white font-bold mr-3">
              {(currentStory.user?.username || currentStory.user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">{currentStory.user?.username || currentStory.user?.name || 'Anonim'}</p>
              <p className="text-xs opacity-70">
                {formatDateTR(currentStory.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Story Content */}
        <div className="absolute inset-0 flex items-center justify-center">
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
                  className="object-cover"
                  unoptimized={true}
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
        <div className="absolute inset-0 flex">
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
        <div className="absolute bottom-8 left-4 right-4 flex justify-between text-white opacity-50">
          {currentStoryIndex > 0 && (
            <button onClick={onPrevious} className="flex items-center">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex-1" />
          {currentStoryIndex < stories.length - 1 && (
            <button onClick={onNext} className="flex items-center">
              <ChevronRight size={20} />
            </button>
          )}
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
                    className="object-cover"
                    unoptimized={true}
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
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] p-[2px]">
                        <div className="w-full h-full rounded-full border-2 border-[var(--background)] overflow-hidden bg-[var(--background)]">
                          {story.type === 'IMAGE' && story.mediaUrl ? (
                            (() => {
                              const base = process.env.NEXT_PUBLIC_APP_URL || '';
                              const src = story.mediaUrl.startsWith('http')
                                ? story.mediaUrl
                                : `${base}${story.mediaUrl}`;
                              return (
                                <Image
                                  src={src}
                                  alt={(story.user?.username || story.user?.name || 'Hikaye') + ' hikayesi'}
                                  fill
                                  className="object-cover"
                                  unoptimized={true}
                                />
                              );
                            })()
                          ) : (
                            <div className="w-full h-full bg-[var(--secondary)] flex items-center justify-center">
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
              {liveStreams.map(stream => (
                <Link
                  href={`/live-streams/${stream.id}`}
                  key={stream.id}
                  className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-md transition group cursor-pointer"
                >
                  <div className="relative h-32 md:h-48 bg-[var(--secondary)]">
                    {stream.thumbnailUrl ? (
                      <Image
                        src={stream.thumbnailUrl}
                        alt={stream.title}
                        fill
                        className="object-cover"
                        unoptimized={true}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[var(--foreground)] text-opacity-70 text-xs md:text-sm">Yayın Görseli</span>
                      </div>
                    )}

                    {/* Live Badge */}
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                      <span className="mr-1 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                      </span>
                      CANLI
                    </div>

                    {/* Viewer Count */}
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                      <Eye className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                      {stream.viewerCount || 0}
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30">
                      <div className="bg-white bg-opacity-90 rounded-full p-2 md:p-3">
                        <Video className="h-4 w-4 md:h-8 md:w-8 text-[var(--accent)]" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 md:p-4">
                    <h3 className="font-semibold text-[var(--foreground)] text-xs md:text-base mb-1 truncate group-hover:text-[var(--accent)] transition-colors">{stream.title}</h3>
                    <p className="text-xs md:text-sm text-[var(--foreground)] opacity-80 mb-2 md:mb-3">{stream.user?.username || stream.user?.name || 'Anonim Yayıncı'}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--foreground)] opacity-70">
                        {stream.listings && stream.listings.length > 0 ? `${stream.listings.length} ürün` : 'Henüz ürün yok'}
                      </span>
                      <span className="font-bold text-[var(--primary)] text-xs md:text-sm">
                        {stream.listings && stream.listings.length > 0 && stream.listings[0].product
                          ? `${formatPrice(stream.listings[0].product.price)} ₺`
                          : 'Başlıyor'
                        }
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
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
              href="/auctions"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
            {featuredAuctions.map(auction => (
              <Link
                href={`/auctions/${auction.id}`}
                key={auction.id}
                className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-lg transition group cursor-pointer relative"
              >
                <div className="absolute top-2 right-2 z-10">
                  <button className="bg-white bg-opacity-90 rounded-full p-1.5 md:p-2 shadow-md hover:bg-[var(--accent)] hover:text-white transition-colors">
                    <Bookmark className="h-3 w-3 md:h-4 md:w-4" />
                  </button>
                </div>
                <div className="relative h-32 md:h-52 bg-[var(--secondary)]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[var(--foreground)] text-opacity-70 text-xs md:text-sm">Ürün Görseli</span>
                  </div>

                  {/* Countdown Badge */}
                  <div className="absolute bottom-2 right-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-medium px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                    <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                    {auction.endTime} kaldı
                  </div>
                </div>

                <div className="p-3 md:p-4">
                  <h3 className="font-semibold text-[var(--foreground)] text-xs md:text-base mb-1 truncate group-hover:text-[var(--accent)] transition-colors">{auction.title}</h3>
                  <p className="text-xs md:text-sm text-[var(--foreground)] opacity-80 mb-2 md:mb-3">{auction.sellerName}</p>

                  <div className="flex justify-between items-center mb-2 md:mb-3">
                    <div className="flex items-center text-xs text-[var(--foreground)] opacity-70">
                      <TrendingUp className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                      <span>{auction.bidCount} teklif</span>
                    </div>
                    <span className="font-bold text-[var(--primary)] text-xs md:text-sm">{formatPrice(auction.currentBid)} ₺</span>
                  </div>

                  <button className="w-full py-1.5 md:py-2 bg-[var(--accent)] text-white rounded-md text-xs md:text-sm font-medium hover:bg-opacity-90 transition-colors">
                    Teklif Ver
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Popular Streamers Section */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Popüler Yayıncılar</span>
            </h2>
            <Link
              href="/streamers"
              className="text-xs md:text-sm text-[var(--primary)] font-medium hover:underline flex items-center"
            >
              Tümünü Gör <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {popularStreamers.map(streamer => (
              <Link
                href={`/streamers/${streamer.id}`}
                key={streamer.id}
                className="rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-colors bg-[var(--background)] cursor-pointer"
              >
                <div className="bg-gradient-to-b from-[var(--accent)] to-[var(--primary)] p-2 md:p-3">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white overflow-hidden">
                      {/* Placeholder for streamer image */}
                      <div className="w-full h-full bg-[var(--muted)] flex items-center justify-center">
                        <span className="text-base md:text-xl font-bold text-[var(--foreground)]">
                          {streamer.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 md:p-4 text-center">
                  <h3 className="font-semibold text-[var(--foreground)] text-xs md:text-base mb-1">{streamer.username}</h3>
                  <p className="text-xs text-[var(--foreground)] opacity-70 mb-2 md:mb-3">{streamer.category}</p>

                  <div className="flex items-center justify-center text-xs md:text-sm mb-2 md:mb-3">
                    <Users className="h-3 w-3 md:h-4 md:w-4 mr-1 text-[var(--accent)]" />
                    <span className="text-[var(--foreground)]">{(streamer.followers / 1000).toFixed(1)}K takipçi</span>
                  </div>

                  <button className="w-full py-1 md:py-1.5 text-xs border border-[var(--accent)] text-[var(--accent)] rounded-md font-medium hover:bg-[var(--accent)] hover:text-white transition-colors">
                    Takip Et
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Products Section -> Renamed to Auctions */}
        <section className="mb-6 md:mb-10">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-2xl font-bold text-[var(--foreground)]">
              <span className="border-b-4 border-[var(--accent)] pb-1">Açık Arttırmalar</span>
            </h2>
            <Link
              href="/auctions"
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
          ) : products.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-[var(--foreground)] text-sm md:text-base">Henüz açık arttırma bulunmuyor.</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {products.map(product => (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-md transition block group"
                >
                  <div className="h-32 md:h-48 relative bg-[var(--secondary)]">
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
                        <span className="text-[var(--foreground)] text-opacity-70 text-xs md:text-sm">Ürün Görseli</span>
                      </div>
                    )}

                    {/* Bid Count Badge */}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                      <TrendingUp className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                      {seededNumber(product.id, 5, 54)} teklif
                    </div>

                    {/* Time Left Badge */}
                    <div className="absolute bottom-2 right-2 bg-[var(--background)] text-[var(--foreground)] text-xs font-medium px-1.5 md:px-2 py-0.5 md:py-1 rounded-md flex items-center">
                      <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                      {seededNumber(product.id + '-t', 1, 12)} saat
                    </div>
                  </div>

                  <div className="p-3 md:p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors text-xs md:text-base flex-1 mr-2">{product.title}</h3>
                      <span className="bg-[var(--secondary)] text-[var(--foreground)] text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded flex-shrink-0">
                        {product.category?.name || 'Kategori'}
                      </span>
                    </div>

                    <p className="text-xs md:text-sm text-[var(--foreground)] opacity-80 mb-2 md:mb-3 line-clamp-2">
                      {product.description}
                    </p>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[var(--foreground)] opacity-70">
                        {product.user?.name || product.user?.username || 'Anonim'}
                      </span>
                      <span className="font-bold text-[var(--primary)] text-xs md:text-sm">{formatPrice(product.price)} ₺</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {favoriteSellers.map(seller => (
              <Link
                href={`/sellers/${seller.id}`}
                key={seller.id}
                className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="p-3 md:p-4 flex flex-col items-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-white flex items-center justify-center mb-2 md:mb-3 font-bold text-base md:text-xl">
                    {seller.name.charAt(0)}
                  </div>
                  <h3 className="font-medium text-center mb-1 group-hover:text-[var(--accent)] transition-colors text-xs md:text-sm">{seller.name}</h3>
                  <div className="flex items-center text-amber-500 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="ml-1 text-xs md:text-sm">{seller.rating}</span>
                  </div>
                  <div className="text-xs text-[var(--foreground)] opacity-70 flex justify-between w-full mt-2">
                    <span>{seller.products} Ürün</span>
                    <span>{seller.followers}K Takipçi</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
