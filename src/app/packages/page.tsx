'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ShieldCheck, Star, Clock, ImagePlus, Award, CreditCard, AlertCircle } from 'lucide-react';
import Footer from '@/components/Footer';

interface PackageOption {
  id: string;
  title: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

export default function PackagesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'post' | 'stream' | 'special'>('post');
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const postPackages: PackageOption[] = [
    {
      id: 'post-3',
      title: '3 Gönderi Paketi',
      price: 199,
      description: 'Ürünlerinizi sergilemek için 3 gönderi hakkı',
      features: [
        '3 adet ürün gönderisi hakkı',
        '30 gün geçerlilik süresi',
        'Ürünlerinizi öne çıkarma',
        'Temel destek'
      ],
      icon: <ImagePlus className="h-10 w-10 text-[var(--accent)]" />
    },
    {
      id: 'post-5',
      title: '5 Gönderi Paketi',
      price: 299,
      description: 'Daha fazla ürün, daha fazla fırsat',
      features: [
        '5 adet ürün gönderisi hakkı',
        '45 gün geçerlilik süresi',
        'Ürünlerinizi öne çıkarma',
        'Öncelikli destek'
      ],
      popular: true,
      icon: <ImagePlus className="h-10 w-10 text-[var(--accent)]" />
    },
    {
      id: 'post-10',
      title: '10 Gönderi Paketi',
      price: 499,
      description: 'Satışlarınızı maksimuma çıkarın',
      features: [
        '10 adet ürün gönderisi hakkı',
        '60 gün geçerlilik süresi',
        'Ürünlerinizi öne çıkarma',
        'Premium destek',
        'Analitik raporlar'
      ],
      icon: <ImagePlus className="h-10 w-10 text-[var(--accent)]" />
    }
  ];

  const streamPackages: PackageOption[] = [
    {
      id: 'stream-180',
      title: '3 Saat Yayın Paketi',
      price: 649,
      description: '180 dakikalık canlı yayın hakkı',
      features: [
        '180 dakika canlı yayın süresi',
        '30 gün geçerlilik süresi',
        'Yayın kaydı',
        'Temel destek'
      ],
      icon: <Clock className="h-10 w-10 text-[var(--accent)]" />
    },
    {
      id: 'stream-600',
      title: '10 Saat Yayın Paketi',
      price: 1499,
      description: '600 dakikalık canlı yayın hakkı',
      features: [
        '600 dakika canlı yayın süresi',
        '60 gün geçerlilik süresi',
        'Yayın kaydı',
        'Öncelikli destek',
        'Özel yayın saatleri'
      ],
      popular: true,
      icon: <Clock className="h-10 w-10 text-[var(--accent)]" />
    },
    {
      id: 'stream-1500',
      title: '25 Saat Yayın Paketi',
      price: 2999,
      description: '1500 dakikalık canlı yayın hakkı',
      features: [
        '1500 dakika canlı yayın süresi',
        '90 gün geçerlilik süresi',
        'Yayın kaydı',
        'Premium destek',
        'Özel yayın saatleri',
        'Analitik raporlar'
      ],
      icon: <Clock className="h-10 w-10 text-[var(--accent)]" />
    }
  ];

