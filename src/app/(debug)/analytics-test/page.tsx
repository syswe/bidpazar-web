'use client';

import { useState } from 'react';
import { analytics, useGoogleAnalytics } from '@/components/GoogleTagManager';

export default function AnalyticsTestPage() {
  const [testData, setTestData] = useState({
    productId: 'test-prod-123',
    productName: 'Test Ürün',
    price: 1000,
    category: 'Test Kategori'
  });

  const { trackEvent, trackCustomDimension } = useGoogleAnalytics();

  const testAnalytics = () => {
    // Test basic analytics functions
    analytics.trackRegistration('email', 'test-user-123');
    analytics.trackLogin('email', 'test-user-123');
    analytics.trackProductView(
      testData.productId,
      testData.productName,
      testData.category,
      testData.price
    );
    analytics.trackAddToCart(
      testData.productId,
      testData.productName,
      testData.price,
      1
    );
    analytics.trackSearch('test arama', 5);
    analytics.trackLiveStreamView('test-stream-123', 'Test Yayını');
    analytics.trackBidPlacement('test-listing-123', 'Test Ürün', 1500);

    // Test custom event
    trackEvent('test_event', {
      event_category: 'Testing',
      event_label: 'Analytics Test',
      custom_parameters: {
        test_id: 'test-123',
        timestamp: new Date().toISOString()
      }
    });

    // Test custom dimension
    trackCustomDimension(1, 'test_user');
    trackCustomDimension(2, 'test_device');

    console.log('Analytics test events sent! Check Google Analytics dashboard.');
  };

  const testCustomEvent = () => {
    trackEvent('custom_test_event', {
      event_category: 'Custom Testing',
      event_label: 'Manual Test',
      value: 100,
      currency: 'TRY',
      custom_data: {
        user_id: 'test-user',
        action: 'button_click',
        page: 'analytics-test'
      }
    });

    console.log('Custom event sent!');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Google Analytics Test Sayfası</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-2">Test Bilgileri</h2>
        <p className="text-gray-700">
          Bu sayfa Google Analytics entegrasyonunu test etmek için oluşturulmuştur.
          Test butonlarına tıkladığınızda çeşitli analytics event'leri gönderilir.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Otomatik Test Event'leri</h3>
          <button
            onClick={testAnalytics}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tüm Analytics Event'lerini Test Et
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Kayıt, giriş, ürün görüntüleme, sepete ekleme, arama, canlı yayın ve teklif verme event'lerini test eder.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Custom Event Test</h3>
          <button
            onClick={testCustomEvent}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            Custom Event Gönder
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Özel parametrelerle custom event gönderir.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Test Verileri</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ürün ID
            </label>
            <input
              type="text"
              value={testData.productId}
              onChange={(e) => setTestData(prev => ({ ...prev, productId: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ürün Adı
            </label>
            <input
              type="text"
              value={testData.productName}
              onChange={(e) => setTestData(prev => ({ ...prev, productName: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fiyat
            </label>
            <input
              type="number"
              value={testData.price}
              onChange={(e) => setTestData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategori
            </label>
            <input
              type="text"
              value={testData.category}
              onChange={(e) => setTestData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <h3 className="text-lg font-semibold mb-2">Test Sonuçları</h3>
        <p className="text-gray-700">
          Test event'lerini gönderdikten sonra:
        </p>
        <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
          <li>Browser console'da "Analytics test events sent!" mesajını görmelisiniz</li>
          <li>Google Analytics real-time dashboard'da event'leri görebilirsiniz</li>
          <li>Google Tag Manager preview mode'da event'leri takip edebilirsiniz</li>
          <li>Network sekmesinde GTM script'inin yüklendiğini kontrol edin</li>
        </ul>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
        <h3 className="text-lg font-semibold mb-2">Debug Bilgileri</h3>
        <p className="text-gray-700">
          Console'da aşağıdaki global değişkenleri kontrol edin:
        </p>
        <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
          <li><code>window.gtag</code> - Google Analytics fonksiyonu</li>
          <li><code>window.dataLayer</code> - Data layer array'i</li>
          <li><code>process.env.NEXT_PUBLIC_GTM_CONTAINER_ID</code> - GTM Container ID</li>
        </ul>
      </div>
    </div>
  );
}
