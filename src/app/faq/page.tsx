'use client';

import { useState } from 'react';

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);

  const faqs: FAQ[] = [
    {
      question: 'Bidpazar\'da nasıl hesap oluşturabilirim?',
      answer: 'Bidpazar\'da hesap oluşturmak için ana sayfanın üst kısmında bulunan "Giriş Yap" butonuna tıklayın, ardından "Hesap Oluştur" seçeneğini seçin. E-posta adresiniz, adınız ve belirlediğiniz şifre ile kayıt olabilirsiniz. Kayıt sonrası e-posta adresinize gelen doğrulama bağlantısına tıklayarak hesabınızı aktifleştirebilirsiniz.',
      category: 'account'
    },
    {
      question: 'Profilimi nasıl doğrularım?',
      answer: 'Profil doğrulama işlemi için "Hesabım" sayfasına gidin ve "Profil Doğrulama" bölümünü seçin. Kimlik bilgilerinizi ve telefon numaranızı girerek doğrulama sürecini başlatabilirsiniz. Kimlik doğrulama genellikle 24 saat içinde tamamlanır ve size e-posta ile bildirilir.',
      category: 'account'
    },
    {
      question: 'Şifremi unuttum, ne yapmalıyım?',
      answer: 'Şifrenizi unuttuğunuz takdirde "Giriş Yap" sayfasında bulunan "Şifremi Unuttum" bağlantısına tıklayın. E-posta adresinizi girdikten sonra, şifre sıfırlama bağlantısı e-posta adresinize gönderilecektir. Bu bağlantı üzerinden yeni şifrenizi belirleyebilirsiniz.',
      category: 'account'
    },
    {
      question: 'Bidpazar\'da nasıl alışveriş yapabilirim?',
      answer: 'Bidpazar\'da alışveriş yapmak için ürün sayfasından "Sepete Ekle" butonuna tıklayabilir ya da "Hemen Al" seçeneği ile doğrudan satın alma işlemine geçebilirsiniz. Seçtiğiniz ödeme yöntemi ile ödemenizi tamamladıktan sonra, siparişiniz onaylanır ve kargoya verilir.',
      category: 'shopping'
    },
    {
      question: 'Hangi ödeme yöntemlerini kullanabilirim?',
      answer: 'Bidpazar\'da kredi kartı, banka kartı, havale/EFT ve Bidpazar bakiyesi ile ödeme yapabilirsiniz. Tüm kredi kartı işlemleri 256-bit SSL şifreleme ile güvenle gerçekleştirilir.',
      category: 'shopping'
    },
    {
      question: 'Sipariş durumumu nasıl takip edebilirim?',
      answer: 'Siparişinizin durumunu "Hesabım" > "Siparişlerim" bölümünden takip edebilirsiniz. Ayrıca, siparişiniz kargoya verildiğinde size bir bildirim e-postası ve SMS gönderilir. E-postada bulunan kargo takip numarası ile kargo firmasının web sitesinden de takip yapabilirsiniz.',
      category: 'shopping'
    },
    {
      question: 'Canlı müzayedelere nasıl katılabilirim?',
      answer: 'Canlı müzayedelere katılmak için öncelikle üye olmalı ve profilinizi doğrulamalısınız. Ardından "Canlı Müzayedeler" sayfasından aktif müzayedeleri görebilir ve katılmak istediğiniz müzayedeye tıklayabilirsiniz. Müzayede başladığında, teklif vermek için belirtilen alana teklifinizi yazıp "Teklif Ver" butonuna tıklayabilirsiniz.',
      category: 'auctions'
    },
    {
      question: 'Teklif verdiğim ürünün müzayedesi ne zaman sonlanır?',
      answer: 'Müzayedeler genellikle belirtilen bitiş saatinde sonlanır. Ancak, son 5 dakika içinde yeni bir teklif gelirse, müzayede süresi otomatik olarak 5 dakika daha uzatılır. Bu, tüm katılımcılara adil bir şekilde teklif verme fırsatı sağlar.',
      category: 'auctions'
    },
    {
      question: 'Müzayedede kazandığım ürünü nasıl öderim?',
      answer: 'Müzayedede kazandığınız ürün için size bir e-posta bildirim gönderilir. "Hesabım" > "Kazanılan Müzayedelerim" bölümünden ürünü görebilir ve ödeme yapabilirsiniz. Ödeme için 48 saat süreniz vardır. Bu süre içinde ödeme yapılmazsa, ürün bir sonraki en yüksek teklif veren kişiye sunulur.',
      category: 'auctions'
    },
    {
      question: 'Bidpazar\'da nasıl satış yapabilirim?',
      answer: 'Bidpazar\'da satış yapmak için öncelikle "Satıcı Hesabı" oluşturmalısınız. "Hesabım" sayfasından "Satıcı Ol" seçeneğine tıklayıp gerekli bilgileri doldurarak satıcı başvurusu yapabilirsiniz. Başvurunuz onaylandıktan sonra, "Ürün Ekle" butonunu kullanarak ürünlerinizi listeleyebilirsiniz.',
      category: 'selling'
    },
    {
      question: 'Kendi müzayedemi nasıl düzenleyebilirim?',
      answer: 'Kendi müzayedenizi düzenlemek için önce satıcı hesabınızı oluşturmalı ve doğrulamalısınız. Ardından "Satıcı Paneli" > "Müzayede Oluştur" seçeneğini kullanarak müzayedenizi planlayabilirsiniz. Müzayede için ürün detayları, başlangıç fiyatı, tarih ve saat belirleyebilirsiniz. Müzayedeniz Bidpazar ekibi tarafından onaylandıktan sonra yayınlanır.',
      category: 'selling'
    },
    {
      question: 'Satışlarımdan ne kadar komisyon ödeyeceğim?',
      answer: 'Bidpazar, sabit fiyatlı ürün satışlarında %8, müzayede satışlarında ise %10 komisyon almaktadır. Komisyonlar, satış başarıyla tamamlandığında ve ödeme alındığında hesaplanır. Ayrıca, premium satıcı programımıza katılarak daha düşük komisyon oranlarından yararlanabilirsiniz.',
      category: 'selling'
    }
  ];

  const categories = [
    { id: 'all', name: 'Tümü' },
    { id: 'account', name: 'Hesap İşlemleri' },
    { id: 'shopping', name: 'Alışveriş' },
    { id: 'auctions', name: 'Müzayedeler' },
    { id: 'selling', name: 'Satış Yapma' }
  ];

  const filteredFaqs = activeCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === activeCategory);

  const toggleQuestion = (index: number) => {
    setActiveQuestion(activeQuestion === index ? null : index);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
        <span className="border-b-4 border-[var(--accent)] pb-2">Sıkça Sorulan Sorular</span>
      </h1>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === category.id
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]'
              }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* FAQ accordion */}
      <div className="space-y-4">
        {filteredFaqs.map((faq, index) => (
          <div key={index} className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleQuestion(index)}
              className="w-full flex justify-between items-center p-4 text-left bg-[var(--background)] hover:bg-[var(--muted)] transition-colors"
            >
              <span className="font-medium text-[var(--foreground)]">{faq.question}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 text-[var(--foreground)] transition-transform ${activeQuestion === index ? 'transform rotate-180' : ''
                  }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {activeQuestion === index && (
              <div className="p-4 bg-[var(--muted)] border-t border-[var(--border)]">
                <p className="text-[var(--foreground)]">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact section */}
      <div className="mt-12 bg-[var(--background)] border border-[var(--border)] rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">Sorunuza cevap bulamadınız mı?</h2>
        <p className="mb-6">Müşteri hizmetlerimiz size yardımcı olmaktan memnuniyet duyacaktır.</p>
        <a
          href="/contact"
          className="inline-block bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-medium py-2 px-6 rounded-md transition-colors"
        >
          Bize Ulaşın
        </a>
      </div>
    </div>
  );
} 