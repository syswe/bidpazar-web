'use client';

import Footer from "@/components/Footer";

export default function UserAgreementPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Kullanıcı Sözleşmesi</span>
        </h1>

        <div className="prose prose-lg text-[var(--foreground)] max-w-none">
          <p className="lead text-xl mb-6">
            Bidpazar platformunu kullanarak aşağıdaki sözleşme şartlarını kabul etmiş olursunuz.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Tanımlar</h2>
          <p>
            <strong>Bidpazar:</strong> www.bidpazar.com web sitesi ve mobil uygulaması üzerinden hizmet veren çevrimiçi müzayede ve alışveriş platformudur.
          </p>
          <p>
            <strong>Kullanıcı:</strong> Bidpazar platformuna üye olan ve hizmetlerinden faydalanan gerçek veya tüzel kişilerdir.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Üyelik</h2>
          <p>
            Bidpazar platformuna üye olabilmek için 18 yaşını doldurmuş olmak ve gerçek bilgiler vermek zorunludur. Kullanıcılar, hesap bilgilerinin güvenliğinden ve gizliliğinden kendileri sorumludur.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Alım-Satım Kuralları</h2>
          <p>
            Bidpazar üzerinden gerçekleştirilen tüm alım ve satım işlemleri Türkiye Cumhuriyeti yasalarına uygun olmalıdır. Yasadışı içerik, sahte veya çalıntı ürünlerin satışı kesinlikle yasaktır.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Müzayede Kuralları</h2>
          <p>
            Müzayedelerde verilen teklifler bağlayıcıdır. Müzayedeyi kazanan kullanıcı, ürünü satın almakla yükümlüdür. Ödemesi yapılmayan ürünler için hesap kısıtlamaları uygulanabilir.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Komisyon ve Ücretler</h2>
          <p>
            Bidpazar, satıcılardan satış komisyonu ve alıcılardan hizmet bedeli alabilir. Güncel ücret ve komisyon oranları platform üzerinde belirtilmiştir. Bidpazar, bu oranları önceden bildirmek koşuluyla değiştirme hakkını saklı tutar.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Sorumluluk Sınırları</h2>
          <p>
            Bidpazar, kullanıcılar arasındaki anlaşmazlıklarda aracılık yapabilir ancak taraflar arasındaki ihtilaflardan doğrudan sorumlu değildir. Platform, teknik arızalar veya mücbir sebeplerden kaynaklanan zararlardan sorumlu tutulamaz.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Değişiklikler</h2>
          <p>
            Bidpazar, bu kullanıcı sözleşmesinde dilediği zaman değişiklik yapma hakkını saklı tutar. Değişiklikler, sitede yayınlandığı tarihten itibaren geçerli olur. Kullanıcılar, platformu kullanmaya devam ederek güncel şartları kabul etmiş sayılır.
          </p>

          <p className="mt-8">
            Son güncelleme: 1 Haziran 2024
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
} 