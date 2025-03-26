export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
        <span className="border-b-4 border-[var(--accent)] pb-2">Gizlilik Politikası</span>
      </h1>

      <div className="prose prose-lg text-[var(--foreground)] max-w-none">
        <p className="lead text-xl mb-6">
          Son güncelleme: 1 Ocak 2025
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Giriş</h2>
          <p>
            Bidpazar olarak gizliliğinize saygı duyuyor ve kişisel verilerinizin korunmasına büyük önem veriyoruz.
            Bu Gizlilik Politikası, platformumuzu (web sitesi ve mobil uygulama) kullanırken hangi bilgileri topladığımızı,
            bu bilgileri nasıl kullandığımızı ve koruduğumuzu açıklamaktadır.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Topladığımız Bilgiler</h2>

          <h3 className="text-xl font-medium mt-6 mb-3">Hesap Bilgileri</h3>
          <p>
            Kayıt olurken ve hesabınızı kullanırken aşağıdaki bilgileri toplayabiliriz:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li>Ad, soyad, kullanıcı adı</li>
            <li>E-posta adresi ve telefon numarası</li>
            <li>Şifre (şifreli olarak saklanır)</li>
            <li>Doğum tarihi</li>
            <li>Profil fotoğrafı (isteğe bağlı)</li>
          </ul>

          <h3 className="text-xl font-medium mt-6 mb-3">Kimlik Doğrulama Bilgileri</h3>
          <p>
            Platformda tam olarak alışveriş yapabilmek için bazı kimlik doğrulama bilgilerini talep edebiliriz:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li>Kimlik belgesi bilgileri</li>
            <li>Adres bilgileri</li>
            <li>Vergi kimlik numarası (satıcılar için)</li>
          </ul>

          <h3 className="text-xl font-medium mt-6 mb-3">Kullanım Bilgileri</h3>
          <p>
            Platformumuzu nasıl kullandığınıza dair aşağıdaki bilgileri otomatik olarak toplayabiliriz:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li>IP adresi ve cihaz bilgileri</li>
            <li>Tarayıcı türü ve işletim sistemi</li>
            <li>Ziyaret ettiğiniz sayfalar ve tıkladığınız bağlantılar</li>
            <li>Platformda geçirdiğiniz süre</li>
            <li>Arama sorguları ve görüntülediğiniz ürünler</li>
          </ul>

          <h3 className="text-xl font-medium mt-6 mb-3">Ödeme Bilgileri</h3>
          <p>
            Alışveriş yaparken ödeme bilgilerinizi işlemek için güvenli ödeme hizmet sağlayıcılarımızı kullanırız.
            Kredi kartı bilgilerinizi doğrudan biz saklamayız, ancak ödeme işlemleri için gerekli olan aşağıdaki
            bilgilere erişimimiz olabilir:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li>Ödeme yöntemi türü</li>
            <li>Ödeme işlem geçmişi</li>
            <li>Fatura adresi</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Bilgilerinizi Nasıl Kullanıyoruz</h2>
          <p>
            Topladığımız bilgileri aşağıdaki amaçlar için kullanırız:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li>Hesabınızı oluşturmak ve yönetmek</li>
            <li>Platformu kullanmanızı sağlamak ve hizmetlerimizi sunmak</li>
            <li>Alışveriş işlemlerini ve ödemeleri işlemek</li>
            <li>Müşteri desteği sağlamak</li>
            <li>Platformu iyileştirmek ve kullanıcı deneyimini geliştirmek</li>
            <li>Güvenliği sağlamak ve dolandırıcılığı önlemek</li>
            <li>Size özel teklifler ve öneriler sunmak</li>
            <li>Yasal yükümlülüklerimizi yerine getirmek</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Bilgilerinizi Kiminle Paylaşıyoruz</h2>
          <p>
            Kişisel bilgilerinizi aşağıdaki durumlar dışında üçüncü taraflarla paylaşmayız:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li><strong>Hizmet Sağlayıcılar:</strong> Ödeme işlemleri, kargo hizmetleri, müşteri desteği gibi hizmetleri
              sağlayan güvenilir iş ortaklarımızla bilgilerinizi paylaşabiliriz.</li>
            <li><strong>Alım-Satım İşlemleri:</strong> Bir alışveriş işlemi gerçekleştirdiğinizde, işlemin tamamlanması için
              gerekli bilgiler alıcı veya satıcı ile paylaşılabilir.</li>
            <li><strong>Yasal Gereklilikler:</strong> Yasal bir yükümlülük, mahkeme kararı veya resmi bir talep olduğunda
              bilgilerinizi paylaşmak zorunda kalabiliriz.</li>
            <li><strong>İş Ortakları:</strong> Sizin için daha iyi hizmetler sunmak amacıyla seçili iş ortaklarımızla
              bilgilerinizi paylaşabiliriz, ancak bu her zaman sizin onayınıza tabidir.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Çerezler ve Benzer Teknolojiler</h2>
          <p>
            Platformumuzda çerezler ve benzer teknolojiler kullanarak deneyiminizi kişiselleştiriyor, platformu nasıl
            kullandığınızı anlıyor ve hizmetlerimizi iyileştiriyoruz. Bu teknolojilerin nasıl kullanıldığı hakkında
            detaylı bilgi için Çerez Politikamızı inceleyebilirsiniz.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Veri Güvenliği</h2>
          <p>
            Kişisel verilerinizin güvenliğini sağlamak için endüstri standardı güvenlik önlemleri kullanıyoruz. Bu önlemler
            arasında SSL şifreleme, güvenlik duvarları, veri şifreleme, fiziksel erişim kontrolleri ve düzenli güvenlik
            denetimleri bulunmaktadır. Ancak, hiçbir internet tabanlı sistem veya veri iletimi %100 güvenli olamaz. Bu nedenle,
            kişisel bilgilerinizin tam güvenliğini garanti edemeyiz.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Haklarınız</h2>
          <p>
            Kişisel verilerinizle ilgili olarak aşağıdaki haklara sahipsiniz:
          </p>
          <ul className="list-disc pl-6 my-4 space-y-2">
            <li>Verilerinize erişme ve bir kopyasını alma hakkı</li>
            <li>Yanlış veya eksik bilgilerin düzeltilmesini talep etme hakkı</li>
            <li>Belirli durumlarda verilerinizin silinmesini talep etme hakkı</li>
            <li>Verilerinizin işlenmesine itiraz etme hakkı</li>
            <li>Veri taşınabilirliği hakkı</li>
            <li>Vermiş olduğunuz onayı geri çekme hakkı</li>
          </ul>
          <p>
            Bu haklarınızı kullanmak için <a href="mailto:privacy@Bidpazar.com" className="text-[var(--primary)] hover:underline">privacy@Bidpazar.com</a> adresinden bizimle iletişime geçebilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Değişiklikler</h2>
          <p>
            Bu Gizlilik Politikasını zaman zaman güncelleyebiliriz. Önemli değişiklikler olduğunda, size e-posta
            yoluyla veya platformda bir bildirim göstererek bilgilendireceğiz. Değişikliklerden sonra platformu kullanmaya
            devam etmeniz, güncellenmiş politikayı kabul ettiğiniz anlamına gelir.
          </p>
          <p className="mt-4">
            Bu gizlilik politikası hakkında herhangi bir sorunuz varsa, lütfen
            <a href="mailto:privacy@Bidpazar.com" className="text-[var(--primary)] hover:underline ml-1">privacy@Bidpazar.com</a>
            adresinden bizimle iletişime geçin.
          </p>
        </section>
      </div>
    </div>
  );
} 