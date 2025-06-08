'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';
import Link from 'next/link';
import { getUserWonAuctions, WonAuction } from '@/lib/api';

export default function WonAuctions() {
  const { user } = useAuth();
  const router = useRouter();
  const [wonAuctions, setWonAuctions] = useState<WonAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<WonAuction | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load won auctions when component mounts
  useEffect(() => {
    if (user) {
      fetchWonAuctions();
    }
  }, [user]);

  const fetchWonAuctions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch real data from API
      const auctions = await getUserWonAuctions();
      setWonAuctions(auctions);
      
    } catch (error: any) {
      setError(error.message || 'Kazanılan ihaleler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (auction: WonAuction) => {
    setSelectedAuction(auction);
    setShowDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Tamamlandı':
        return 'bg-green-100 text-green-800';
      case 'İşleniyor':
        return 'bg-blue-100 text-blue-800';
      case 'Beklemede':
        return 'bg-yellow-100 text-yellow-800';
      case 'İptal Edildi':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleProceedToPayment = (auction: WonAuction) => {
    // Redirect to payment page based on auction type
    if (auction.isLiveStream) {
      router.push(`/checkout/listing/${auction.auctionId}`);
    } else {
      router.push(`/checkout/auction/${auction.auctionId}`);
    }
  };

  const handleContactSeller = (auction: WonAuction) => {
    // Redirect to messaging page
    router.push(`/messages/new?recipient=${auction.seller.username}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--foreground)]">Kazandığım Açık Arttırmalar</h1>
            <p className="mt-2 text-sm text-[var(--foreground)] opacity-70">
              Açık artırmalarda kazandığınız ürünleri ve durumlarını görüntüleyin.
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
              <p className="text-[var(--foreground)] font-medium">Kazandığınız ihaleler yükleniyor...</p>
            </div>
          ) : wonAuctions.length === 0 ? (
            <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
              <div className="w-16 h-16 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Henüz kazandığınız ihale bulunmuyor</h3>
              <p className="text-[var(--foreground)] opacity-70 mb-6 max-w-md mx-auto">
                Açık artırmalara katılarak koleksiyonunuza eşsiz parçalar ekleyebilirsiniz.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/auctions"
                  className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Açık Artırmalara Göz At
                </Link>
                <Link
                  href="/livestreams"
                  className="px-6 py-3 bg-[var(--background)] border border-[var(--accent)] text-[var(--accent)] rounded-lg hover:shadow-lg transition-all inline-flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Canlı Yayınlara Katıl
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {wonAuctions.map((auction) => (
                <div key={auction.id} className="bg-[var(--background)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start lg:items-center flex-col lg:flex-row">
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                        <Image
                          src={auction.productImage}
                          alt={auction.productName}
                          width={96}
                          height={96}
                          className="h-full w-full object-cover object-center"
                          unoptimized={true}
                        />
                      </div>
                      
                      <div className="flex-1 mt-4 lg:mt-0 lg:ml-6">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-3">
                          <h3 className="text-lg font-medium text-[var(--foreground)]">
                            {auction.productName}
                          </h3>
                          <div className="flex items-center gap-2 mt-2 lg:mt-0">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(auction.status)}`}>
                              {auction.status}
                            </span>
                            {auction.isLiveStream && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                Canlı Yayın
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-1 text-sm text-[var(--foreground)] opacity-80 mb-3">
                          <p>Kazanılan Tarih: {formatDate(auction.winDate)}</p>
                          <p>Satıcı: {auction.seller.name} (@{auction.seller.username})</p>
                          <p className="font-medium text-[var(--accent)]">
                            Kazanılan Teklif: {auction.winningBid.toLocaleString('tr-TR')} ₺
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            onClick={() => handleViewDetails(auction)}
                            className="px-3 py-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                          >
                            Detaylar
                          </button>
                          
                          {!auction.isPaid && (
                            <button
                              onClick={() => handleProceedToPayment(auction)}
                              className="px-3 py-1 bg-[var(--accent)] text-white rounded-md hover:opacity-90 transition-colors text-sm"
                            >
                              Ödeme Yap
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleContactSeller(auction)}
                            className="px-3 py-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                          >
                            Satıcı ile İletişime Geç
                          </button>
                          
                          {auction.isLiveStream && (
                            <Link
                              href={`/livestreams/${auction.streamId}`}
                              className="px-3 py-1 bg-red-500 text-white rounded-md hover:opacity-90 transition-colors text-sm"
                            >
                              Yayını Görüntüle
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
      
      {/* Auction Details Modal */}
      {showDetails && selectedAuction && (
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
                        İhale Detayları
                      </h3>
                      <div className="flex space-x-2">
                        <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedAuction.status)}`}>
                          {selectedAuction.status}
                        </span>
                        {selectedAuction.isLiveStream && (
                          <span className="px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Canlı Yayın
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center mb-6">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                        <Image
                          src={selectedAuction.productImage}
                          alt={selectedAuction.productName}
                          width={80}
                          height={80}
                          className="h-full w-full object-cover object-center"
                          unoptimized={true}
                        />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-base font-medium text-[var(--foreground)]">{selectedAuction.productName}</h4>
                        <p className="text-sm text-[var(--foreground)] opacity-70">Ürün ID: {selectedAuction.productId}</p>
                      </div>
                    </div>
                    
                    <div className="border-t border-[var(--border)] py-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--foreground)] opacity-70">İhale ID:</span>
                        <span className="text-[var(--foreground)]">{selectedAuction.auctionId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--foreground)] opacity-70">Kazanılan Tarih:</span>
                        <span className="text-[var(--foreground)]">{formatDate(selectedAuction.winDate)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--foreground)] opacity-70">İhale Tipi:</span>
                        <span className="text-[var(--foreground)]">
                          {selectedAuction.isLiveStream ? 'Canlı Yayın' : 'Standart Açık Artırma'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--foreground)] opacity-70">Satıcı:</span>
                        <span className="text-[var(--foreground)]">{selectedAuction.seller.name} (@{selectedAuction.seller.username})</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--foreground)] opacity-70">Ödeme Durumu:</span>
                        <span className={`${selectedAuction.isPaid ? 'text-green-500' : 'text-yellow-500'}`}>
                          {selectedAuction.isPaid ? 'Ödendi' : 'Ödenmedi'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="border-t border-[var(--border)] py-4">
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--foreground)]">Kazanılan Teklif</span>
                        <span className="text-[var(--accent)]">{selectedAuction.winningBid.toLocaleString('tr-TR')} ₺</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-[var(--border)] pt-4 mt-4">
                      <p className="text-xs text-[var(--foreground)] opacity-70 mb-2">
                        Not: Satın aldığınız ürün ile ilgili tüm soru ve sorunlarınız için satıcı ile iletişime geçebilirsiniz.
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        {!selectedAuction.isPaid && (
                          <button
                            onClick={() => {
                              handleProceedToPayment(selectedAuction);
                              setShowDetails(false);
                            }}
                            className="px-3 py-1 bg-[var(--accent)] text-white rounded-md hover:opacity-90 transition-colors text-sm"
                          >
                            Ödeme Yap
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            handleContactSeller(selectedAuction);
                            setShowDetails(false);
                          }}
                          className="px-3 py-1 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                        >
                          Satıcı ile İletişime Geç
                        </button>
                        
                        {selectedAuction.isLiveStream && selectedAuction.streamId && (
                          <Link
                            href={`/livestreams/${selectedAuction.streamId}`}
                            onClick={() => setShowDetails(false)}
                            className="px-3 py-1 bg-red-500 text-white rounded-md hover:opacity-90 transition-colors text-sm"
                          >
                            Yayını Görüntüle
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--background)] px-4 py-3 sm:px-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
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