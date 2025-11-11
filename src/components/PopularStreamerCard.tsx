'use client';

import Link from 'next/link';
import { Users, TrendingUp, Video, CheckCircle } from 'lucide-react';

interface PopularStreamerCardProps {
  streamer: {
    id: string;
    username: string;
    name?: string | null;
    isVerified: boolean;
    totalStreams: number;
    totalProducts: number;
    isLive: boolean;
    currentViewers: number;
  };
}

export default function PopularStreamerCard({ streamer }: PopularStreamerCardProps) {
  const displayName = streamer.name || streamer.username;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={`/sellers/${streamer.id}`}
      className="group block bg-[var(--background)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--accent)] hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
    >
      {/* Header with Gradient */}
      <div className="relative bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 p-6">
        {/* Live Badge */}
        {streamer.isLive && (
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
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-white to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <span className="text-3xl md:text-4xl font-bold text-purple-600">
              {initial}
            </span>
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

      {/* Content */}
      <div className="p-5">
        {/* Name */}
        <div className="text-center mb-4">
          <h3 className="font-bold text-[var(--foreground)] text-base md:text-lg mb-1 flex items-center justify-center group-hover:text-[var(--accent)] transition-colors">
            {displayName}
            {streamer.isVerified && (
              <CheckCircle className="h-4 w-4 ml-1.5 text-blue-500 fill-blue-500" />
            )}
          </h3>
          <p className="text-sm text-[var(--foreground)] opacity-70">@{streamer.username}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[var(--secondary)] rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Video className="h-4 w-4 text-[var(--accent)] mr-1" />
              <span className="text-xs text-[var(--foreground)] opacity-70">Yayınlar</span>
            </div>
            <p className="text-lg font-bold text-[var(--foreground)]">{streamer.totalStreams}</p>
          </div>
          <div className="bg-[var(--secondary)] rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-[var(--accent)] mr-1" />
              <span className="text-xs text-[var(--foreground)] opacity-70">Ürünler</span>
            </div>
            <p className="text-lg font-bold text-[var(--foreground)]">{streamer.totalProducts}</p>
          </div>
        </div>

        {/* Current Viewers (if live) */}
        {streamer.isLive && streamer.currentViewers > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center text-red-600 dark:text-red-400">
              <Users className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                {streamer.currentViewers} kişi izliyor
              </span>
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button className="w-full py-2.5 text-sm font-medium border-2 border-[var(--accent)] text-[var(--accent)] rounded-xl hover:bg-[var(--accent)] hover:text-white transition-all duration-300">
          {streamer.isLive ? 'Canlı Yayına Katıl' : 'Profili Görüntüle'}
        </button>
      </div>
    </Link>
  );
}

