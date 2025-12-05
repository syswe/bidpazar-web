'use client';

import { useEffect } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log critical error
    console.error('Critical Application Error:', error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <div
          className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
          style={{
            backgroundColor: '#071739',
            color: '#f1f5f9',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                animation: 'pulse 3s ease-in-out infinite'
              }}
            />
            <div
              className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
              style={{
                backgroundColor: 'rgba(166, 135, 104, 0.08)',
                animation: 'pulse 3s ease-in-out infinite',
                animationDelay: '1.5s'
              }}
            />
          </div>

          <div className="relative z-10 text-center max-w-lg mx-auto">
            {/* Critical Error Icon */}
            <div
              className="relative mb-8 inline-block"
              style={{ animation: 'float 4s ease-in-out infinite' }}
            >
              <div
                className="w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center mx-auto relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(234, 88, 12, 0.15) 100%)',
                  border: '2px solid rgba(220, 38, 38, 0.3)'
                }}
              >
                <AlertOctagon
                  style={{
                    width: '4rem',
                    height: '4rem',
                    color: '#ef4444'
                  }}
                />
              </div>

              {/* Rotating ring */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: 'spin 20s linear infinite' }}
              >
                <div
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full"
                  style={{
                    border: '3px dashed rgba(220, 38, 38, 0.2)'
                  }}
                />
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-4 mb-8">
              <h1
                className="text-2xl md:text-3xl font-bold"
                style={{ color: '#f1f5f9' }}
              >
                Kritik Sistem Hatası
              </h1>
              <p
                className="text-base md:text-lg leading-relaxed"
                style={{ color: 'rgba(241, 245, 249, 0.7)' }}
              >
                Uygulama beklenmeyen bir durumla karşılaştı.
                Lütfen sayfayı yenileyin veya ana sayfaya dönün.
              </p>

              {/* Error Code */}
              {error.digest && (
                <div
                  className="mt-4 px-4 py-2 rounded-lg inline-block"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.2)'
                  }}
                >
                  <p
                    className="text-xs font-mono"
                    style={{ color: 'rgba(248, 113, 113, 0.9)' }}
                  >
                    Hata Referansı: {error.digest}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => reset()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 w-full sm:w-auto"
                style={{
                  background: 'linear-gradient(135deg, #a68768 0%, #4a6382 100%)',
                  color: 'white',
                  transform: 'scale(1)',
                  boxShadow: '0 4px 15px rgba(166, 135, 104, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(166, 135, 104, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(166, 135, 104, 0.3)';
                }}
              >
                <RefreshCw style={{ width: '1.25rem', height: '1.25rem' }} />
                Uygulamayı Yenile
              </button>

              <a
                href="/"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 w-full sm:w-auto"
                style={{
                  backgroundColor: 'rgba(241, 245, 249, 0.1)',
                  color: '#f1f5f9',
                  border: '2px solid rgba(241, 245, 249, 0.2)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(241, 245, 249, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(241, 245, 249, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(241, 245, 249, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(241, 245, 249, 0.2)';
                }}
              >
                <Home style={{ width: '1.25rem', height: '1.25rem' }} />
                Ana Sayfaya Git
              </a>
            </div>

            {/* Help Text */}
            <p
              className="mt-8 text-sm"
              style={{ color: 'rgba(241, 245, 249, 0.5)' }}
            >
              Sorun devam ederse lütfen{' '}
              <a
                href="/contact"
                style={{
                  color: '#e3c39d',
                  textDecoration: 'underline'
                }}
              >
                destek ekibimizle
              </a>
              {' '}iletişime geçin.
            </p>
          </div>

          {/* Inline Styles */}
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.6; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.05); }
            }
            
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
            
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              min-height: 100vh;
            }
          `}</style>
        </div>
      </body>
    </html>
  );
}

