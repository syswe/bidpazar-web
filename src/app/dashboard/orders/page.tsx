'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    imageUrl: string;
  }[];
}

export default function Orders() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // Load orders when component mounts
  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real implementation, this would fetch from your API
      // This is just a placeholder
      const mockOrders: Order[] = [
        {
          id: '1',
          orderNumber: 'BP-2023-001',
          date: '2023-09-15',
          total: 1250.00,
          status: 'Tamamlandı',
          items: [
            {
              id: '101',
              name: 'Antika Gümüş Kolye',
              quantity: 1,
              price: 750.00,
              imageUrl: 'https://via.placeholder.com/150'
            },
            {
              id: '102',
              name: 'El Yapımı Seramik Tabak',
              quantity: 2,
              price: 250.00,
              imageUrl: 'https://via.placeholder.com/150'
            }
          ]
        },
        {
          id: '2',
          orderNumber: 'BP-2023-002',
          date: '2023-10-20',
          total: 3500.00,
          status: 'Kargoda',
          items: [
            {
              id: '103',
              name: 'Vintage Masa Saati',
              quantity: 1,
              price: 3500.00,
              imageUrl: 'https://via.placeholder.com/150'
            }
          ]
        }
      ];
      
      // Simulate API call
      setTimeout(() => {
        setOrders(mockOrders);
        setIsLoading(false);
      }, 500);
      
    } catch (error: any) {
      setError('Siparişler yüklenirken bir hata oluştu.');
      setIsLoading(false);
    }
  };

  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Tamamlandı':
        return 'bg-green-100 text-green-800';
      case 'Kargoda':
        return 'bg-blue-100 text-blue-800';
      case 'Beklemede':
        return 'bg-yellow-100 text-yellow-800';
      case 'İptal Edildi':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Siparişlerim</h1>
            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
              Geçmiş siparişlerinizi ve durumlarını görüntüleyin.
            </p>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="inline-block w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--foreground)] font-medium">Siparişleriniz yükleniyor...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="w-16 h-16 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Henüz siparişiniz bulunmuyor</h3>
              <p className="text-[var(--foreground)] opacity-70 mb-6 max-w-md mx-auto">
                Ürünlerimizi keşfedin ve ilk siparişinizi oluşturun.
              </p>
              <button
                onClick={() => router.push('/products')}
                className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
                Alışverişe Başla
              </button>
            </div>
          ) : (
            <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-[var(--border)]">
                <thead className="bg-[var(--muted)]">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                      Sipariş No
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                      Tarih
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                      Tutar
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
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-[var(--muted)]">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                        {new Date(order.date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                        {order.total.toLocaleString('tr-TR')} ₺
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                        <button
                          onClick={() => handleViewOrderDetails(order)}
                          className="text-[var(--accent)] hover:text-[var(--accent)] hover:underline"
                        >
                          Detaylar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[var(--background)] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
              <div className="bg-[var(--background)] px-4 pt-5 pb-4 sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg leading-6 font-medium text-[var(--foreground)]" id="modal-title">
                        Sipariş Detayları - {selectedOrder.orderNumber}
                      </h3>
                      <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    
                    <div className="mb-4 flex justify-between text-sm">
                      <span className="text-[var(--foreground)] opacity-70">Sipariş Tarihi:</span>
                      <span className="text-[var(--foreground)]">{new Date(selectedOrder.date).toLocaleDateString('tr-TR')}</span>
                    </div>
                    
                    <div className="border-t border-[var(--border)] py-4">
                      <h4 className="font-medium text-[var(--foreground)] mb-3">Ürünler</h4>
                      <div className="space-y-3">
                        {selectedOrder.items.map(item => (
                          <div key={item.id} className="flex items-center py-2">
                            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                width={64}
                                height={64}
                                className="h-full w-full object-cover object-center"
                                unoptimized={true}
                              />
                            </div>
                            <div className="ml-4 flex-1">
                              <h5 className="text-sm font-medium text-[var(--foreground)]">{item.name}</h5>
                              <div className="flex justify-between text-sm mt-1">
                                <span className="text-[var(--foreground)] opacity-70">
                                  {item.quantity} x {item.price.toLocaleString('tr-TR')} ₺
                                </span>
                                <span className="font-medium text-[var(--foreground)]">
                                  {(item.quantity * item.price).toLocaleString('tr-TR')} ₺
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border-t border-[var(--border)] py-4">
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--foreground)]">Toplam Tutar</span>
                        <span className="text-[var(--accent)]">{selectedOrder.total.toLocaleString('tr-TR')} ₺</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--background)] px-4 py-3 sm:px-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowOrderDetails(false)}
                  className="inline-flex justify-center rounded-md border border-[var(--border)] shadow-sm px-4 py-2 bg-[var(--background)] text-base font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--border)] sm:text-sm"
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