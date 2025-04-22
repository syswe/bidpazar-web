'use client';

import { useState } from 'react';
import Footer from "@/components/Footer";

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
      question: 'Bidpazar nedir?',
      answer: 'Bidpazar, canlı yayınla açık artırma usulü ürünlerin satıldığı bir online müzayede platformdur. Kullanıcılar, çeşitli ürünleri izleyebilir ve gerçek zamanlı olarak teklif verebilirler.',
      category: 'general'
    },
    {
      question: 'Bidpazar\'a nasıl üye olabilirim?',
      answer: 'Bidpazar\'a üye olmak için uygulamayı indirip kayıt olmanız gerekmektedir. Gerekli bilgileri doldurduktan sonra üyeliğiniz onaylanacaktır.',
      category: 'account'
    },
    {
      question: 'Ürünler nasıl satılır?',
      answer: 'Satıcılar, platforma üye olduktan sonra ürünlerini canlı yayında tanıtabilir ve açık artırmaya sunabilirler. Ürünlerinizi eklemek için gerekli bilgileri doldurmanız yeterlidir.',
      category: 'selling'
    },
    {
      question: 'Bidpazar komisyon alıyor mu?',
      answer: 'Bidpazar, satılan ürünlerden herhangi bir komisyon almaz. Satıcıların yayın açma ve gönderi yüklemek için yayın/gönderi paketi satın alması gerekmektedir.',
      category: 'selling'
    },
    {
      question: 'Canlı yayınlara nasıl katılabilirim?',
      answer: 'Üyeliğinizi tamamladıktan sonra, uygulama ve web sitesi üzerinden canlı yayınları takip edebilir ve ilgilendiğiniz ürünler için teklif verebilirsiniz.',
      category: 'auctions'
    },
    {
      question: 'Teklif verme süreci nasıl işler?',
      answer: 'Canlı yayında ürün tanıtıldıktan sonra, belirli bir süre boyunca kullanıcılar teklif verebilir. Süre dolduğunda en yüksek teklifi veren kullanıcı ürünü kazanır. Teklif vermek tamamen ücretsizdir.',
      category: 'auctions'
    },
    {
      question: 'Ödeme yöntemleri nelerdir?',
      answer: 'Bidpazar, kredi kartı, banka havalesi ve çeşitli dijital ödeme yöntemleri ile güvenli ödeme seçenekleri sunmaktadır.',
      category: 'shopping'
    },
    {
      question: 'Ürün teslimatı nasıl yapılır?',
      answer: 'Kazanan kullanıcı, ürünü satın aldıktan sonra satıcı kazanan kullanıcının belirtilen adresine kargo ile teslimatını sağlar. Teslimat süresi, ürünün türüne ve teslimat adresine bağlı olarak değişiklik gösterebilir.',
      category: 'shopping'
    },
    {
      question: 'Ürünler iade edilebilir mi?',
      answer: 'Ürün iade politikası, her ürün için farklılık gösterebilir. Genel olarak, ürünlerin iade koşulları açık artırma sırasında belirtilir. İade işlemleri için müşteri hizmetleri ve satıcı ile iletişime geçmeniz gerekmektedir.',
      category: 'shopping'
    },
    {
      question: 'Bidpazar güvenli mi?',
      answer: 'Bidpazar, kullanıcı güvenliğini ön planda tutarak, güvenli ödeme yöntemleri ve kullanıcı doğrulama süreçleri ile koruma sağlamaktadır.',
      category: 'general'
    },
    {
      question: 'Sorun yaşarsam ne yapmalıyım?',
      answer: 'Herhangi bir sorunla karşılaştığınızda, müşteri hizmetleri ile iletişime geçebilir veya platform üzerindeki destek bölümünü kullanarak yardım alabilirsiniz.',
      category: 'general'
    },
    {
      question: 'Teklifimi geri çekebilir miyim?',
      answer: 'Açık artırma süreci devam ederken teklifinizi geri çekemezsiniz. Ancak, açık artırma sona erdiğinde ve henüz ödeme yapmadıysanız, isteğinize bağlı olarak işlemi iptal edebilirsiniz.',
      category: 'auctions'
    },
    {
      question: 'Canlı yayınlarda hangi tür ürünler satılmaktadır?',
      answer: 'Bidpazar\'da elektronik, moda, ev eşyaları, oyuncaklar ve daha birçok kategoride ürünler satılmaktadır. Her yayında farklı ürünler sunulmaktadır.',
      category: 'auctions'
    },
    {
      question: 'Hangi saatlerde canlı yayınlar yapılıyor?',
      answer: 'Canlı yayın saatleri, platformda önceden duyurulmaktadır. Kullanıcılar, uygulama üzerinden yayın takvimini takip edebilirler.',
      category: 'auctions'
    },
    {
      question: 'Ürünler hakkında daha fazla bilgi alabilir miyim?',
      answer: 'Canlı yayın sırasında ürün hakkında daha fazla bilgi almak için yayıncıyla etkileşime geçebilir veya uygulama üzerindeki ürün detaylarını inceleyebilirsiniz.',
      category: 'shopping'
    },
    {
      question: 'Hediye veya kampanya var mı?',
      answer: 'Bidpazar, zaman zaman özel kampanyalar ve hediyeler sunmaktadır. Bu tür fırsatları takip etmek için uygulama bildirimlerini açabilirsiniz.',
      category: 'general'
    }
  ];

  const categories = [
    { id: 'all', name: 'Tümü' },
    { id: 'general', name: 'Genel Bilgiler' },
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
    <>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
          <span className="border-b-4 border-[var(--accent)] pb-2">Sıkça Sorulan Sorular</span>
        </h1>

        <div className="mb-8 bg-[var(--muted)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3 text-[var(--foreground)]">Bidpazar Nedir?</h2>
          <p className="text-[var(--foreground)]">
            Bidpazar, canlı yayınla açık artırma usulü ürünlerin satıldığı yenilikçi bir online müzayede platformdur. Kullanıcılar, çeşitli ürünleri gerçek zamanlı olarak izleyebilir ve teklif verebilirler. Bu sistem, hem alıcılar hem de satıcılar için dinamik ve etkileşimli bir alışveriş deneyimi sunar.
          </p>
        </div>

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
      <Footer />
    </>
  );
} 