  const specialPackages: PackageOption[] = [
    {
      id: 'bronze',
      title: 'Bronz Paket',
      price: 999,
      description: 'İlk adımınızı profesyonel satıcılığa atın',
      features: [
        '5 adet ürün gönderisi hakkı',
        '300 dakika canlı yayın süresi',
        '45 gün geçerlilik süresi',
        'Öne çıkarılmış gönderiler',
        'Temel analitik raporlar',
        'Satıcı rozeti'
      ],
      icon: <Award className="h-10 w-10 text-amber-600" />
    },
    {
      id: 'silver',
      title: 'Gümüş Paket',
      price: 1999,
      description: 'Satışlarınızı bir üst seviyeye taşıyın',
      features: [
        '10 adet ürün gönderisi hakkı',
        '750 dakika canlı yayın süresi',
        '60 gün geçerlilik süresi',
        'Öne çıkarılmış gönderiler',
        'Detaylı analitik raporlar',
        'Öncelikli satıcı rozeti',
        'Özelleştirilebilir mağaza sayfası'
      ],
      popular: true,
      icon: <Award className="h-10 w-10 text-gray-400" />
    },
    {
      id: 'gold',
      title: 'Altın Paket',
      price: 3499,
      description: 'Premium satıcı deneyimi',
      features: [
        '15 adet ürün gönderisi hakkı',
        '1800 dakika canlı yayın süresi',
        '90 gün geçerlilik süresi',
        'Öne çıkarılmış gönderiler',
        'Kapsamlı analitik raporlar',
        'Elit satıcı rozeti',
        'Özelleştirilebilir mağaza sayfası',
        'VIP müşteri desteği',
        'Özel yayın saatleri'
      ],
      icon: <Award className="h-10 w-10 text-yellow-500" />
    }
  ];

  const currentPackages = selectedTab === 'post' ? postPackages : 
                          selectedTab === 'stream' ? streamPackages : specialPackages;

  const handlePackageSelect = (pkg: PackageOption) => {
    setSelectedPackage(pkg);
    
    if (!isAuthenticated) {
      router.push('/sign-in?redirect=/packages');
      return;
    }
    
    setShowCheckout(true);
  };

