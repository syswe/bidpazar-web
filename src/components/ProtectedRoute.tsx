'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, refreshAuthState } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (!isLoading && !isLoggedIn) {
        // Try refreshing the token before redirecting
        try {
          await refreshAuthState();
          // If still not logged in after refresh, redirect
          if (!isLoggedIn) {
            router.push('/sign-in?redirect=' + window.location.pathname);
          }
        } catch (error) {
          console.error('Authentication check failed:', error);
          router.push('/sign-in?redirect=' + window.location.pathname);
        }
      }
    };
    
    checkAuth();
  }, [isLoggedIn, isLoading, router, refreshAuthState]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="inline-block w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[var(--foreground)] font-medium">Yükleniyor...</p>
      </div>
    );
  }

  return isLoggedIn ? <>{children}</> : null;
} 