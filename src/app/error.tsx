'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, RefreshCw, AlertTriangle, MessageCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[var(--background)] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="relative z-10 text-center max-w-lg mx-auto">
        {/* Error Icon with Animation */}
        <div className="relative mb-8 inline-block">
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-3xl bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center border border-red-500/20 mx-auto relative overflow-hidden">
            {/* Animated warning stripes */}
            <div className="absolute inset-0 opacity-10">
              <div 
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, var(--foreground) 10px, var(--foreground) 20px)`,
                  animation: 'stripes 1s linear infinite'
                }}
              />
            </div>
            
            <AlertTriangle className="w-14 h-14 md:w-18 md:h-18 text-red-500 relative z-10 animate-bounce" style={{ animationDuration: '2s' }} />
          </div>
          
          {/* Pulsing ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-3xl border-2 border-red-500/30 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">
            Bir Şeyler Ters Gitti
          </h1>
          <p className="text-base md:text-lg text-[var(--foreground)]/70 leading-relaxed">
            Üzgünüz, beklenmeyen bir hata oluştu. Endişelenmeyin, 
            teknik ekibimiz durumdan haberdar edildi.
          </p>
          
          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-left">
              <p className="text-xs font-mono text-red-500/80 break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-[var(--foreground)]/50 mt-2">
                  Hata Kodu: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => reset()}
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] text-white font-medium transition-all duration-300 hover:shadow-xl hover:shadow-[var(--accent)]/25 hover:scale-[1.02] w-full sm:w-auto"
          >
            <RefreshCw className="w-5 h-5 transition-transform group-hover:rotate-180 duration-500" />
            Tekrar Dene
          </button>
          
          <button
            onClick={() => router.back()}
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--secondary)] text-[var(--foreground)] font-medium transition-all duration-300 hover:bg-[var(--muted)] w-full sm:w-auto"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            Geri Dön
          </button>

          <Link
            href="/"
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[var(--border)] text-[var(--foreground)] font-medium transition-all duration-300 hover:border-[var(--accent)] hover:text-[var(--accent)] w-full sm:w-auto"
          >
            <Home className="w-5 h-5" />
            Ana Sayfa
          </Link>
        </div>

        {/* Support Link */}
        <div className="mt-10 pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--foreground)]/60 mb-4">
            Sorun devam ediyorsa bizimle iletişime geçin
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--muted)] text-[var(--foreground)]/80 text-sm transition-all duration-300 hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <MessageCircle className="w-4 h-4" />
            Destek Ekibiyle İletişim
          </Link>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes stripes {
          0% {
            transform: translateX(-20px);
          }
          100% {
            transform: translateX(0px);
          }
        }
      `}</style>
    </div>
  );
}

