export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--foreground)]">
        <span className="border-b-4 border-[var(--accent)] pb-2">Bidpazar Nedir?</span>
      </h1>

      <div className="prose prose-lg text-[var(--foreground)] max-w-none">
        <p className="lead text-xl mb-6">
          Bidpazar, Türkiye'nin ilk ve en büyük antika ve koleksiyon ürünleri için özel olarak tasarlanmış
          çevrimiçi müzayede ve alışveriş platformudur.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Vizyonumuz</h2>
        <p>
          Bidpazar olarak antika ve koleksiyon severleri güvenilir bir platformda buluşturmayı ve
          Türkiye'nin zengin kültürel mirasını korumayı amaçlıyoruz. Platformumuz, nadir bulunan
          parçaları korumak ve gelecek nesillere aktarmak isteyen koleksiyoncular için ideal bir ortam sunmaktadır.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Nasıl Çalışır?</h2>
        <p>
          Bidpazar'da iki farklı şekilde alışveriş yapabilirsiniz:
        </p>
        <ul className="list-disc pl-6 my-4 space-y-2">
          <li>
            <strong>Sabit Fiyatlı Ürünler:</strong> Beğendiğiniz ürünü hemen satın alabilirsiniz.
          </li>
          <li>
            <strong>Canlı Müzayedeler:</strong> Gerçek zamanlı olarak teklif vererek ürünleri kazanabilirsiniz.
          </li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-4">Neden Bidpazar?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          <div className="bg-[var(--card)] p-4 rounded-lg shadow-sm border border-[var(--border)]">
            <h3 className="font-semibold text-lg mb-2">Güvenilirlik</h3>
            <p>Tüm satıcılar ve ürünler detaylı bir inceleme sürecinden geçirilir.</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg shadow-sm border border-[var(--border)]">
            <h3 className="font-semibold text-lg mb-2">Uzmanlık</h3>
            <p>Alanında uzman ekibimiz ile ürünlerin değerlemesini ve doğruluğunu kontrol ediyoruz.</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg shadow-sm border border-[var(--border)]">
            <h3 className="font-semibold text-lg mb-2">Geniş Katalog</h3>
            <p>Osmanlı'dan Cumhuriyet'e, vintage parçalardan modern koleksiyon ürünlerine kadar geniş bir yelpazeye sahibiz.</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg shadow-sm border border-[var(--border)]">
            <h3 className="font-semibold text-lg mb-2">Canlı Müzayedeler</h3>
            <p>Gerçek zamanlı müzayedelerimizle evden çıkmadan koleksiyonunuzu genişletebilirsiniz.</p>
          </div>
        </div>

        <p className="mt-8">
          Siz de bu büyüleyici dünyada yerinizi almak ve nadide parçalara sahip olmak istiyorsanız, hemen üye olun
          ve Bidpazar ayrıcalıklarından yararlanmaya başlayın.
        </p>
      </div>
    </div>
  );
} 