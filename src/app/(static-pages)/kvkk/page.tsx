'use client';

import Footer from "@/components/Footer";

export default function KVKKPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Bidpazar.com Ziyaretçi ve Kullanıcılarına Dair Aydınlatma Metni</span>
        </h1>

        <div className="prose prose-lg text-[var(--foreground)] max-w-none">
          <p className="lead text-xl mb-6">
            Bidpazar.com olarak site kullanıcılarımızın ve ziyaretçilerimizin başta temel hak ve özgürlüklerini korumak olmak üzere özel hayatlarına ilişkin gizliliğin korunması, bilgi güvenliğinin sağlanması ve korunması öncelikli prensiplerimiz arasında yer almakta olup, işbu aydınlatma metni, veri sorumlusu sıfatıyla bidpazar.com tarafından 6698 sayılı Kişisel Verilerin Korunması Kanununun 10. maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında hazırlanmıştır.
          </p>

          <p className="mb-6">
            İşbu Kişisel Verilerin Korunması Hakkında Aydınlatma metnini yürürlükteki mevzuatta yapılabilecek değişiklikler çerçevesinde her zaman güncelleme hakkını saklı tutmaktayız.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">İşlenen Kişisel Veriler ve Amaçları</h2>
          <p className="mb-4">
            Bidpazar.com olarak; tarafınıza hizmet sağlamak amacıyla yapmış olduğunuz üyelik başvurunuz da belirttiğiniz muhtemel, ad soyad, tc kimlik no, telefon numarası, e-posta adres bilgileri ve tarafınızca oluşturulacak kullanıcı adı ve şifresi, aşağıdaki koşullar ve kapsamda bidpazar.com tarafından korunmakta, muhafaza edilmekte, kesinlikle paylaşılmamakta, silinmekte ve imha edilebilmektedir.
          </p>

          <div className="bg-[var(--card)] p-5 rounded-lg shadow-sm border border-[var(--border)] my-6">
            <p>
              Kişisel verileriniz bidpazar.com tarafından sunulan ürün ve hizmetlerden ilgili kişileri faydalandırmak için gerekli çalışmaların iş birimlerimiz tarafından yapılması ve ilgili iş süreçlerinin yürütülmesi, ürün ve/veya Hizmetlerin kullanılması ve satış süreçlerinin planlanması ve icrası, operasyon süreçlerinin planlanması ve icrası, satış sonrası destek hizmetleri aktivitelerinin planlanması ve/veya icrası, iş ortakları ve/veya tedarikçilerle olan ilişkilerin yönetimi, verilerin doğru ve güncel olmasının sağlanması ve sunulmakta olan hizmetlerin tedarikinde sürekliliğin sağlanması, iletişim süreçlerinin yürütülmesi, tarafınıza sağlanan hizmetlere ilişkin işlem ve işlerin yürütülmesi, sözleşmesel edimin gereği gibi ifade edilebilmesi, hizmet kalitesinin takibi ve her türlü yasal merci nezdinde yükümlülüklerin yerine getirilmesi amacıyla işlenecektir.
            </p>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Hukuki Dayanaklar</h2>
          <p className="mb-4">
            Kişisel verileriniz, bidpazar.com olarak sunduğumuz hizmetlerin belirlenen yasal çerçevede sunulabilmesi, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 5'inci maddesinin ikinci fıkrasının (c) bendi uyarınca; "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması kaydıyla, sözleşmenin taraflarına ait kişisel verilerin işlenmesinin gerekli olması." ve (f) bendi uyarınca "İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması" işleme şartlarına dayanılmaktadır. Yukarıda yer verilen amaçlar doğrultusunda hukuki sebeplerle ve ilgili mevzuat kapsamında bunlarla sınırlı olmamak kaydıyla toplanabilemektedir.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Kişisel Verilerin Aktarılması</h2>
          <p className="mb-4">
            Bidpazar.com tarafından işlenen yukarıda belirtilen kişisel verileriniz, ilgili mevzuat hükümlerinden kaynaklanan yükümlülüklerin yerine getirilmesi ve bir akdin yerine getirilmesi amacıyla hizmet sözleşmesi ilişkisi içinde olduğumuz çalışma ortaklarımız ile kanunen yetkili kamu kurum ve kuruluşlarına aktarılabilecektir.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">İlgili Kişi Olarak Haklarınız</h2>
          <div className="bg-[var(--card)] p-5 rounded-lg shadow-sm border border-[var(--border)] my-6">
            <p className="mb-4">
              6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 11. maddesine yer alan hükümler çerçevesinde;
            </p>
            <ul className="list-disc pl-6 my-4 space-y-2">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
              <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,</li>
              <li>Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
              <li>Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,</li>
              <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,</li>
              <li>6698 sayılı Kişisel Verilerin Korunması Kanunu'nda öngörülen koşullara uygun olarak kişisel verilerinizin silinmesini veya yok edilmesini isteme,</li>
              <li>Eksik veya yanlış olarak işlenmiş kişisel verilerinizin düzeltildiğinin veya kişisel verilerinizin silindiğinin ya da yok edildiğinin kişisel verilerinizin aktarıldığı 3. kişilere bildirilmesini isteme,</li>
              <li>İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonuç ortaya çıktığına inandığınız hallerde, otomatik yollarla işleme neticesinde çıkan sonuçlara itiraz etme,</li>
              <li>Kişisel verilerinizin Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
            </ul>
            <p>haklarınız bulunmaktadır.</p>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Başvuru Yöntemi</h2>
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