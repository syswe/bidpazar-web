'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Product, getUserProducts } from '@/lib/api';
import { resendVerificationCode, verifyCode } from '@/lib/frontend-auth';
import SellerRequestSection from '@/components/SellerRequestSection';
import VerifiedSellerBadge from '@/components/VerifiedSellerBadge';

export default function Dashboard() {
  const { user, logout, refreshAuthState } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // SMS verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    async function fetchUserProducts() {
      if (!user) return;

      try {
        setIsLoading(true);
        // Use the API function which now calls the Next.js route via fetcher
        const data = await getUserProducts();
        setProducts(data);
        setError(null); // Clear any previous errors on success
      } catch (err: any) {
        console.error('Ürünler yüklenirken hata oluştu:', err);
        
        // Only show a generic error message to the user
        // The actual token refresh logic is now handled in getUserProducts
        setError('Ürünleriniz yüklenirken bir hata oluştu. Lütfen sayfayı yenileyiniz.');
        
        // If products array is empty, show some suggestions to the user
        if (products.length === 0) {
          setProducts([]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserProducts();
  }, [user]);

  // Function to trigger SMS verification
  const handleSendVerificationCode = async () => {
    if (!user?.id) return;
    
    try {
      setIsSendingSms(true);
      setVerificationError(null);
      const response = await resendVerificationCode(user.id);
      
      if (response.smsSent) {
        setShowVerificationModal(true);
        setVerificationSuccess('Doğrulama kodu telefonunuza gönderildi.');
      } else {
        setVerificationError('SMS gönderilemedi. Lütfen daha sonra tekrar deneyin.');
      }
    } catch (error: any) {
      setVerificationError(error.message || 'SMS gönderilirken bir hata oluştu.');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Function to verify SMS code
  const handleVerifyCode = async () => {
    if (!user?.id || !verificationCode) return;
    
    try {
      setIsVerifying(true);
      setVerificationError(null);
      const response = await verifyCode(verificationCode, user.id);
      
      if (response.user) {
        setVerificationSuccess('Telefon numaranız başarıyla doğrulandı!');
        setShowVerificationModal(false);
        // Refresh auth state to update user verification status
        await refreshAuthState();
      }
    } catch (error: any) {
      setVerificationError(error.message || 'Doğrulama kodunu kontrol edin ve tekrar deneyin.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[var(--background)]">
        {/* Premium Header */}
        <header className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white mb-8 py-6 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Profilim</h1>
              <p className="mt-1 text-sm opacity-90">Hesabınızı yönetin ve ilanlarınızı takip edin</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-sm font-medium">
                  Hoşgeldiniz, {user?.name || user?.username || user?.email}
                </span>
                <span className="block text-xs opacity-80">Son giriş: {new Date().toLocaleDateString('tr-TR')}</span>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md hover:shadow-lg transition-all border border-white/20"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          {/* Account Info Card with Premium Styling */}
          <div className="bg-[var(--background)] p-8 rounded-2xl border border-[var(--border)] shadow-sm mb-10">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center text-white text-xl font-bold mr-6">
                {user?.name?.[0] || user?.username?.[0] || user?.email?.[0] || 'U'}
              </div>
              <div>
                <div className="flex items-center">
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">Hesap Bilgileri</h2>
                  <VerifiedSellerBadge userType={user?.userType} variant="badge" className="ml-4" />
                </div>
                <p className="text-[var(--foreground)] opacity-70">Kişisel bilgileriniz ve profiliniz</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-sm text-[var(--foreground)] opacity-70">Kullanıcı Adı</span>
                  <span className="font-medium text-[var(--foreground)]">{user?.username || 'Belirlenmemiş'}</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-sm text-[var(--foreground)] opacity-70">Email</span>
                  <span className="font-medium text-[var(--foreground)]">{user?.email}</span>
                </div>
              </div>

              <div className="space-y-3">
                {user?.name && (
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--foreground)] opacity-70">Ad Soyad</span>
                    <span className="font-medium text-[var(--foreground)]">{user.name}</span>
                  </div>
                )}

                <div className="flex items-center">
                  <span className="text-sm text-[var(--foreground)] opacity-70 mr-2">Doğrulama Durumu:</span>
                  {user?.isVerified ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                      <span className="mr-1">✓</span> SMS Onaylı Üye
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-yellow-500 to-orange-600 text-white">
                        <span className="mr-1">!</span> Doğrulama Gerekli
                      </span>
                      <button
                        onClick={handleSendVerificationCode}
                        disabled={isSendingSms}
                        className="px-3 py-1 bg-[var(--accent)] text-white rounded-full text-sm hover:shadow-md transition-all"
                      >
                        {isSendingSms ? 'Gönderiliyor...' : 'SMS Doğrula'}
                      </button>
                    </div>
                  )}
                </div>
                
                {verificationError && (
                  <div className="mt-2 text-red-500 text-sm">
                    {verificationError}
                  </div>
                )}
                
                {verificationSuccess && !showVerificationModal && (
                  <div className="mt-2 text-green-500 text-sm">
                    {verificationSuccess}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard/profile"
                  className="px-4 py-2 bg-[var(--background)] border border-[var(--accent)] text-[var(--accent)] rounded-md hover:bg-[var(--accent)] hover:text-white transition-colors text-sm"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profili Düzenle
                  </span>
                </Link>
                <Link
                  href="/dashboard/change-password"
                  className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Şifre Değiştir
                  </span>
                </Link>
                <Link
                  href="/dashboard/addresses"
                  className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Adreslerim
                  </span>
                </Link>
                <Link
                  href="/dashboard/orders"
                  className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Siparişlerim
                  </span>
                </Link>
                <Link
                  href="/dashboard/won-auctions"
                  className="px-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Kazandığım Açık Arttırmalar
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Seller Request Section */}
          <SellerRequestSection user={user} />

          {/* Live Streams Section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--foreground)]">
                <span className="border-b-3 border-[var(--accent)] pb-1">Yayınlarım</span>
                </h2>
              <Link
                href="/dashboard/streams"
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:shadow-lg transition-all text-sm"
              >
                Yayınlarımı Yönet
              </Link>
            </div>

            <div className="bg-[var(--background)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 border border-[var(--border)] rounded-xl bg-gradient-to-br from-red-500/5 to-red-500/10 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-[var(--foreground)]">Canlı Yayın Aç</h3>
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                  <p className="text-[var(--foreground)] opacity-70 text-sm mb-5">
                    Hemen bir canlı yayın oluşturun ve ürünlerinizi gerçek zamanlı satışa sunun.
                  </p>
                  <Link
                    href="/dashboard/streams/create"
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-sm hover:shadow-lg transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Yayın Başlat
                  </Link>
                </div>

                <div className="p-6 border border-[var(--border)] rounded-xl bg-gradient-to-br from-blue-500/5 to-blue-500/10 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-[var(--foreground)]">Yayın Planla</h3>
                    <span className="text-blue-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                  <p className="text-[var(--foreground)] opacity-70 text-sm mb-5">
                    İleriki bir tarih için yayın planlayın ve izleyicilerinizi bilgilendirin.
                  </p>
                  <Link
                    href="/dashboard/streams/create"
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm hover:shadow-lg transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Yayın Planla
                  </Link>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-[var(--border)] flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent)] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <Link
                  href="/dashboard/streams"
                  className="text-[var(--accent)] hover:underline flex items-center gap-1 text-sm"
                >
                  <span>Tüm yayınlarınızı görüntüleyin ve yönetin</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[var(--foreground)]">
                <span className="border-b-3 border-[var(--accent)] pb-1">Ürünlerim</span>
                </h2>
              <Link
                href="/products/create"
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:shadow-lg transition-all text-sm"
              >
                + Yeni Ürün Ekle
              </Link>
            </div>

            {isLoading ? (
              <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
                <div className="inline-block w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[var(--foreground)] font-medium">Ürünleriniz yükleniyor...</p>
              </div>
            ) : error ? (
              <div className="bg-[var(--background)] p-8 rounded-2xl border border-red-200 shadow-sm">
                <div className="flex items-center text-red-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-lg">{error}</span>
                </div>
                <p className="text-[var(--foreground)] opacity-70 ml-11">Lütfen daha sonra tekrar deneyin veya destek ekibiyle iletişime geçin.</p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-[var(--background)] p-12 rounded-2xl border border-[var(--border)] shadow-sm text-center">
                <div className="w-20 h-20 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">Henüz ürün eklememiş görünüyorsunuz</h3>
                <p className="text-[var(--foreground)] opacity-70 mb-6 max-w-md mx-auto">
                  İlk ürününüzü ekleyerek koleksiyon parçalarınızı satışa sunabilirsiniz.
                </p>
                <Link
                  href="/products/create"
                  className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  İlk Ürününüzü Ekleyin
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <Link
                    href={`/products/${product.id}`}
                    key={product.id}
                    className="group rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--background)] hover:shadow-lg hover:border-[var(--accent)] transition-all"
                  >
                    <div className="h-52 relative bg-[var(--secondary)]">
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          unoptimized={true}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[var(--foreground)] text-opacity-70">Ürün Görseli</span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3 bg-[var(--background)] rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                          {product.title}
                        </h3>
                        <span className="ml-2 px-2 py-1 bg-[var(--accent)] bg-opacity-10 text-[var(--accent)] text-xs rounded-md whitespace-nowrap">
                          {product.category?.name || 'Kategori'}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--foreground)] opacity-70 mb-4 line-clamp-2 min-h-[40px]">
                        {product.description}
                      </p>
                      <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
                        <span className="text-xs text-[var(--foreground)] opacity-70 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(product.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                        <span className="font-bold text-[var(--accent)]">{product.price.toLocaleString('tr-TR')} ₺</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* SMS Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[var(--background)] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-[var(--background)] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-[var(--foreground)]" id="modal-title">
                      Telefon Numaranızı Doğrulayın
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-[var(--foreground)] opacity-70">
                        Telefonunuza gönderilen 6 haneli doğrulama kodunu girin.
                      </p>
                      
                      {verificationSuccess && (
                        <div className="mt-2 p-2 bg-green-100 text-green-800 rounded-md text-sm">
                          {verificationSuccess}
                        </div>
                      )}
                      
                      {verificationError && (
                        <div className="mt-2 p-2 bg-red-100 text-red-800 rounded-md text-sm">
                          {verificationError}
                        </div>
                      )}
                      
                      <div className="mt-4">
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="Doğrulama kodu"
                          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--foreground)] bg-[var(--background)]"
                          maxLength={6}
                        />
                      </div>
                      
                      <div className="mt-2 text-xs text-[var(--foreground)] opacity-70">
                        Kod almadınız mı? 
                        <button 
                          className="ml-1 text-[var(--accent)] hover:underline"
                          onClick={handleSendVerificationCode}
                          disabled={isSendingSms}
                        >
                          {isSendingSms ? 'Gönderiliyor...' : 'Tekrar Gönder'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--background)] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[var(--accent)] text-base font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {isVerifying ? 'Doğrulanıyor...' : 'Doğrula'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowVerificationModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-[var(--border)] shadow-sm px-4 py-2 bg-[var(--background)] text-base font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--border)] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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