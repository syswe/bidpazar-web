'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { getAuth, validateToken } from '@/lib/auth';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [adminVerified, setAdminVerified] = useState(false);

  // First useEffect to handle the initial check and debug logging
  useEffect(() => {
    const { user: storedUser } = getAuth();
    console.log('AdminLayout initial state:', { 
      isAuthenticated, 
      isLoading, 
      user,
      storedUser,
      'user?.isAdmin': user?.isAdmin,
      'storedUser?.isAdmin': storedUser?.isAdmin
    });
  }, [isAuthenticated, isLoading, user]);

  // Second useEffect to verify admin status with server
  useEffect(() => {
    // Only proceed if we're not loading and the user appears to be authenticated
    if (!isLoading && isAuthenticated && user) {
      setIsVerifying(true);
      
      // If user object shows admin status, we can validate that
      if (user.isAdmin) {
        setAdminVerified(true);
        setIsVerifying(false);
        return;
      }
      
      // Double-check with server if the admin status is missing or false
      const verifyAdmin = async () => {
        try {
          const validatedUser = await validateToken();
          console.log('Server validated user:', validatedUser);
          
          if (validatedUser?.isAdmin) {
            setAdminVerified(true);
          } else {
            console.log('User is not admin according to server validation');
            // Delay redirect slightly to avoid immediate jumps
            setTimeout(() => {
              router.push('/dashboard');
            }, 100);
          }
        } catch (error) {
          console.error('Error validating token:', error);
        } finally {
          setIsVerifying(false);
        }
      };
      
      verifyAdmin();
    } else if (!isLoading && !isAuthenticated) {
      // Only redirect if we're definitely not authenticated
      console.log('Not authenticated, redirecting to sign-in');
      router.push('/sign-in?redirect=/admin');
    }
  }, [isAuthenticated, isLoading, router, user]);

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
    console.log('AdminLayout access denied:', {
      isAuthenticated,
      adminVerified,
      'user?.isAdmin': user?.isAdmin
    });
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