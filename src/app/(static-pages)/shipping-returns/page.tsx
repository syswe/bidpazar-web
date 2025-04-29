'use client';

import Footer from "@/components/Footer";

export default function ShippingReturnsPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Gönderim, İade ve Geri Ödeme Politikası</span>
        </h1>

        <div className="prose prose-lg text-[var(--foreground)] max-w-none">
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">Gönderim Politikası</h2>

            <h3 className="text-xl font-medium mt-6 mb-3">Gönderim Süreleri</h3>
            <p>
              Ödemeniz tamamlandıktan sonra ürünler genellikle 1-3 iş günü içerisinde kargoya verilir.
              Kargo şirketine bağlı olarak teslimat süresi 1-5 iş günü arasında değişebilir.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">Kargo Ücretleri</h3>
            <p>
              500 TL ve üzeri alışverişlerinizde kargo ücretsizdir. 500 TL altındaki siparişlerde ise
              kargo ücreti ürün boyutuna ve ağırlığına göre hesaplanır ve sepette görüntülenir.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">Özel ve Sigortalı Gönderim</h3>
            <p>
              Değerli ve hassas ürünler için özel ve sigortalı gönderim seçeneği sunuyoruz. Bu hizmet
              ürün değerine göre ekstra ücretlendirilir.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">İade Politikası</h2>

            <h3 className="text-xl font-medium mt-6 mb-3">İade Koşulları</h3>
            <p>
              Ürünü teslim aldığınız tarihten itibaren 14 gün içerisinde iade talebinde bulunabilirsiniz.
              İade edilecek ürünlerin orijinal ambalajında ve kullanılmamış olması gerekmektedir.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">İade Süreci</h3>
            <ol className="list-decimal pl-6 space-y-2 my-4">
              <li>Hesabınızdaki "Siparişlerim" sayfasından iade talebinde bulunun.</li>
              <li>İade nedeninizi belirtin ve onay bekleyin.</li>
              <li>Onaydan sonra ürünü orijinal ambalajında kargoya verin.</li>
              <li>Ürün kontrolü yapıldıktan sonra iade işleminiz tamamlanacaktır.</li>
            </ol>

            <h3 className="text-xl font-medium mt-6 mb-3">İade Edilemeyen Ürünler</h3>
            <p>
              Canlı müzayedelerden satın alınan ürünler, özel sipariş ürünler ve üzerinde değişiklik
              yapılmış ürünler iade kapsamına girmemektedir.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Geri Ödeme Politikası</h2>

            <h3 className="text-xl font-medium mt-6 mb-3">Geri Ödeme Yöntemleri</h3>
            <p>
              Geri ödemeler, ödeme yaptığınız yöntem üzerinden yapılır:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>Kredi kartı ödemelerinde: 3-7 iş günü içerisinde kartınıza iade edilir.</li>
              <li>Banka havalesi ile ödemelerde: 1-3 iş günü içerisinde hesabınıza aktarılır.</li>
              <li>Bidpazar bakiyesi ile ödemelerde: Anında bakiyenize eklenir.</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">Kısmi İadeler</h3>
            <p>
              Birden fazla ürün içeren siparişlerde, yalnızca iade ettiğiniz ürünlerin bedeli iade edilir.
              Kargo ücretleri iade edilmez.
            </p>

            <div className="bg-[var(--muted)] p-4 rounded-lg border border-[var(--border)] mt-8">
              <p className="font-semibold mb-2">İade ve Geri Ödeme Sorularınız İçin</p>
              <p>
                Herhangi bir sorunuz veya sorununuz olduğunda 7/24 müşteri hizmetlerimize
                <a href="mailto:destek@bidpazar.com" className="text-[var(--primary)] font-medium hover:underline ml-1">destek@bidpazar.com</a> 
                 adresinden ulaşabilirsiniz.
              </p>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
} 