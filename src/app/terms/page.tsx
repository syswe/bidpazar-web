'use client';

import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Kullanım Koşulları</span>
        </h1>

        <div className="prose prose-lg text-[var(--foreground)] max-w-none">
          <p className="lead text-xl mb-6">
            Son güncelleme: 1 Ocak 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Giriş</h2>
            <p>
              Bidpazar platformuna (web sitesi ve mobil uygulama dahil) hoş geldiniz. Bu Kullanım Koşulları, platformumuzu
              kullanımınızı düzenleyen yasal bir anlaşmadır. Bidpazar platformunu kullanarak, bu koşulları kabul etmiş sayılırsınız.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Hesap Oluşturma ve Kullanımı</h2>
            <p>
              Bidpazar hizmetlerinden yararlanmak için, doğru, güncel ve eksiksiz bilgilerle bir hesap oluşturmanız gerekir.
              Hesap bilgilerinizin güvenliğinden ve hesabınızda gerçekleşen tüm etkinliklerden siz sorumlusunuz.
            </p>
            <p className="mt-4">
              Aşağıdaki durumlar hesap kullanımı ile ilgili yasaklanmıştır:
            </p>
            <ul className="list-disc pl-6 my-4 space-y-2">
              <li>18 yaşından küçük kullanıcıların hesap oluşturması</li>
              <li>Başka bir kişiyi taklit etmek veya başka bir kişi veya kuruluşla ilişkinizi yanlış beyan etmek</li>
              <li>Birden fazla hesap oluşturmak veya başka bir kullanıcının hesabını kullanmak</li>
              <li>Platformda yasadışı veya izinsiz faaliyetlerde bulunmak</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Alım-Satım Kuralları</h2>
            <p>
              Bidpazar, alıcılar ve satıcılar arasında bir aracı platform görevi görür. Her kullanıcı, platformda
              gerçekleştirdiği işlemlerden yasal olarak sorumludur.
            </p>
            <p className="mt-4">
              <strong>Alıcılar için:</strong> Teklif verdiğinizde veya "Hemen Al" seçeneğini kullandığınızda, satın alma
              taahhüdünde bulunmuş olursunuz. Kazanılan müzayedelerde veya onaylanan siparişlerde ödeme yapmama, hesabınızın
              askıya alınmasına veya kapatılmasına neden olabilir.
            </p>
            <p className="mt-4">
              <strong>Satıcılar için:</strong> Ürün listelerken doğru ve eksiksiz bilgi vermeniz, yasaların izin verdiği ürünleri
              satışa sunmanız ve alıcıya belirtilen sürede ürünü göndermeniz gerekmektedir. Satıcı politikalarımıza uymayan
              davranışlar, hesabınızın askıya alınmasına veya kapatılmasına neden olabilir.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Yasak Ürün ve İçerikler</h2>
            <p>
              Aşağıdaki ürün ve içerikler Bidpazar platformunda listelemek, satmak veya satın almak için yasaktır:
            </p>
            <ul className="list-disc pl-6 my-4 space-y-2">
              <li>Sahte, çalıntı veya yasadışı yollarla elde edilmiş ürünler</li>
              <li>Ateşli silahlar, patlayıcılar ve yasadışı silahlar</li>
              <li>Reçeteli ilaçlar, uyuşturucular ve yasadışı maddeler</li>
              <li>Tehlike arz eden veya yasalarla düzenlenen maddeler</li>
              <li>Telif hakkı, ticari marka veya fikri mülkiyet haklarını ihlal eden ürünler</li>
              <li>Müstehcen, nefret söylemi içeren veya ayrımcı içerikler</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Ücretler ve Komisyonlar</h2>
            <p>
              Bidpazar, platform üzerinden gerçekleştirilen işlemlerde satıcılardan komisyon almaktadır. Komisyon oranları ve
              diğer ücretler hakkında güncel bilgiler ücret sayfamızda bulunmaktadır. Bidpazar, önceden bildirimde bulunarak
              ücretlerde değişiklik yapma hakkını saklı tutar.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Fikri Mülkiyet</h2>
            <p>
              Bidpazar platformu, içeriği, logoları, yazılımı ve diğer özellikler, Bidpazar veya lisans verenlerin mülkiyetindedir.
              Platformumuzu kullanmanız, bu fikri mülkiyet haklarını kullanma veya çoğaltma hakkını size vermez.
            </p>
            <p className="mt-4">
              Platformumuza içerik (ürün fotoğrafları, açıklamalar, yorumlar vb.) yükleyerek, bu içeriği kullanmamız,
              dağıtmamız ve görüntülememiz için dünya çapında, telifsiz bir lisans vermiş olursunuz.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Sorumluluk Sınırlandırması</h2>
            <p>
              Bidpazar, platformda listelenen ürünlerin kalitesi, güvenliği veya yasallığından doğrudan sorumlu değildir.
              Bidpazar, kullanıcılar arasındaki anlaşmazlıklarda aracılık yapmaya çalışsa da, tüm anlaşmazlıkların çözüleceğini
              garanti etmez.
            </p>
            <p className="mt-4">
              Platformumuzun kesintisiz veya hatasız çalışacağını garanti etmiyoruz. Zaman zaman bakım veya güncellemeler
              nedeniyle hizmet kesintileri olabilir.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Hesap Sonlandırma</h2>
            <p>
              Bidpazar, kendi takdirine bağlı olarak, bu kullanım koşullarını ihlal eden veya platformun güvenliğini ve
              bütünlüğünü tehlikeye atan kullanıcıların hesaplarını askıya alabilir veya sonlandırabilir. Hesabınızı
              dilediğiniz zaman hesap ayarlarınızdan kapatabilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Değişiklikler</h2>
            <p>
              Bidpazar, bu kullanım koşullarını zaman zaman güncelleyebilir. Önemli değişiklikler olduğunda, size e-posta
              yoluyla veya platformda bir bildirim göstererek bilgilendireceğiz. Değişikliklerden sonra platformu kullanmaya
              devam etmeniz, güncellenmiş koşulları kabul ettiğiniz anlamına gelir.
            </p>
            <p className="mt-4">
              Bu kullanım koşulları hakkında herhangi bir sorunuz varsa, lütfen
              <a href="mailto:info@Bidpazar.com" className="text-[var(--primary)] hover:underline ml-1">info@Bidpazar.com</a>
              adresinden bizimle iletişime geçin.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
} 