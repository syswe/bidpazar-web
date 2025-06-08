'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email?: string;
  username: string;
  name?: string;
  phoneNumber?: string;
  isVerified?: boolean;
  isAdmin?: boolean;
  userType?: 'MEMBER' | 'SELLER';
}

interface SellerRequestSectionProps {
  user: User | null;
}

interface SellerRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export default function SellerRequestSection({ user }: SellerRequestSectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingRequest, setExistingRequest] = useState<SellerRequest | null>(null);
  const [checkingRequest, setCheckingRequest] = useState(true);
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    phoneNumber: '',
    email: user?.email || '',
    productCategories: '',
    notes: '',
    acceptTerms: false
  });

  // Check if user has an existing request
  useEffect(() => {
    const checkExistingRequest = async () => {
      if (!user) {
        setCheckingRequest(false);
        return;
      }
      
      try {
        const token = localStorage.getItem('auth') ? 
          JSON.parse(localStorage.getItem('auth')!).token : null;
        
        if (!token) {
          setCheckingRequest(false);
          return;
        }

        const response = await fetch('/api/seller-requests', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Find user's request
          const userRequest = data.data?.find((req: any) => req.userId === user.id);
          if (userRequest) {
            setExistingRequest(userRequest);
          }
        }
      } catch (error) {
        console.error('Error checking existing request:', error);
      } finally {
        setCheckingRequest(false);
      }
    };

    checkExistingRequest();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.acceptTerms) {
      alert('KVKK ve Gizlilik Politikası şartlarını kabul etmeniz gerekmektedir.');
      return;
    }

    if (!formData.fullName || !formData.phoneNumber || !formData.email || !formData.productCategories) {
      alert('Lütfen tüm zorunlu alanları doldurunuz.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('auth') ? 
        JSON.parse(localStorage.getItem('auth')!).token : null;
      
      const response = await fetch('/api/seller-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          email: formData.email,
          productCategories: formData.productCategories,
          notes: formData.notes
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Başvurunuz başarıyla gönderildi!');
        setIsFormOpen(false);
        setExistingRequest(data.data); // Set the new request
        setFormData({
          fullName: user?.name || '',
          phoneNumber: '',
          email: user?.email || '',
          productCategories: '',
          notes: '',
          acceptTerms: false
        });
      } else {
        alert(data.error || 'Başvuru gönderilemedi. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Başvuru gönderilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
    };
    
    const labels = {
      PENDING: 'Değerlendiriliyor',
      APPROVED: 'Onaylandı',
      REJECTED: 'Reddedildi'
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  // Don't show if user is already a seller
  if (user?.userType === 'SELLER') {
    return null;
  }

  // Show loading state while checking for existing request
  if (checkingRequest) {
    return (
      <div className="mb-10">
        <div className="bg-[var(--background)] p-8 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--accent)]"></div>
            <span className="ml-3 text-[var(--foreground)] opacity-70">Başvuru durumu kontrol ediliyor...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show existing request status if user has already applied
  if (existingRequest) {
    return (
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Satıcı Başvurunuz
              </h3>
              <span className={`status-badge ${
                existingRequest.status === 'PENDING' ? 'status-badge-pending' :
                existingRequest.status === 'APPROVED' ? 'status-badge-approved' :
                'status-badge-rejected'
              }`}>
                {existingRequest.status === 'PENDING' ? 'Değerlendirme Aşamasında' :
                 existingRequest.status === 'APPROVED' ? 'Onaylandı' :
                 'Reddedildi'}
              </span>
            </div>
            
            <div className="premium-info mb-4">
              <p className="font-medium mb-1">
                Formunuz alındı, onay aşamasında size bilgi verilecektir.
              </p>
              <p className="text-sm text-muted-readable">
                Başvurunuz inceleniyor. Sonuç hakkında en kısa sürede bilgilendirileceksiniz.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Başvuru Tarihi:</span>
                <p className="text-muted-readable">
                  {new Date(existingRequest.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Durum:</span>
                <p className="text-muted-readable">
                  {existingRequest.status === 'PENDING' ? 'İnceleme aşamasında' :
                   existingRequest.status === 'APPROVED' ? 'Onaylandı' :
                   'İnceleme tamamlandı'}
                </p>
              </div>
            </div>

            {existingRequest.reviewNotes && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Yönetici Notu:
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {existingRequest.reviewNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="bg-[var(--background)] p-8 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-[var(--accent)] rounded-full flex items-center justify-center text-white mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Satıcı Ol</h2>
            <p className="text-[var(--foreground)] opacity-70">BidPazar ailesine katılın ve ürünlerinizi satışa sunun</p>
          </div>
        </div>

        {!isFormOpen ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Neden Satıcı Olmalısınız?</h3>
              <ul className="space-y-3 text-[var(--foreground)] opacity-70">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-[var(--accent)] mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Canlı yayınlarla ürünlerinizi milyonlara ulaştırın
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-[var(--accent)] mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Gelişmiş teknolojik altyapı
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-[var(--accent)] mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Anlık ödeme sistemi
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-[var(--accent)] mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Doğrulanmış kullanıcı kitlesi
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-[var(--accent)] mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Güvenli, hızlı ve eğlenceli satış deneyimi
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 rounded-lg border border-[var(--accent)]/20">
                <p className="text-sm text-[var(--foreground)] opacity-80">
                  BidPazar ailesine katılarak ürünlerinizi canlı yayınlarla milyonlara ulaştırın! 
                  Gelişmiş teknolojik altyapımız, anlık ödeme sistemi ve doğrulanmış kullanıcı kitlesiyle 
                  güvenli, hızlı ve eğlenceli bir satış deneyimi sunuyoruz.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={() => setIsFormOpen(true)}
                className="px-8 py-4 bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white rounded-xl hover:shadow-lg transition-all text-lg font-medium"
              >
                Satıcı Başvurusu Yap
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Satıcı Başvuru Formu</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  İsim Soyisim *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Telefon Numarası *
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  E-posta Adresi *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Satılacak Ürün Kategorileri *
                </label>
                <input
                  type="text"
                  name="productCategories"
                  value={formData.productCategories}
                  onChange={handleInputChange}
                  placeholder="Örn: Elektronik, Giyim, Ev Dekorasyonu"
                  required
                  className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Notlar (Açıklama Alanı)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                placeholder="Satmak istediğiniz ürünler, deneyiminiz veya eklemek istediğiniz notlar hakkında kısa bir açıklama yazabilirsiniz."
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              />
            </div>

            <div className="flex items-start">
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleInputChange}
                required
                className="h-4 w-4 text-[var(--accent)] border-[var(--border)] rounded mt-1 mr-3"
              />
              <label className="text-sm text-[var(--foreground)] opacity-70">
                KVKK ve Gizlilik Politikası'nda belirtilen tüm şartları kabul ediyorum. *
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Gönderiliyor...' : 'GÖNDER'}
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-6 py-3 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-all"
              >
                İptal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 