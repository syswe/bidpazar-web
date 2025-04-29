'use client';

import Footer from "@/components/Footer";

export default function CookiesPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Çerezlere Dair Aydınlatma Metni</span>
        </h1>

        <div className="prose prose-lg text-[var(--foreground)] max-w-none">
          <p className="lead text-xl mb-6">
            Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (Kanun) 10'uncu maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında veri sorumlusu sıfatıyla bidpazar.com tarafından hazırlanmıştır.
          </p>

          <p className="mb-6">
            Bu Çerez Aydınlatma Metni'nin amacı, internet sitemizde kullanılan çerezlerin cihazınıza yerleştirilmesi aracılığıyla otomatik yolla elde edilen kişisel verilerin işlenmesine ilişkin olarak, hangi amaçlarla hangi tür çerezleri kullandığımız, hukuki sebebi ve haklarınız hakkında sizlere bilgi vermektir.
          </p>
          
          <p className="mb-6">
            İnternet sitemizde yalnızca hizmetin sağlanması için kesinlikle gerekli olarak birinci taraf oturum ve kalıcı çerezler kullanılmaktadır.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Çerez Çeşitleri</h2>
          
          <div className="bg-[var(--card)] p-5 rounded-lg shadow-sm border border-[var(--border)] my-6">
            <h3 className="font-semibold text-lg mb-3">Kullanım süresine göre çerez çeşitleri</h3>
            <p>
              <strong>Oturum çerezi</strong>, oturumun sürekliliğinin sağlanması amacıyla kullanılmakta olup kullanıcı tarayıcısını kapattığında bu çerezler de silinmektedir.
            </p>
            <p className="mt-2">
              <strong>Kalıcı çerez</strong> ise internet tarayıcısı kapatıldığı zaman silinmemekte ve belirli bir tarihte veya belirli bir süre sonra kendiliğinden silinmektedir.
            </p>
            <p className="mt-2">
              Bu çerçevede, internet sitemizde kullanım sürelerine göre oturum ve kalıcı çerezler kullanılmaktadır.
            </p>
          </div>

          <div className="bg-[var(--card)] p-5 rounded-lg shadow-sm border border-[var(--border)] my-6">
            <h3 className="font-semibold text-lg mb-3">Birinci taraf ve üçüncü taraf çerezler</h3>
            <p>
              <strong>Birinci taraf çerezler</strong>, doğrudan kullanıcının ziyaret ettiği internet sitesi yani tarayıcının adres çubuğunda gösterilen adres tarafından yerleştirilmektedir.
            </p>
            <p className="mt-2">
              <strong>Üçüncü taraf çerezler</strong>se, kullanıcının ziyaret ettiği adres dışında farklı bir etki alanı tarafından yerleştirilmektedir.
            </p>
            <p className="mt-2">
              Bu çerçevede, internet sitemizde yalnızca birinci taraf çerez kullanılmaktadır.
            </p>
          </div>

          <div className="bg-[var(--card)] p-5 rounded-lg shadow-sm border border-[var(--border)] my-6">
            <h3 className="font-semibold text-lg mb-3">Kullanım amaçlarına göre çerez çeşitleri</h3>
            <p>
              Çerezler kullanım amaçlarına göre kesinlikle gerekli, işlevsel veya reklam/pazarlama gibi amaçlarla kullanılabilmektedir.
            </p>
            <p className="mt-2">
              Bu çerçevede, internet sitemizde açıkça talep etmiş olduğunuz hizmetlerin sunulabilmesi için kesinlikle gerekli çerezler kullanılmaktadır. Bu kapsamda,
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li className="mb-2">İnternet sayfasında internet sayfasına, sonradan gelen isteklerin güvenilir olup olmadığını anlamak amacıyla <strong>cookiesession1</strong> isimli birinci taraf kalıcı çerezini (bir yıl saklanmaktadır),</li>
              <li>Çerez aydınlatma metninin okunduğunun teyidi amacıyla <strong>cookiepolicy_status</strong> isimli birinci taraf kalıcı çerezini (bir yıl saklanmaktadır.)</li>
            </ul>
            <p className="mt-2">
              IP bilgilerinizle ilişkilendirmek suretiyle kişisel verileriniz işlenmektedir. Söz konusu kişisel verileriniz başka veri sorumlularına aktarılmamaktadır.
            </p>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Hukuki Dayanak</h2>
          <p>
            Söz konusu çerezler yoluyla kişisel verilerin işlenmesinde 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 5'inci maddesinin ikinci fıkrasının (f) bendi uyarınca "İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması" işleme şartına dayanılmaktadır.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Haklarınız</h2>
          <p>
            6698 sayılı Kanun'un "ilgili kişinin haklarını düzenleyen" 11'inci maddesi kapsamındaki taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e göre <a href="mailto:bidpazar@gmail.com" className="text-[var(--accent)] hover:underline">bidpazar@gmail.com</a> mail adresine iletebilirsiniz.
          </p>

          <p className="mt-8">
            Son güncelleme: 29 Nisan 2025
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
} 