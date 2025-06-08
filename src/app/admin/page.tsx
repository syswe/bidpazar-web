'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { getProducts, getCategories, getAllUsers, getLiveStreams } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { validateToken } from '@/lib/frontend-auth';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    users: 0,
    streams: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatedUser, setValidatedUser] = useState<any>(null);
  const [validationAttempts, setValidationAttempts] = useState(0);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [pageAccessTime] = useState(new Date().toString());

  // Immediate check on render to prevent unwanted redirects
  useEffect(() => {
    console.log("Admin Dashboard - Page accessed at:", pageAccessTime);
    console.log("Admin Dashboard - Initial auth state:", { 
      isAuthenticated, 
      authLoading, 
      user, 
      isAdmin: user?.isAdmin 
    });

    // Simple initial check to prevent unwanted redirects
    if (!authLoading && !isAuthenticated) {
      console.log("Admin Dashboard - Not authenticated, redirecting to login");
      router.push('/sign-in?redirect=/admin');
      return;
    }
    
    // If authenticated but not admin, redirect
    if (!authLoading && isAuthenticated && user && !user.isAdmin) {
      console.log("Admin Dashboard - User authenticated but not admin, redirecting");
      router.push('/dashboard');
      return;
    }
  }, [isAuthenticated, authLoading, user, router, pageAccessTime]);

  // Perform direct token validation to show detailed auth state
  useEffect(() => {
    // Debug log for troubleshooting
    console.log("Admin Dashboard - Auth state check:", { 
      isAuthenticated, 
      authLoading, 
      user, 
      isAdmin: user?.isAdmin,
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    });
    
    // Skip validation if check is complete or validation attempts are too high
    if (authCheckComplete || validationAttempts > 3) {
      return;
    }
    
    // Additional debug: Directly validate token to see what the backend returns
    if (isAuthenticated && !authLoading) {
      // Track validation attempts but don't add to dependency array
      setValidationAttempts(prev => prev + 1);
      console.log(`Admin Dashboard - Validating token attempt #${validationAttempts + 1}`);
      
      validateToken(true) // Force validation by passing true
        .then(response => {
          console.log("Direct validateToken response:", response);
          setValidatedUser(response);
          
          // If backend says not admin, redirect
          if (response && !response.isAdmin) {
            console.log("Admin Dashboard - Backend says user is not admin, redirecting");
            router.push('/dashboard');
            return;
          }
          
          setAuthCheckComplete(true);
        })
        .catch(err => {
          console.error("Direct validateToken error:", err);
          setAuthCheckComplete(true);
        });
    } else if (!authLoading) {
      setAuthCheckComplete(true);
    }
  }, [isAuthenticated, authLoading, user, router, authCheckComplete]);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [products, categories, users, streams] = await Promise.all([
          getProducts(),
          getCategories(),
          getAllUsers(),
          getLiveStreams(),
        ]);

        setStats({
          products: products.length,
          categories: categories.length,
          users: users.length,
          streams: streams.length,
        });
      } catch (err) {
        console.error('İstatistikler yüklenirken hata:', err);
        setError('İstatistikler yüklenirken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };

    if (authCheckComplete && isAuthenticated && user?.isAdmin) {
      fetchStats();
    }
  }, [authCheckComplete, isAuthenticated, user]);

  // Add debug helper function
  useEffect(() => {
    (window as any).checkAdminDashboardState = () => {
      // Print JWT token from localStorage for debugging
      const authData = localStorage.getItem('auth');
      const token = authData ? JSON.parse(authData).token : null;
      const tokenPreview = token ? `${token.slice(0, 15)}...${token.slice(-10)}` : 'no token';
      
      console.log('Admin Dashboard State:', {
        authLoading,
        isAuthenticated,
        user: user ? { 
          id: user.id, 
          username: user.username, 
          isAdmin: user.isAdmin 
        } : null,
        validatedUser: validatedUser ? {
          id: validatedUser.id,
          username: validatedUser.username,
          isAdmin: validatedUser.isAdmin
        } : null,
        validationAttempts,
        authCheckComplete,
        token: tokenPreview,
        localStorage: Boolean(authData),
        location: typeof window !== 'undefined' ? window.location.href : 'unknown',
        history: typeof window !== 'undefined' ? window.history.length : 'unknown'
      });
    };
    
    // Auto-run debug check
    setTimeout(() => {
      (window as any).checkAdminDashboardState?.();
    }, 500);
    
    return () => {
      (window as any).checkAdminDashboardState = undefined;
    };
  }, [authLoading, isAuthenticated, user, validatedUser, validationAttempts, authCheckComplete]);

  // Reset validation state function
  const resetValidationState = () => {
    if (confirm('Reset validation state? This will reset counters but not log you out.')) {
      setValidationAttempts(0);
      setAuthCheckComplete(false);
      console.log("Validation state reset - will attempt validation again");
    }
  };

  // Simple fallback render during initial load
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Yükleniyor...</p>
          <p className="text-sm text-gray-500 mt-2">Admin paneli için doğrulama yapılıyor...</p>
        </div>
      </div>
    );
  }

  // Direct rendering for authenticated admin before layout wrapper
  if (!isAuthenticated || (user && !user.isAdmin)) {
    console.log("Admin Dashboard - Not rendering due to missing credentials:", {
      isAuthenticated,
      isAdmin: user?.isAdmin
    });
    return null; // Don't render anything, redirection should have been triggered
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-8 p-4 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">
          <h3 className="font-bold mb-2">Auth Debug Info:</h3>
          <div>
            <p><strong>Page Accessed:</strong> {pageAccessTime}</p>
            <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'unknown'}</p>
            <p><strong>Auth Loading:</strong> {authLoading ? 'Yes' : 'No'}</p>
            <p><strong>Auth Check Complete:</strong> {authCheckComplete ? 'Yes' : 'No'}</p>
            <p><strong>isAuthenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>isAdmin (from context):</strong> {user?.isAdmin ? 'Yes' : 'No'}</p>
            <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
            <p><strong>Username:</strong> {user?.username || 'Not logged in'}</p>
            <p><strong>Validation Attempts:</strong> <span className={validationAttempts > 5 ? 'text-red-500 font-bold' : ''}>{validationAttempts}</span> {validationAttempts > 5 && '⚠️'}</p>
            {validatedUser && (
              <>
                <p><strong>Validated isAdmin:</strong> {validatedUser?.isAdmin ? 'Yes' : 'No'}</p>
                <p><strong>Validated Username:</strong> {validatedUser?.username || 'N/A'}</p>
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button 
                onClick={() => (window as any).checkAdminDashboardState?.()} 
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Log Debug Info
              </button>
              <button 
                onClick={() => (window as any).debugAdminAuth?.()} 
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Debug Auth
              </button>
              <button 
                onClick={() => validateToken(true).then(user => console.log('Token validation:', user))} 
                className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Validate Token
              </button>
              <button 
                onClick={resetValidationState} 
                className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Reset Validation
              </button>
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to reset auth?')) {
                    localStorage.removeItem('auth');
                    window.location.href = '/sign-in?redirect=/admin';
                  }
                }} 
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 col-span-2"
              >
                Reset Auth (Logout)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading state
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </>
        ) : error ? (
          // Error state
          <div className="col-span-4 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 p-4 rounded-lg">
            {error}
          </div>
        ) : (
          // Data loaded
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">Toplam Ürün</h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.products}</p>
              <div className="mt-4">
                <a
                  href="/admin/products"
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                >
                  Tüm ürünleri görüntüle →
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">Toplam Kategori</h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.categories}</p>
              <div className="mt-4">
                <a
                  href="/admin/categories"
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                >
                  Tüm kategorileri görüntüle →
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">Toplam Kullanıcı</h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.users}</p>
              <div className="mt-4">
                <a
                  href="/admin/users"
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                >
                  Tüm kullanıcıları görüntüle →
                </a>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">Toplam Canlı Yayın</h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.streams}</p>
              <div className="mt-4">
                <a
                  href="/admin/streams"
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                >
                  Tüm canlı yayınları görüntüle →
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
} 