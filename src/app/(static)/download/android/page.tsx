export default function AndroidDownloadPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
        <span className="border-b-4 border-[var(--accent)] pb-2">Android Uygulaması</span>
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <p className="text-lg mb-6">
            Bidpazar Android uygulaması ile müzayedelere her yerden katılın, en sevdiğiniz antika ve koleksiyon ürünlerini takip edin.
            Mobil uygulamamızla sunduğumuz özel avantajlar:
          </p>

          <ul className="space-y-4 mb-8">
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">Anlık Bildirimler:</strong> Takip ettiğiniz ürünler ve müzayedeler hakkında anında bilgi alın.
              </div>
            </li>
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">Hızlı Teklif Verme:</strong> Tek dokunuşla teklifinizi yükseltin, fırsatları kaçırmayın.
              </div>
            </li>
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">QR Kod Tarama:</strong> Fiziksel müzayedelerde ürünlerin detaylarını anında görüntüleyin.
              </div>
            </li>
            <li className="flex items-start">
              <div className="mr-3 text-[var(--accent)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <strong className="font-medium">Mobil Ödeme:</strong> Güvenli ve hızlı ödeme seçenekleriyle alışverişinizi tamamlayın.
              </div>
            </li>
          </ul>

          <div className="mb-8">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.5h-3.75a.75.75 0 000 1.5h6a.75.75 0 000-1.5h-2.25v-8.5z" />
              </svg>
              Google Play&apos;den İndir
            </a>
          </div>

          <div className="text-sm opacity-75">
            <p>Desteklenen Android sürümleri: 8.0 ve üzeri</p>
            <p>Boyut: ~25MB</p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          {/* Placeholder for app screenshot */}
          <div className="relative w-full max-w-[300px] aspect-[9/16] bg-[var(--muted)] rounded-3xl overflow-hidden border-8 border-[var(--border)] shadow-xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center mb-4">
                <span className="text-2xl font-bold">B</span>
              </div>
              <p className="font-medium">Bidpazar Android Uygulaması</p>
              <p className="text-sm mt-4 opacity-70">Uygulama görseli burada görüntülenecektir</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Sistem Gereksinimleri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium mb-2">Minimum Gereksinimler:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Android 8.0 (Oreo) veya üzeri</li>
              <li>2GB RAM</li>
              <li>25MB boş depolama alanı</li>
              <li>İnternet bağlantısı</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Önerilen Gereksinimler:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Android 10.0 veya üzeri</li>
              <li>4GB RAM</li>
              <li>100MB boş depolama alanı</li>
              <li>Stabil ve hızlı internet bağlantısı</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 