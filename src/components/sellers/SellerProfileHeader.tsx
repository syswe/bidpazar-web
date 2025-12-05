'use client';

import { useState } from 'react';
import { Calendar, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/frontend-auth';

interface SellerProfileHeaderProps {
  seller: {
    id: string;
    username: string;
    name?: string | null;
    isVerified: boolean;
    isPopularStreamer?: boolean;
    isFavoriteSeller?: boolean;
    createdAt: string;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
    _count?: {
      products: number;
    };
  };
  currentUser?: {
    id: string;
  } | null;
}

export default function SellerProfileHeader({ seller, currentUser }: SellerProfileHeaderProps) {
  const [isFollowing, setIsFollowing] = useState(seller.isFollowing);
  const [followersCount, setFollowersCount] = useState(seller.followersCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast.error('Takip etmek için giriş yapmalısınız');
      return;
    }

    try {
      setIsLoading(true);
      const method = isFollowing ? 'DELETE' : 'POST';

      // Use the proper getToken function from frontend-auth
      const token = getToken();

      if (!token) {
        toast.error('Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      const response = await fetch(`/api/users/${seller.id}/follow`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('İşlem başarısız oldu');
      }

      setIsFollowing(!isFollowing);
      setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
      toast.success(isFollowing ? 'Takipten çıkıldı' : 'Takip ediliyor');
    } catch (error) {
      console.error('Follow error:', error);
      toast.error('Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = seller.name || seller.username;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="bg-[var(--background)] border-b border-[var(--border)]">
      {/* Cover Image (Placeholder) */}
      <div className="h-32 md:h-48 bg-gradient-to-r from-purple-600 to-blue-600 relative">
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="relative -mt-16 sm:-mt-20 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-[var(--background)] bg-[var(--secondary)] flex items-center justify-center shadow-lg overflow-hidden">
                <span className="text-4xl sm:text-5xl font-bold text-[var(--foreground)] opacity-50">
                  {initial}
                </span>
              </div>
              {seller.isVerified && (
                <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-1.5 rounded-full border-4 border-[var(--background)]" title="Doğrulanmış Satıcı">
                  <CheckCircle className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left mt-2 sm:mt-0 sm:mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] flex items-center justify-center sm:justify-start gap-2">
                {displayName}
                {seller.isPopularStreamer && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-200 dark:border-purple-800">
                    POPÜLER
                  </span>
                )}
              </h1>
              <p className="text-[var(--foreground)] opacity-70 font-medium">@{seller.username}</p>

              <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm text-[var(--foreground)] opacity-80">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Katılım: {new Date(seller.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</span>
                </div>
                {/* Add more metadata here if available */}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4 sm:mt-0">
              {currentUser && (
                <button
                  onClick={handleFollowToggle}
                  disabled={isLoading}
                  className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${isFollowing
                    ? 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)]'
                    : 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90'
                    }`}
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isFollowing ? (
                    'Takip Ediliyor'
                  ) : (
                    'Takip Et'
                  )}
                </button>
              )}
              {!currentUser && (
                <button
                  onClick={() => {
                    toast.error('Takip etmek için giriş yapmalısınız');
                    setTimeout(() => window.location.href = '/login', 1000);
                  }}
                  className="px-6 py-2.5 rounded-xl font-medium transition-all duration-200 bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                >
                  Takip Et
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center sm:justify-start gap-8 border-t border-[var(--border)] pt-6">
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-[var(--foreground)]">{seller._count?.products || 0}</div>
            <div className="text-sm text-[var(--foreground)] opacity-60">Ürün</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-[var(--foreground)]">{followersCount}</div>
            <div className="text-sm text-[var(--foreground)] opacity-60">Takipçi</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-[var(--foreground)]">{seller.followingCount}</div>
            <div className="text-sm text-[var(--foreground)] opacity-60">Takip Edilen</div>
          </div>
        </div>
      </div>
    </div>
  );
}
