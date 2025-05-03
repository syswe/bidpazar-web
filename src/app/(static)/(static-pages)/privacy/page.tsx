'use client';

import Footer from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">BİDPAZAR GİZLİLİK SÖZLEŞMESİ</span>
        </h1>

        <div className="prose prose-lg text-[var(--foreground)] max-w-none">
          <p className="lead text-xl mb-6">
            Son Güncelleme Tarihi: 14.04.2025
          </p>

          <p className="mb-6">
            Bidpazar olarak, kullanıcılarımızın ve ziyaretçilerimizin gizliliğine büyük önem veriyoruz. Bu Gizlilik Sözleşmesi, bidpazar.com (bundan sonra "Platform" olarak anılacaktır) üzerinden sunulan hizmetlerimiz sırasında topladığımız kişisel verilerinizi nasıl kullandığımızı, paylaştığımızı ve koruduğumuzu açıklamaktadır. Platformumuzu kullanarak bu Gizlilik Sözleşmesi'nin şartlarını kabul etmiş sayılırsınız.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Topladığımız Kişisel Veriler</h2>
            <p>Platformumuzu kullandığınızda aşağıdaki türde kişisel verileri toplayabiliriz:</p>
            <ul className="list-disc pl-6 my-4 space-y-2">
              <li><strong>Kimlik Bilgileri:</strong> Adınız, soyadınız, kullanıcı adınız, doğum tarihiniz (üyelik başvurunuzda belirttiğiniz bilgiler).</li>
              <li><strong>İletişim Bilgileri:</strong> E-posta adresiniz, telefon numaranız.</li>
              <li><strong>İşlem Bilgileri:</strong> Yaptığınız teklifler, satın aldığınız ürünler, satış geçmişiniz.</li>
              <li><strong>Kullanım Bilgileri:</strong> Platformu nasıl kullandığınıza dair bilgiler.</li>
              <li><strong>Teknik Bilgiler:</strong> IP adresiniz, cihaz türünüz, tarayıcı türünüz, çerezler ve benzeri teknolojiler aracılığıyla toplanan bilgiler.</li>
              <li><strong>Profil Bilgileri:</strong> Oluşturacağınız kullanıcı adı ve şifresi.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Kişisel Verilerinizi Nasıl Kullanıyoruz?</h2>
            <p>Topladığımız kişisel verileri aşağıdaki amaçlarla kullanabiliriz:</p>
            <ul className="list-disc pl-6 my-4 space-y-2">
              <li><strong>Hizmet Sunumu:</strong> Platformun temel işlevlerini (açık artırmaları yönetmek, teklifleri işlemek, satışları gerçekleştirmek) sağlamak.</li>
              <li><strong>Kullanıcı Yönetimi:</strong> Hesaplarınızı oluşturmak, yönetmek ve doğrulamak.</li>
              <li><strong>İletişim:</strong> Sizinle açık artırmalar, ödemeler, gönderiler ve Platform güncellemeleri hakkında iletişim kurmak.</li>
              <li><strong>Ürün/Hizmetlerin Sunulması:</strong> Sunulan ürün ve hizmetlerden ilgili kişileri faydalandırmak.</li>
              <li><strong>Satış Süreçleri:</strong> Ürün ve/veya Hizmetlerin kullanılması ve satış süreçlerinin planlanması ve icrası.</li>
              <li><strong>Operasyonel Süreçler:</strong> Operasyon süreçlerinin planlanması ve icrası.</li>
              <li><strong>Satış Sonrası Destek:</strong> Satış sonrası destek hizmetleri aktivitelerinin planlanması ve/veya icrası.</li>
              <li><strong>İş Ortakları/Tedarikçiler:</strong> İş ortakları ve/veya tedarikçilerle olan ilişkilerin yönetimi.</li>
              <li><strong>Veri Güncelliği:</strong> Verilerin doğru ve güncel olmasının sağlanması.</li>
              <li><strong>Hizmet Sürekliliği:</strong> Sunulmakta olan hizmetlerin tedarikinde sürekliliğin sağlanması.</li>
              <li><strong>İletişim Süreçleri:</strong> İletişim süreçlerinin yürütülmesi.</li>
              <li><strong>İşlem ve İşlerin Yürütülmesi:</strong> Tarafınıza sağlanan hizmetlere ilişkin işlem ve işlerin yürütülmesi.</li>
              <li><strong>Hizmet Kalitesi:</strong> Hizmet kalitesinin takibi.</li>
              <li><strong>Yasal Yükümlülükler:</strong> Her türlü yasal merci nezdinde yükümlülüklerin yerine getirilmesi.</li>
              <li><strong>Güvenlik:</strong> İnternet sayfasına sonradan gelen isteklerin güvenilir olup olmadığını anlamak.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Kişisel Verilerinizi Nasıl Paylaşıyoruz?</h2>
            <p>Kişisel verilerinizi aşağıdaki durumlar ve taraflarla paylaşabiliriz:</p>
            <ul className="list-disc pl-6 my-4 space-y-2">
              <li><strong>Çalışma Ortakları:</strong> Hizmet sözleşmesi ilişkisi içinde olduğumuz çalışma ortaklarımız ile.</li>
              <li><strong>Yetkili Kamu Kurum ve Kuruluşları:</strong> İlgili mevzuat hükümlerinden kaynaklanan yükümlülüklerin yerine getirilmesi ve bir akdin yerine getirilmesi amacıyla kanunen yetkili kamu kurum ve kuruluşlarına aktarılabilecektir.</li>
              <li><strong>Diğer Kullanıcılar:</strong> Açık artırmalara katılan diğer kullanıcılar, yaptığınız teklifleri ve kazandığınız ürünleri görebilir. Satıcılar, alıcılarla iletişim kurmak için belirli bilgilerinize (örneğin, teslimat adresi) erişebilir.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Çerezler ve Benzeri Teknolojiler</h2>
            <p>
              Platformumuz, kullanıcı deneyimini iyileştirmek ve hizmetlerimizi kişiselleştirmek için çerezler kullanmaktadır. İnternet sitemizde yalnızca hizmetin sağlanması için kesinlikle gerekli olan birinci taraf oturum ve kalıcı çerezler kullanılmaktadır. Çerezler hakkında daha fazla bilgi için lütfen Çerez Aydınlatma Metnimizi inceleyin.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Kişisel Verilerinizin İşlenmesinin Hukuki Sebebi</h2>
            <p>
              Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (KVKK) 5'inci maddesinin ikinci fıkrasının (c) bendi uyarınca "bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması kaydıyla, sözleşmenin taraflarına ait kişisel verilerin işlenmesinin gerekli olması" ve (f) bendi uyarınca "İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması" işleme şartlarına dayanmaktadır. Ayrıca, çerezler yoluyla kişisel verilerin işlenmesinde de KVKK'nın 5'inci maddesinin ikinci fıkrasının (f) bendi dayanak alınmaktadır.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Kişisel Verilerinizi Nasıl Koruyoruz?</h2>
            <p>
              Bidpazar.com olarak, site kullanıcılarımızın ve ziyaretçilerimizin başta temel hak ve özgürlüklerini korumak olmak üzere özel hayatlarına ilişkin gizliliğin korunması, bilgi güvenliğinin sağlanması ve korunması öncelikli prensiplerimiz arasında yer almaktadır. Kişisel verilerinizin güvenliğini sağlamak için gerekli teknik ve organizasyonel önlemleri almaktayız.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Gizlilik Sözleşmesinde Yapılacak Değişiklikler</h2>
            <p>
              İşbu Kişisel Verilerin Korunması Hakkında Aydınlatma metnini, yani bu Gizlilik Sözleşmesini, yürürlükteki mevzuatta yapılabilecek değişiklikler çerçevesinde her zaman güncelleme hakkını saklı tutmaktayız. Herhangi bir değişiklik yapıldığında, güncellenmiş sözleşmeyi Platformumuzda yayınlayacak ve yürürlük tarihini belirteceğiz. Değişikliklerden haberdar olmak için bu sayfayı düzenli olarak kontrol etmeniz önemlidir. Önemli değişiklikler söz konusu olduğunda, sizi e-posta veya Platform üzerinden bilgilendirebiliriz.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
} 