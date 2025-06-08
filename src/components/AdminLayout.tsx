'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { validateToken } from '@/lib/frontend-auth';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [adminVerified, setAdminVerified] = useState(false);

  // Track if we've attempted verification to prevent loops
  const [verificationAttempted, setVerificationAttempted] = useState(false);

  // Verify admin status when authentication state changes
  useEffect(() => {
    // Skip verification while still loading auth state
    if (isLoading) {
      setIsVerifying(true);
      return;
    }

    console.log('Admin verification - Auth state:', { 
      isAuthenticated, 
      isLoading, 
      user, 
      isAdmin: user?.isAdmin 
    });

    // If not authenticated, redirect to sign-in
    if (!isAuthenticated) {
      console.log('Admin verification - Not authenticated, redirecting to sign-in');
      router.push('/sign-in?redirect=/admin');
      return;
    }

    // If we've already verified admin status (positive result), don't re-verify
    if (adminVerified) {
      console.log('Admin verification - Already verified as admin');
      setIsVerifying(false);
      return;
    }

    // If we've already attempted verification but failed, don't keep trying
    if (verificationAttempted && !adminVerified) {
      console.log('Admin verification - Previously failed, redirecting');
      router.push('/dashboard');
      return;
    }

    // Verify admin status based on user object from context
    if (user) {
      if (user.isAdmin) {
        // User is admin according to context, double-check with backend
        console.log('Admin verification - Context says user is admin, checking with backend');
        setIsVerifying(true);
        
        // Add timestamp to prevent cache
        const timestamp = new Date().getTime();
        
        validateToken()
          .then(validatedUser => {
            // If validateToken returns null (network error) but user context shows admin,
            // trust the client-side state (more graceful offline behavior)
            if (!validatedUser && user.isAdmin) {
              console.log('Admin verification - Backend validation failed but using local admin state');
              setAdminVerified(true);
              setIsVerifying(false);
              return;
            }
            
            console.log('Admin verification - Backend response:', validatedUser);
            if (validatedUser?.isAdmin) {
              console.log('Admin verification - Backend confirmed admin status');
              setAdminVerified(true);
            } else {
              // Backend says not admin, redirect
              console.log('Admin verification - Backend denied admin status, redirecting');
              console.log('Admin verification - Expected true, but got:', validatedUser?.isAdmin);
              
              // If the backend returned a valid user but without admin privileges,
              // this means the user may have lost admin privileges since login
              if (validatedUser) {
                router.push('/dashboard');
              } else {
                // If the backend didn't return a valid user at all, 
                // this may indicate an authentication issue
                router.push('/sign-in?redirect=/admin');
              }
            }
          })
          .catch((error) => {
            // Validation failed, but don't immediately redirect
            console.error('Admin verification - Backend validation failed:', error);
            
            // Give a 2nd chance if user is admin in context - better UX for network issues
            if (user.isAdmin) {
              console.log('Admin verification - Using local admin status after backend error');
              setAdminVerified(true);
            } else {
              router.push('/sign-in?redirect=/admin');
            }
          })
          .finally(() => {
            setIsVerifying(false);
            setVerificationAttempted(true);
          });
      } else {
        // User is definitely not admin, redirect
        console.log('Admin verification - Context says user is not admin, redirecting');
        router.push('/dashboard');
        setVerificationAttempted(true);
      }
    } else {
      // Should not happen if isAuthenticated is true
      console.log('Admin verification - No user object despite being authenticated, redirecting');
      router.push('/sign-in?redirect=/admin');
      setVerificationAttempted(true);
    }
  }, [isAuthenticated, isLoading, user, router, adminVerified, verificationAttempted]);
  
  // Add a manual reset function
  useEffect(() => {
    // Add a global function to force reset login state in case of issues
    // This can be called from browser console for debugging
    (window as any).resetAdminAuth = () => {
      console.log('Manual reset of auth state requested');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth');
        window.location.href = '/sign-in?redirect=/admin';
      }
    };
    
    // Add a debug function to check admin state
    (window as any).debugAdminAuth = () => {
      const authData = localStorage.getItem('auth');
      const token = authData ? JSON.parse(authData).token : null;
      console.log('Current auth state:', {
        token: token ? `${token.substring(0, 10)}...` : null,
        user,
        isAuthenticated,
        isAdmin: user?.isAdmin,
        adminVerified,
        verificationAttempted
      });
    };
    
    return () => {
      // Clean up when component unmounts
      (window as any).resetAdminAuth = undefined;
      (window as any).debugAdminAuth = undefined;
    };
  }, [isAuthenticated, user, adminVerified, verificationAttempted]);

  // Show loading state if still loading or verifying
  if (isLoading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            {isVerifying ? 'Verifying admin privileges...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // If not admin, don't render anything (should have been redirected)
  if (!isAuthenticated || !adminVerified) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">BidPazar Admin</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                <Link
                  href="/admin"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Dashboard
                </Link>
                <Link
                  href="/admin/users"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  Kullanıcılar
                </Link>
                <Link
                  href="/admin/products"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  Ürünler
                </Link>
                <Link
                  href="/admin/categories"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Kategoriler
                </Link>
                <Link
                  href="/admin/streams"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Canlı Yayınlar
                </Link>
                <Link
                  href="/admin/seller-requests"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Satıcı Başvuruları
                </Link>
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href="/"
                    className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg
                      className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      />
                    </svg>
                    Siteye Dön
                  </Link>
                </div>
              </nav>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top header */}
          <header className="bg-white dark:bg-gray-800 shadow">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                    {user?.name || user?.username}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                    Admin
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
} 