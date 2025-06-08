'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

interface SellerAccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function SellerAccessGuard({ children, fallback }: SellerAccessGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Giriş Gerekli</h1>
          <p className="text-[var(--foreground)] opacity-70 mb-6">
            Bu sayfaya erişmek için giriş yapmanız gerekmektedir.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all"
          >
            Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  if (user.userType !== 'SELLER') {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Satıcı Erişimi Gerekli</h1>
          <p className="text-[var(--foreground)] opacity-70 mb-6">
            Bu özelliği kullanabilmek için satıcı hesabınızın olması gerekmektedir. 
            Satıcı olmak için başvuru yapabilirsiniz.
          </p>
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all"
            >
              Satıcı Başvurusu Yap
            </Link>
            <Link
              href="/dashboard"
              className="block w-full px-6 py-3 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-all"
            >
              Dashboard'a Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 