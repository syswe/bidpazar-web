# Google Analytics & Tag Manager Entegrasyonu

Bu dokümantasyon, BidPazar projesinde Google Analytics ve Google Tag Manager entegrasyonunun nasıl kullanılacağını açıklar.

## Kurulum

### 1. Environment Variables

`.env` dosyasına aşağıdaki değişkenleri ekleyin:

```env
# Google Tag Manager Container ID (Client-side accessible)
NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX

# Google Analytics Measurement ID (Server-side only, optional)
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2. Google Tag Manager Kurulumu

1. [Google Tag Manager](https://tagmanager.google.com/) hesabı oluşturun
2. Yeni bir container oluşturun
3. Container ID'yi `NEXT_PUBLIC_GTM_CONTAINER_ID` olarak `.env` dosyasına ekleyin
4. Google Analytics 4 tag'ini ekleyin

## Kullanım

### Otomatik Sayfa Takibi

Sayfa geçişleri otomatik olarak takip edilir. Herhangi bir ek kod yazmanıza gerek yoktur.

### Manuel Event Tracking

```typescript
import { analytics } from '../components/GoogleTagManager';

// Kullanıcı kaydı
analytics.trackRegistration('email', 'user123');

// Kullanıcı girişi
analytics.trackLogin('email', 'user123');

// Ürün görüntüleme
analytics.trackProductView('prod123', 'iPhone 15', 'Elektronik', 25000);

// Sepete ekleme
analytics.trackAddToCart('prod123', 'iPhone 15', 25000, 1);

// Satın alma
analytics.trackPurchase('txn123', 25000, [{
  item_id: 'prod123',
  item_name: 'iPhone 15',
  price: 25000,
  quantity: 1,
  category: 'Elektronik'
}]);

// Canlı yayın izleme
analytics.trackLiveStreamView('stream123', 'Antika Müzayedesi', 3600);

// Teklif verme
analytics.trackBidPlacement('listing123', 'Antika Vazo', 5000);

// Arama
analytics.trackSearch('antika vazo', 25);
```

### Custom Hook Kullanımı

```typescript
import { useGoogleAnalytics } from '../components/GoogleTagManager';

function MyComponent() {
  const { trackEvent, trackPageView, trackCustomDimension } = useGoogleAnalytics();

  const handleCustomAction = () => {
    // Custom event tracking
    trackEvent('custom_action', {
      action_type: 'button_click',
      button_name: 'submit',
      page: 'checkout'
    });

    // Custom dimension tracking
    trackCustomDimension(1, 'premium_user');
  };

  return (
    <button onClick={handleCustomAction}>
      Custom Action
    </button>
  );
}
```

### Custom Event Tracking

```typescript
import { useGoogleAnalytics } from '../components/GoogleTagManager';

function LiveStreamComponent() {
  const { trackEvent } = useGoogleAnalytics();

  const handleStreamStart = () => {
    trackEvent('stream_started', {
      stream_id: 'stream123',
      stream_title: 'Antika Müzayedesi',
      streamer_id: 'user456',
      category: 'Antika'
    });
  };

  const handleBidPlaced = (bidAmount: number) => {
    trackEvent('bid_placed', {
      listing_id: 'listing123',
      product_name: 'Antika Vazo',
      bid_amount: bidAmount,
      currency: 'TRY',
      user_id: 'user789'
    });
  };

  return (
    <div>
      <button onClick={handleStreamStart}>Start Stream</button>
      <button onClick={() => handleBidPlaced(5000)}>Place Bid</button>
    </div>
  );
}
```

## Event Kategorileri

### E-ticaret Events
- `view_item` - Ürün görüntüleme
- `add_to_cart` - Sepete ekleme
- `purchase` - Satın alma
- `view_cart` - Sepet görüntüleme
- `remove_from_cart` - Sepetten çıkarma

### Kullanıcı Engagement Events
- `sign_up` - Kayıt olma
- `login` - Giriş yapma
- `logout` - Çıkış yapma
- `search` - Arama yapma

### Video/Live Stream Events
- `video_start` - Video başlatma
- `video_progress` - Video ilerleme
- `video_complete` - Video tamamlama

### Custom Events
- `bid_placed` - Teklif verme
- `stream_started` - Yayın başlatma
- `auction_ended` - Müzayede sona erme
- `product_added` - Ürün ekleme

## Custom Dimensions

Google Analytics'te custom dimensions kullanarak ek veriler toplayabilirsiniz:

```typescript
const { trackCustomDimension } = useGoogleAnalytics();

// User type tracking
trackCustomDimension(1, 'premium_user');

// Device type tracking
trackCustomDimension(2, 'mobile');

// User location tracking
trackCustomDimension(3, 'Istanbul');
```

## Debug Mode

Development ortamında debug modunu aktifleştirmek için:

```env
DEBUG_ANALYTICS=true
```

## Production Deployment

Docker ile deployment yaparken:

```dockerfile
# Google Analytics & Tag Manager
ENV NEXT_PUBLIC_GTM_CONTAINER_ID="GTM-XXXXXXX"
ENV GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

## Güvenlik

- `NEXT_PUBLIC_GTM_CONTAINER_ID` client-side'da kullanılır (güvenli)
- `GA_MEASUREMENT_ID` sadece server-side'da kullanılır
- Hassas bilgiler (API keys, secrets) asla client-side'a expose edilmez

## Troubleshooting

### GTM Script Yüklenmiyor
- Container ID'nin doğru olduğundan emin olun
- Network sekmesinde GTM script'inin yüklenip yüklenmediğini kontrol edin
- Ad blocker'ları devre dışı bırakın

### Events Görünmüyor
- Google Tag Manager'da tag'lerin doğru yapılandırıldığından emin olun
- Google Analytics'te real-time raporları kontrol edin
- Console'da hata mesajları olup olmadığını kontrol edin

### Sayfa Takibi Çalışmıyor
- `usePageTracking` hook'unun layout'ta kullanıldığından emin olun
- Next.js router'ın doğru çalıştığından emin olun
- Browser console'da `gtag` fonksiyonunun tanımlı olduğunu kontrol edin
