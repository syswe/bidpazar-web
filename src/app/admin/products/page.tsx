'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Product, getProducts, deleteProduct } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Ürünler yüklenirken hata:', err);
      setError('Ürünler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (actionInProgress) return;

    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      setActionInProgress(productId);
      await deleteProduct(productId);
      // Ürün listesini güncelle
      setProducts(products.filter(product => product.id !== productId));
    } catch (err) {
      console.error('Ürün silme işlemi başarısız:', err);
      alert('Ürün silme işlemi başarısız oldu.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleFeatured = async (productId: string, currentStatus: boolean) => {
    if (actionInProgress) return;

    try {
      setActionInProgress(productId);
      const response = await fetch(`/api/admin/products/${productId}/feature`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFeatured: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update featured status');
      }

      // Update the product in state
      setProducts(products.map(product =>
        product.id === productId
          ? { ...product, isFeatured: !currentStatus }
          : product
      ));
    } catch (err) {
      console.error('Öne çıkarma durumu güncellenirken hata:', err);
      alert('Öne çıkarma durumu güncellenirken bir hata oluştu.');
    } finally {
      setActionInProgress(null);
    }
  };

  const viewProduct = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  const editProduct = (productId: string) => {
    router.push(`/products/${productId}/edit`);
  };

  return (
    <AdminLayout title="Ürünler">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 p-4 rounded-lg">
          {error}
          <button
            onClick={fetchProducts}
            className="ml-4 bg-red-100 dark:bg-red-800 px-3 py-1 rounded-md text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Ürün Listesi
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Toplam {products.length} ürün bulunuyor.
              </p>
            </div>
            <Link
              href="/products/create"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Yeni Ürün Ekle
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ürün
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Satıcı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Fiyat
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Öne Çıkarıldı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Henüz ürün bulunmuyor
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {product.images && product.images.length > 0 ? (
                                <img
                                  className="h-10 w-10 rounded-md object-cover"
                                  src={product.images[0].url}
                                  alt={product.title}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                  <svg
                                    className="h-6 w-6 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {product.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {product.description.length > 50
                                  ? `${product.description.slice(0, 50)}...`
                                  : product.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {product.user?.name || product.user?.username || 'Bilinmeyen Kullanıcı'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {product.category?.name || 'Kategorisiz'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(product.price)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleToggleFeatured(product.id, (product as any).isFeatured || false)}
                            disabled={actionInProgress === product.id}
                            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${(product as any).isFeatured
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              } ${actionInProgress === product.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {(product as any).isFeatured ? '⭐ Öne Çıkarıldı' : 'Öne Çıkar'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => viewProduct(product.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Görüntüle
                            </button>
                            <button
                              onClick={() => editProduct(product.id)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              disabled={actionInProgress === product.id}
                              className={`text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ${actionInProgress === product.id ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
} 