  const handleBackToPackages = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
  };

  const handleCompletePurchase = () => {
    // This would be replaced with actual payment processing
    alert(`Teşekkürler! ${selectedPackage?.title} satın alımınız başarıyla tamamlandı.`);
    setShowCheckout(false);
    setSelectedPackage(null);
  };

  return (
    <div className="min-h-screen">
      {!showCheckout ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-[var(--foreground)]">
              <span className="relative">
                Bidpazar Paketleri
                <span className="absolute bottom-0 left-0 w-full h-1 bg-[var(--accent)]"></span>
              </span>
            </h1>
            <p className="text-lg text-[var(--foreground)] max-w-3xl mx-auto opacity-90">
              İhtiyaçlarınıza uygun paketlerle Bidpazar'da satışlarınızı artırın ve daha fazla müşteriye ulaşın.
            </p>
          </div>

          {/* Package Type Tabs */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
              <button
                onClick={() => setSelectedTab('post')}
                className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                  selectedTab === 'post'
                    ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--foreground)] bg-transparent hover:bg-[var(--background)] hover:bg-opacity-40'
                }`}
              >
                Gönderi Paketleri
              </button>
              <button
                onClick={() => setSelectedTab('stream')}
                className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                  selectedTab === 'stream'
                    ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--foreground)] bg-transparent hover:bg-[var(--background)] hover:bg-opacity-40'
                }`}
              >
                Yayın Paketleri
              </button>
              <button
                onClick={() => setSelectedTab('special')}
                className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                  selectedTab === 'special'
                    ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--foreground)] bg-transparent hover:bg-[var(--background)] hover:bg-opacity-40'
                }`}
              >
                Özel Paketler
              </button>
            </div>
          </div>

          {/* Packages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentPackages.map((pkg) => (
              <div 
                key={pkg.id}
                className={`relative overflow-hidden rounded-2xl border ${
                  pkg.popular 
                    ? 'border-[var(--accent)] shadow-lg' 
                    : 'border-[var(--border)]'
                } transition-all hover:shadow-md bg-[var(--background)]`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-[var(--accent)] text-white text-xs font-bold py-1 px-3 rounded-bl-lg">
                      En Popüler
                    </div>
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {pkg.icon}
                    <h3 className="ml-3 text-xl font-semibold text-[var(--foreground)]">{pkg.title}</h3>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-3xl font-bold text-[var(--foreground)]">
                      {pkg.price} TL
                    </p>
                    <p className="text-sm text-[var(--foreground)] opacity-75 mt-1">
                      {pkg.description}
                    </p>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="h-5 w-5 text-[var(--accent)] flex-shrink-0 mr-2" />
                        <span className="text-sm text-[var(--foreground)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handlePackageSelect(pkg)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      pkg.popular
                        ? 'bg-[var(--accent)] text-white hover:bg-opacity-90'
                        : 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90'
                    }`}
                  >
                    Satın Al
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Packages Info Section */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold mb-4 text-[var(--foreground)]">Bidpazar Paketleri Hakkında</h2>
              <p className="text-[var(--foreground)] mb-4">
                Bidpazar paketleri, ürünlerinizi daha geniş kitlelere ulaştırmanız için tasarlanmıştır. Gönderi hakları, canlı yayın süreleri ve özel paketlerle satışlarınızı artırabilirsiniz.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="flex flex-col items-center text-center">
                  <ImagePlus className="h-10 w-10 text-[var(--accent)] mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-[var(--foreground)]">Gönderi Paketleri</h3>
                  <p className="text-sm text-[var(--foreground)] opacity-80">
                    Ürünlerinizi sergilemek için gönderi hakları satın alın. Ne kadar çok gönderi, o kadar çok potansiyel müşteri.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <Clock className="h-10 w-10 text-[var(--accent)] mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-[var(--foreground)]">Yayın Paketleri</h3>
                  <p className="text-sm text-[var(--foreground)] opacity-80">
                    Canlı yayınlarla ürünlerinizi gerçek zamanlı tanıtın ve potansiyel alıcılarla etkileşime geçin.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <ShieldCheck className="h-10 w-10 text-[var(--accent)] mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-[var(--foreground)]">Özel Paketler</h3>
                  <p className="text-sm text-[var(--foreground)] opacity-80">
                    Gönderi ve yayın haklarını birleştiren avantajlı paketlerle daha fazla tasarruf edin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Checkout Section
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center mb-8">
            <button
              onClick={handleBackToPackages}
              className="text-[var(--accent)] hover:underline flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Paketlere Dön
            </button>
            <h2 className="text-2xl font-bold text-[var(--foreground)] ml-4">Ödeme</h2>
          </div>

          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden mb-8">
            <div className="bg-[var(--muted)] p-4 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Sipariş Özeti</h3>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  {selectedPackage?.icon}
                  <span className="ml-3 font-medium text-[var(--foreground)]">{selectedPackage?.title}</span>
                </div>
                <span className="font-bold text-[var(--foreground)]">{selectedPackage?.price} TL</span>
              </div>
              
              <div className="border-t border-[var(--border)] my-4 pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-[var(--foreground)]">Ara Toplam:</span>
                  <span className="text-[var(--foreground)]">{selectedPackage?.price} TL</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-[var(--foreground)]">KDV (%18):</span>
                  <span className="text-[var(--foreground)]">
                    {selectedPackage ? Math.round(selectedPackage.price * 0.18) : 0} TL
                  </span>
                </div>
                <div className="flex justify-between font-bold mt-4 pt-2 border-t border-[var(--border)]">
                  <span className="text-[var(--foreground)]">Toplam:</span>
                  <span className="text-[var(--foreground)]">
                    {selectedPackage ? Math.round(selectedPackage.price * 1.18) : 0} TL
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden mb-8">
            <div className="bg-[var(--muted)] p-4 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Ödeme Bilgileri</h3>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center px-3 py-2 bg-amber-50 text-amber-800 rounded-md mb-4">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p className="text-sm">Bu bir test sayfasıdır. Ödeme sistemi henüz entegre edilmemiştir.</p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Kart Üzerindeki İsim
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)]"
                  placeholder="Adınız Soyadınız"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  Kart Numarası
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-4 py-2 pl-11 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)]"
                    placeholder="1234 5678 9012 3456"
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <CreditCard className="h-5 w-5 text-[var(--muted-foreground)]" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    Son Kullanma Tarihi
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)]"
                    placeholder="AA / YY"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                    CVV
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)]"
                    placeholder="123"
                  />
                </div>
              </div>
              
              <button
                onClick={handleCompletePurchase}
                className="w-full py-3 px-4 rounded-lg font-medium bg-[var(--accent)] text-white hover:bg-opacity-90 transition-colors"
              >
                Ödemeyi Tamamla
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
} 