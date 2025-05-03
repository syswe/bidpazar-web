export default function IOSDownloadPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
        <span className="border-b-4 border-[var(--accent)] pb-2">iOS Uygulaması</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <p className="text-lg mb-6">
            iPhone ve iPad cihazlarınızda Bidpazar deneyimini yaşayın. Özel tasarlanmış iOS uygulamamızla
            antika ve koleksiyon dünyasını cebinizde taşıyın.
          </p>

          <ul className="space-y-4 mb-8">
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">Face ID ile Güvenli Giriş:</strong> Hızlı ve güvenli bir şekilde uygulamaya erişin.
              </div>
            </li>
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">Apple Pay Entegrasyonu:</strong> Tek dokunuşla güvenli ödeme yapın.
              </div>
            </li>
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">AR Görüntüleme:</strong> Satın almadan önce ürünleri evinizde nasıl görüneceğini görün.
              </div>
            </li>
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">iCloud Senkronizasyonu:</strong> Tüm Apple cihazlarınızda aynı deneyimi yaşayın.
              </div>
            </li>
          </ul>

          <div className="mb-8">
            <a
              href="https://apps.apple.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.5h-3.75a.75.75 0 000 1.5h6a.75.75 0 000-1.5h-2.25v-8.5z" />
              </svg>
              App Store&apos;dan İndir
            </a>
          </div>

          <div className="text-sm opacity-75">
            <p>Desteklenen iOS sürümleri: iOS 14.0 ve üzeri</p>
            <p>Boyut: ~30MB</p>
            <p>Desteklenen cihazlar: iPhone 8 ve üzeri, iPad 6. nesil ve üzeri</p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          {/* Placeholder for app screenshot */}
          <div className="relative w-full max-w-[300px] aspect-[9/16] bg-[var(--muted)] rounded-[40px] overflow-hidden border-8 border-[var(--border)] shadow-xl">
            <div className="absolute top-0 w-full h-6 bg-[var(--border)]"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center mb-4">
                <span className="text-2xl font-bold">B</span>
              </div>
              <p className="font-medium">Bidpazar iOS Uygulaması</p>
              <p className="text-sm mt-4 opacity-70">Uygulama görseli burada görüntülenecektir</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Sistem Gereksinimleri</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>iOS 14.0 veya üzeri</li>
            <li>iPhone 8 veya daha yeni iPhone modelleri</li>
            <li>iPad 6. nesil veya daha yeni iPad modelleri</li>
            <li>30MB boş depolama alanı</li>
            <li>İnternet bağlantısı</li>
          </ul>
        </div>

        <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Gizlilik ve Güvenlik</h2>
          <p className="mb-4">
            Bidpazar iOS uygulaması, Apple&apos;ın tüm gizlilik ve güvenlik standartlarına uygundur.
            Kullanıcı verileriniz en üst düzey güvenlik önlemleriyle korunmaktadır.
          </p>
          <p>
            App Store&apos;dan indirilen uygulamamız, düzenli güvenlik güncellemeleri ile sürekli olarak
            iyileştirilmektedir. Daha fazla bilgi için
            <a href="/privacy" className="text-[var(--primary)] font-medium hover:underline ml-1">
              Gizlilik Politikamızı
            </a> inceleyebilirsiniz.
          </p>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold mb-6">Her İki Platformda da Bidpazar</h2>
        <p className="mb-6 max-w-xl mx-auto">
          Hem Android hem de iOS cihazlarınızda Bidpazar deneyimini yaşayın. Tüm cihazlarınızda hesabınıza
          erişebilir, müzayedeleri takip edebilir ve koleksiyonunuzu genişletebilirsiniz.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/download/android"
            className="inline-flex items-center bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Android Uygulaması
          </a>
          <a
            href="/download/ios"
            className="inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            iOS Uygulaması
          </a>
        </div>
      </div>
    </div>
  );
} 