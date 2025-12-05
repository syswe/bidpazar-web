'use client';

import Link from 'next/link';
import { Home, Search, ArrowLeft, Radio, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[var(--background)] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating shapes */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-[var(--primary)]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--accent)]/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Animated 404 Number */}
        <div className="relative mb-8">
          <h1 className="text-[10rem] md:text-[14rem] font-black leading-none select-none">
            <span className="bg-gradient-to-br from-[var(--accent)] via-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent animate-gradient-x">
              4
            </span>
            <span className="relative inline-block">
              <span className="bg-gradient-to-br from-[var(--primary)] via-[var(--accent)] to-[var(--primary)] bg-clip-text text-transparent animate-gradient-x" style={{ animationDelay: '0.5s' }}>
                0
              </span>
              {/* Animated ring around zero */}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-dashed border-[var(--accent)]/30 animate-spin-slow" />
              </span>
            </span>
            <span className="bg-gradient-to-br from-[var(--accent)] via-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent animate-gradient-x" style={{ animationDelay: '1s' }}>
              4
            </span>
          </h1>
          
          {/* Floating auction icons */}
          <div className="absolute -top-4 left-1/4 animate-float">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center border border-[var(--accent)]/20">
              <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-[var(--accent)]" />
            </div>
          </div>
          <div className="absolute -bottom-2 right-1/4 animate-float" style={{ animationDelay: '0.5s' }}>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center border border-[var(--primary)]/20">
              <Radio className="w-5 h-5 md:w-6 md:h-6 text-[var(--primary)]" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4 mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">
            Oops! Sayfa Bulunamadı
          </h2>
          <p className="text-base md:text-lg text-[var(--foreground)]/70 max-w-md mx-auto leading-relaxed">
            Aradığınız sayfa taşınmış, silinmiş veya hiç var olmamış olabilir. 
            Canlı müzayedelere göz atmaya ne dersiniz?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => router.back()}
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-medium transition-all duration-300 hover:bg-[var(--muted)] hover:shadow-lg w-full sm:w-auto"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Geri Dön
          </button>
          
          <Link
            href="/"
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white font-medium transition-all duration-300 hover:shadow-xl hover:shadow-[var(--accent)]/25 hover:scale-[1.02] w-full sm:w-auto"
          >
            <Home className="w-5 h-5 transition-transform group-hover:scale-110" />
            Ana Sayfa
          </Link>

          <Link
            href="/live-streams"
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[var(--accent)] text-[var(--accent)] font-medium transition-all duration-300 hover:bg-[var(--accent)] hover:text-white w-full sm:w-auto"
          >
            <Radio className="w-5 h-5 transition-transform group-hover:scale-110" />
            Canlı Yayınlar
          </Link>
        </div>

        {/* Search suggestion */}
        <div className="mt-10 pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--foreground)]/60 mb-4">
            Belirli bir şey mi arıyorsunuz?
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--muted)] text-[var(--foreground)]/80 text-sm transition-all duration-300 hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <Search className="w-4 h-4" />
            Ürün veya müzayede ara
          </Link>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(5deg);
          }
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 4s ease infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

