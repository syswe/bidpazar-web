'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Star, Package, CheckCircle, TrendingUp, Video, Users } from 'lucide-react';

interface SellerCardProps {
  seller: {
    id: string;
    username: string;
    name?: string | null;
    isVerified: boolean;
    isPopularStreamer?: boolean;
    isFavoriteSeller?: boolean;
    profileImageUrl?: string | null;
    totalProducts: number;
    activeProducts: number;
    totalStreams?: number;
    isLive?: boolean;
    currentViewers?: number;
  };
}

export default function SellerCard({ seller }: SellerCardProps) {
  const displayName = seller.name || seller.username;
  const initial = displayName.charAt(0).toUpperCase();

  // Determine card style and badge based on seller type
  const isPopular = seller.isPopularStreamer;
  const isFavorite = seller.isFavoriteSeller;

  return (
    <Link
      href={`/sellers/${seller.id}`}
      className={`group block bg-[var(--background)] border border-[var(--border)] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] ${isPopular ? 'hover:border-purple-500' : isFavorite ? 'hover:border-amber-500' : 'hover:border-[var(--accent)]'
        }`}
    >
      {/* Header - Different styling for popular streamers */}
      {isPopular ? (
        <div className="relative bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 p-6">
          {/* Live Badge */}
          {seller.isLive && (
            <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center shadow-lg">
              <span className="flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              CANLI
            </div>
          )}

          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-white to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 overflow-hidden">
              {seller.profileImageUrl ? (
                <Image
                  src={seller.profileImageUrl}
                  alt={displayName}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <span className="text-3xl md:text-4xl font-bold text-purple-600">
                  {initial}
                </span>
              )}
            </div>
          </div>

          {/* Popular Badge */}
          <div className="flex justify-center">
            <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              POPÜLER YAYINCI
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5">
          {/* Avatar with Badge for Favorite Sellers */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative">
              {/* Avatar */}
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full ${isFavorite
                ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600'
                : 'bg-gradient-to-br from-[var(--accent)] to-[var(--primary)]'
                } text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 overflow-hidden`}>
                {seller.profileImageUrl ? (
                  <Image
                    src={seller.profileImageUrl}
                    alt={displayName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-2xl md:text-3xl font-bold">
                    {initial}
                  </span>
                )}
              </div>
              {/* Star Badge for Favorite */}
              {isFavorite && (
                <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-1.5 shadow-lg">
                  <Star className="h-4 w-4 text-white fill-white" />
                </div>
              )}
            </div>
          </div>

          {/* Favorite Badge */}
          {isFavorite && (
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 text-amber-800 dark:text-amber-200 text-xs font-bold px-3 py-1 rounded-full flex items-center border border-amber-300 dark:border-amber-700">
                <Star className="h-3 w-3 mr-1 fill-amber-500" />
                FAVORİ SATICI
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={isPopular ? 'p-5' : 'px-5 pb-5'}>
        {/* Name */}
        <div className="text-center mb-3">
          <h3 className={`font-bold text-[var(--foreground)] text-sm md:text-base mb-1 flex items-center justify-center transition-colors ${isPopular ? 'group-hover:text-purple-600' : isFavorite ? 'group-hover:text-amber-600' : 'group-hover:text-[var(--accent)]'
            }`}>
            {displayName}
            {seller.isVerified && (
              <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 ml-1 text-blue-500 fill-blue-500" />
            )}
          </h3>
          <p className="text-xs text-[var(--foreground)] opacity-70">@{seller.username}</p>
        </div>

        {/* Stats */}
        <div className={`grid ${isPopular ? 'grid-cols-2' : 'grid-cols-2'} gap-2 md:gap-3 mb-4`}>
          {isPopular && seller.totalStreams !== undefined && (
            <div className="bg-[var(--secondary)] rounded-lg p-2.5 text-center border border-[var(--border)]">
              <div className="flex items-center justify-center mb-1">
                <Video className="h-3.5 w-3.5 text-[var(--accent)] mr-1" />
                <span className="text-xs text-[var(--foreground)] opacity-70">Yayınlar</span>
              </div>
              <p className="text-base font-bold text-[var(--foreground)]">{seller.totalStreams}</p>
            </div>
          )}
          <div className="bg-[var(--secondary)] rounded-lg p-2.5 text-center border border-[var(--border)]">
            <div className="flex items-center justify-center mb-1">
              <Package className="h-3.5 w-3.5 text-[var(--accent)] mr-1" />
              <span className="text-xs text-[var(--foreground)] opacity-70">Ürün</span>
            </div>
            <p className="text-base font-bold text-[var(--foreground)]">{seller.totalProducts}</p>
          </div>
          <div className="bg-[var(--secondary)] rounded-lg p-2.5 text-center border border-[var(--border)]">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-500 mr-1" />
              <span className="text-xs text-[var(--foreground)] opacity-70">Aktif</span>
            </div>
            <p className="text-base font-bold text-green-600 dark:text-green-400">{seller.activeProducts}</p>
          </div>
        </div>

        {/* Current Viewers (if live) */}
        {isPopular && seller.isLive && seller.currentViewers && seller.currentViewers > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center text-red-600 dark:text-red-400">
              <Users className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                {seller.currentViewers} kişi izliyor
              </span>
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button className={`w-full py-2 text-sm font-medium rounded-xl transition-all duration-300 shadow-md hover:shadow-lg ${isPopular
          ? 'border-2 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white'
          : isFavorite
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
            : 'border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white'
          }`}>
          {isPopular && seller.isLive ? 'Canlı Yayına Katıl' : 'Ürünleri Görüntüle'}
        </button>
      </div>
    </Link>
  );
}
