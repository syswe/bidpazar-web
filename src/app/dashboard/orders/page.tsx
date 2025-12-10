'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import Link from 'next/link';
import { Package, Send, CheckCircle, XCircle, Clock, ShoppingBag, Store, RefreshCw, ChevronDown } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  productId?: string;
  productTitle: string;
  productImage?: string;
  liveStreamProductId?: string;
  liveStreamId?: string;
  price: number;
  status: 'PENDING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
  type: 'BUY_NOW' | 'LIVE_STREAM_BID' | 'LIVE_STREAM_STOCK';
  createdAt: string;
  updatedAt: string;
  userRole: 'buyer' | 'seller';
  buyer: {
    id: string;
    username: string;
    name?: string;
  };
  seller: {
    id: string;
    username: string;
    name?: string;
  };
  otherParty: {
    id: string;
    username: string;
    name?: string;
  };
}

const statusConfig = {
  PENDING: {
    label: 'Sipariş Alındı',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  SHIPPING: {
    label: 'Kargoda',
    icon: Send,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  COMPLETED: {
    label: 'Tamamlandı',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  CANCELLED: {
    label: 'İptal Edildi',
    icon: XCircle,
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
};

const typeLabels: Record<string, string> = {
  BUY_NOW: 'Hemen Al',
  LIVE_STREAM_BID: 'Canlı Yayın Açık Artırma',
  LIVE_STREAM_STOCK: 'Canlı Yayın Satışı',
};

export default function Orders() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, activeTab, statusFilter]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authData = localStorage.getItem('auth');
      const token = authData ? JSON.parse(authData).token : null;

      if (!token) {
        setError('Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.');
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.set('role', activeTab);
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/orders?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Siparişler yüklenirken bir hata oluştu');
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Siparişler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);

      const authData = localStorage.getItem('auth');
      const token = authData ? JSON.parse(authData).token : null;

      if (!token) {
        setError('Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.');
        return;
      }

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Durum güncellenirken bir hata oluştu');
      }

      // Update local state
      setOrders(orders.map(order =>
        order.id === orderId
          ? { ...order, status: newStatus as Order['status'] }
          : order
      ));
    } catch (err: any) {
      console.error('Error updating order status:', err);
      setError(err.message || 'Durum güncellenirken bir hata oluştu.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredOrders = orders;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--foreground)] flex items-center gap-3">
              <Package className="h-8 w-8 text-[var(--accent)]" />
              Siparişlerim
            </h1>
            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
              Aldığınız ve sattığınız ürünlerin siparişlerini yönetin.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setActiveTab('buyer')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'buyer'
                ? 'bg-[var(--accent)] text-white shadow-md'
                : 'bg-[var(--secondary)]/30 text-[var(--foreground)] hover:bg-[var(--secondary)]/50'
                }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Aldığım Ürünler
            </button>
            <button
              onClick={() => setActiveTab('seller')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'seller'
                ? 'bg-[var(--accent)] text-white shadow-md'
                : 'bg-[var(--secondary)]/30 text-[var(--foreground)] hover:bg-[var(--secondary)]/50'
                }`}
            >
              <Store className="h-4 w-4" />
              Sattığım Ürünler
            </button>

            <div className="ml-auto flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm"
              >
                <option value="all">Tüm Durumlar</option>
                <option value="PENDING">Sipariş Alındı</option>
                <option value="SHIPPING">Kargoda</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="CANCELLED">İptal Edildi</option>
              </select>

              <button
                onClick={fetchOrders}
                className="p-2.5 rounded-lg bg-[var(--secondary)]/30 text-[var(--foreground)] hover:bg-[var(--secondary)]/50"
                title="Yenile"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md border border-red-200 dark:border-red-800">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-4 text-sm underline"
              >
                Kapat
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--foreground)] font-medium">Siparişleriniz yükleniyor...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="w-16 h-16 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === 'buyer' ? (
                  <ShoppingBag className="h-8 w-8 text-[var(--accent)]" />
                ) : (
                  <Store className="h-8 w-8 text-[var(--accent)]" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                {activeTab === 'buyer' ? 'Henüz satın aldığınız ürün bulunmuyor' : 'Henüz sattığınız ürün bulunmuyor'}
              </h3>
              <p className="text-[var(--foreground)] opacity-70 mb-6 max-w-md mx-auto">
                {activeTab === 'buyer'
                  ? 'Ürünlerimizi keşfedin ve ilk alışverişinizi yapın.'
                  : 'Ürünlerinizi satışa çıkarın ve siparişlerinizi buradan takip edin.'}
              </p>
              <button
                onClick={() => router.push('/products')}
                className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center"
              >
                <Package className="h-5 w-5 mr-2" />
                {activeTab === 'buyer' ? 'Alışverişe Başla' : 'Ürün Ekle'}
              </button>
            </div>
          ) : (
            <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)]">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Ürün
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        {activeTab === 'buyer' ? 'Satıcı' : 'Alıcı'}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Tutar
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Tarih
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Durum
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--background)] divide-y divide-[var(--border)]">
                    {filteredOrders.map((order) => {
                      const StatusIcon = statusConfig[order.status].icon;
                      return (
                        <tr key={order.id} className="hover:bg-[var(--muted)]">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                                {order.productImage ? (
                                  <Image
                                    src={order.productImage}
                                    alt={order.productTitle}
                                    width={48}
                                    height={48}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-[var(--muted-foreground)]">
                                    <Package className="h-6 w-6" />
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-[var(--foreground)]">
                                  {order.productTitle}
                                </div>
                                <div className="text-xs text-[var(--muted-foreground)]">
                                  {typeLabels[order.type]} • {order.orderNumber}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-[var(--foreground)]">
                              {order.otherParty.name || order.otherParty.username}
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)]">
                              @{order.otherParty.username}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">
                            {order.price.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {activeTab === 'seller' ? (
                              <div className="relative">
                                <select
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                  disabled={updatingOrderId === order.id}
                                  className={`appearance-none pl-8 pr-8 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${statusConfig[order.status].color} ${updatingOrderId === order.id ? 'opacity-50 cursor-wait' : ''
                                    }`}
                                >
                                  <option value="PENDING">Sipariş Alındı</option>
                                  <option value="SHIPPING">Kargoda</option>
                                  <option value="COMPLETED">Tamamlandı</option>
                                  <option value="CANCELLED">İptal Edildi</option>
                                </select>
                                <StatusIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
                              </div>
                            ) : (
                              <span className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full ${statusConfig[order.status].color}`}>
                                <StatusIcon className="h-4 w-4" />
                                {statusConfig[order.status].label}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViewOrderDetails(order)}
                                className="text-[var(--accent)] hover:underline"
                              >
                                Detaylar
                              </button>
                              {order.productId && (
                                <Link
                                  href={`/products/${order.productId}`}
                                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                >
                                  Ürüne Git
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Geri Dön
            </button>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              aria-hidden="true"
              onClick={() => setShowOrderDetails(false)}
            ></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[var(--background)] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-[var(--background)] px-6 pt-6 pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]" id="modal-title">
                      Sipariş Detayları
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)]">{selectedOrder.orderNumber}</p>
                  </div>
                  <span className={`px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full ${statusConfig[selectedOrder.status].color}`}>
                    {React.createElement(statusConfig[selectedOrder.status].icon, { className: 'h-4 w-4' })}
                    {statusConfig[selectedOrder.status].label}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Product */}
                  <div className="flex items-start gap-4 p-4 bg-[var(--muted)]/50 rounded-lg">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                      {selectedOrder.productImage ? (
                        <Image
                          src={selectedOrder.productImage}
                          alt={selectedOrder.productTitle}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[var(--muted-foreground)]">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-[var(--foreground)]">{selectedOrder.productTitle}</h4>
                      <p className="text-sm text-[var(--muted-foreground)]">{typeLabels[selectedOrder.type]}</p>
                      <p className="text-lg font-semibold text-[var(--accent)] mt-1">
                        {selectedOrder.price.toLocaleString('tr-TR')} ₺
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--muted-foreground)]">Satıcı</p>
                      <p className="font-medium text-[var(--foreground)]">
                        {selectedOrder.seller.name || selectedOrder.seller.username}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted-foreground)]">Alıcı</p>
                      <p className="font-medium text-[var(--foreground)]">
                        {selectedOrder.buyer.name || selectedOrder.buyer.username}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted-foreground)]">Sipariş Tarihi</p>
                      <p className="font-medium text-[var(--foreground)]">
                        {formatDate(selectedOrder.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted-foreground)]">Son Güncelleme</p>
                      <p className="font-medium text-[var(--foreground)]">
                        {formatDate(selectedOrder.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--muted)]/30 px-6 py-4 flex justify-end gap-3">
                {selectedOrder.productId && (
                  <Link
                    href={`/products/${selectedOrder.productId}`}
                    className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--secondary)]/50"
                  >
                    Ürüne Git
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowOrderDetails(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-lg hover:opacity-90"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}