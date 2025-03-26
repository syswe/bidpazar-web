'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { getProducts, getCategories, getAllUsers, getLiveStreams } from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    users: 0,
    streams: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    fetchStats();
  }, []);

  return (
    <AdminLayout title="Dashboard">
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