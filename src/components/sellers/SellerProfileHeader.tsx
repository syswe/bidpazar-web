'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Calendar, CheckCircle, Package, Users, UserPlus, Star, Shield, Info } from 'lucide-react';
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
    profileImageUrl?: string | null;
    bio?: string | null;
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
    <div className="relative">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 h-64 bg-gradient-to-br from-[var(--accent)] via-[#c4a67a] to-[var(--primary)] opacity-90" />
      <div className="absolute inset-0 h-64 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aDZ2Nmgtdjk2em0tNiAwaDZ2Nmgtdjk2em0wIDBoLTZ2Nmg2di02em0wIDBoNnYtNmgtNnY2em0tNiAwdi02aDZ2NmgtNnptMCAwdjZoNnYtNmgtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Card */}
        <div className="pt-8 pb-6">
          <div className="bg-[var(--card-background)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
            {/* Card Header with Avatar */}
            <div className="relative">
              {/* Decorative top border */}
              <div className="h-2 bg-gradient-to-r from-[var(--accent)] to-[var(--primary)]" />

              <div className="px-6 py-8 sm:px-8">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] flex items-center justify-center shadow-lg ring-4 ring-[var(--background)] ring-offset-2 ring-offset-[var(--card-background)]">
                      {seller.profileImageUrl ? (
                        <Image
                          src={seller.profileImageUrl}
                          alt={displayName}
                          fill
                          sizes="128px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-4xl sm:text-5xl font-bold text-white">
                          {initial}
                        </span>
                      )}
                    </div>
                    {seller.isVerified && (
                      <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white p-2 rounded-xl shadow-lg border-2 border-[var(--card-background)]" title="Doğrulanmış Satıcı">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
                        {displayName}
                      </h1>
                      {seller.isVerified && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-800">
                          <Shield className="w-3.5 h-3.5" />
                          Onaylı
                        </span>
                      )}
                      {seller.isPopularStreamer && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-semibold border border-purple-100 dark:border-purple-800">
                          <Star className="w-3.5 h-3.5" />
                          Popüler
                        </span>
                      )}
                      {seller.isFavoriteSeller && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-100 dark:border-amber-800">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          Favori
                        </span>
                      )}
                    </div>

                    <p className="text-[var(--muted-foreground)] font-medium text-base mb-3">
                      @{seller.username}
                    </p>

                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-[var(--muted-foreground)]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[var(--accent)]" />
                        <span>Katılım: {new Date(seller.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Bio Section */}
                    {seller.bio && (
                      <div className="mt-4 p-3 bg-[var(--secondary)]/50 rounded-lg border border-[var(--border)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="w-4 h-4 text-[var(--accent)]" />
                          <span className="text-xs font-medium text-[var(--muted-foreground)]">Hakkında</span>
                        </div>
                        <p className="text-sm text-[var(--foreground)] leading-relaxed">
                          {seller.bio}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Follow Button */}
                  <div className="flex-shrink-0">
                    {currentUser ? (
                      <button
                        onClick={handleFollowToggle}
                        disabled={isLoading}
                        className={`group relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 min-w-[140px] justify-center ${isFollowing
                          ? 'bg-[var(--secondary)] text-[var(--foreground)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 border border-[var(--border)]'
                          : 'bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white hover:shadow-lg hover:shadow-[var(--accent)]/25 hover:-translate-y-0.5'
                          }`}
                      >
                        {isLoading ? (
                          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isFollowing ? (
                          <>
                            <span className="group-hover:hidden">Takip Ediliyor</span>
                            <span className="hidden group-hover:inline">Takibi Bırak</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-5 h-5" />
                            <span>Takip Et</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          toast.error('Takip etmek için giriş yapmalısınız');
                          setTimeout(() => window.location.href = '/login', 1000);
                        }}
                        className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white hover:shadow-lg hover:shadow-[var(--accent)]/25 hover:-translate-y-0.5"
                      >
                        <UserPlus className="w-5 h-5" />
                        <span>Takip Et</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className="border-t border-[var(--border)] bg-[var(--secondary)]/30">
              <div className="px-6 py-5 sm:px-8">
                <div className="grid grid-cols-3 gap-4 sm:gap-8">
                  {/* Products */}
                  <div className="text-center group">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] mb-2 group-hover:scale-110 transition-transform">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
                      {seller._count?.products || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-[var(--muted-foreground)] font-medium">
                      Ürün
                    </div>
                  </div>

                  {/* Followers */}
                  <div className="text-center group">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 mb-2 group-hover:scale-110 transition-transform">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
                      {followersCount}
                    </div>
                    <div className="text-xs sm:text-sm text-[var(--muted-foreground)] font-medium">
                      Takipçi
                    </div>
                  </div>

                  {/* Following */}
                  <div className="text-center group">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 mb-2 group-hover:scale-110 transition-transform">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
                      {seller.followingCount}
                    </div>
                    <div className="text-xs sm:text-sm text-[var(--muted-foreground)] font-medium">
                      Takip Edilen
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
