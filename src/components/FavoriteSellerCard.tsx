'use client';

import Link from 'next/link';
import { Star, Package, CheckCircle, TrendingUp } from 'lucide-react';

interface FavoriteSellerCardProps {
  seller: {
    id: string;
    username: string;
    name?: string | null;
    isVerified: boolean;
    totalProducts: number;
    activeProducts: number;
  };
}

export default function FavoriteSellerCard({ seller }: FavoriteSellerCardProps) {
  const displayName = seller.name || seller.username;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={`/sellers/${seller.id}`}
      className="group block bg-[var(--background)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-amber-500 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
    >
      {/* Content */}
      <div className="p-5">
        {/* Avatar with Star Badge */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            {/* Avatar */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-2xl md:text-3xl font-bold">
                {initial}
              </span>
            </div>
            {/* Star Badge */}
            <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-1.5 shadow-lg">
              <Star className="h-4 w-4 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="text-center mb-3">
          <h3 className="font-bold text-[var(--foreground)] text-sm md:text-base mb-1 flex items-center justify-center group-hover:text-amber-600 transition-colors">
            {displayName}
            {seller.isVerified && (
              <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 ml-1 text-blue-500 fill-blue-500" />
            )}
          </h3>
          <p className="text-xs text-[var(--foreground)] opacity-70">@{seller.username}</p>
        </div>

        {/* Favorite Badge */}
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 text-amber-800 dark:text-amber-200 text-xs font-bold px-3 py-1 rounded-full flex items-center border border-amber-300 dark:border-amber-700">
            <Star className="h-3 w-3 mr-1 fill-amber-500" />
            FAVORİ SATICI
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
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

        {/* CTA Button */}
        <button className="w-full py-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-md hover:shadow-lg">
          Ürünleri Görüntüle
        </button>
      </div>
    </Link>
  );
}

