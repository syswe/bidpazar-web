# Live Streams Modülü İyileştirme Yol Haritası (Roadmap)

Bu döküman, `live-streams` özelliğinin yeniden yapılandırılması (refactoring) için izlenmesi gereken adımları detaylandırmaktadır. Amaç, modülün kararlılığını artırmak, bakımını kolaylaştırmak, performansı optimize etmek ve gelecekteki geliştirmelere zemin hazırlamaktır.

## Faz 1: Kritik Arka Uç ve Güvenlik İyileştirmeleri

**Amaç:** En acil olan güvenlik ve veri tutarlılığı sorunlarını gidermek. Bu faz, uygulamanın temel kararlılığı için en önemli adımdır.

### Adım 1.1: Socket Olaylarını Sunucu Merkezli Hale Getirme

**Sorun:** İstemci, diğer istemcilere veri gönderen `socket.emit` çağrıları yapıyor. Bu durum güvenlik açığı yaratır ve verinin tek bir doğru kaynağı (single source of truth) olmasını engeller.

**Görev:**
1.  **İstemcideki `socket.emit` Çağrılarını Kaldırın:**
    *   `src/app/live-streams/[id]/components/AddProductAuction.tsx` dosyasındaki `socket.emit("new-auction", ...)` çağrısını kaldırın.
    *   `src/app/live-streams/[id]/components/ProductSection.tsx` dosyasındaki `socket.emit("countdown-ended", ...)` çağrısını kaldırın.

2.  **API Route'larını Güncelleyin:**
    *   İlgili API endpoint'lerini (örn. `POST /api/live-streams/[id]/product` ve `POST /api/live-streams/[id]/auction-end`) bulun ve düzenleyin.
    *   Bu endpoint'ler, veritabanı işlemini (örn. yeni ürün ekleme, müzayedeyi sonlandırma) tamamladıktan **sonra**, sunucu tarafındaki Socket.IO örneğini kullanarak ilgili odadaki (`streamId`) tüm istemcilere gerekli olayı (`new-auction`, `auction-ended` vb.) yayınlamalıdır.
    *   **Örnek API Route Mantığı:**
        ```typescript
        // /api/live-streams/[id]/product/route.ts (Örnek)
        export async function POST(request, { params }) {
          // ... yetkilendirme ve veri doğrulama ...
          const newAuction = await prisma.auction.create(...);

          // Sunucudaki global socket.io nesnesi üzerinden emit yap
          if (global.socketIO) {
            global.socketIO.to(`stream:${params.id}`).emit('new-auction', newAuction);
          }
          
          return Response.json(newAuction);
        }
        ```

---

## Faz 2: Ön Uç Durum Yönetimi ve Mimarisi

**Amaç:** Bileşenler arasındaki sıkı bağımlılığı azaltmak, `window` objesi gibi kırılgan desenleri ortadan kaldırmak ve merkezi bir durum yönetimi katmanı oluşturmak.

### Adım 2.1: `StreamProvider` ve `useStream` Hook'u Oluşturma

1.  **Context Dosyası Oluşturun:**
    *   `src/app/live-streams/[id]/context/StreamContext.tsx` adında yeni bir dosya oluşturun.

2.  **StreamProvider'ı Geliştirin:**
    *   Bu provider, `streamId` için bir Socket.IO bağlantısı kuracak ve yönetecek.
    *   `useStreamDetails` ve `useActiveBid` hook'larını kendi içinde kullanarak `streamDetails` ve `activeProductBid` verilerini yönetecek.
    *   Jitsi API nesnesini (`apiObj`) state içinde tutacak.
    *   Tüm bu state'leri ve socket nesnesini context aracılığıyla alt bileşenlere sunacak.

3.  **`useStream` Hook'u Geliştirin:**
    *   `useContext(StreamContext)` kullanarak context verilerine kolayca erişim sağlayan bir `useStream` hook'u oluşturun.

### Adım 2.2: Sayfa ve Bileşenleri `StreamProvider` Kullanacak Şekilde Refactor Edin

1.  **`[id]/page.tsx`'i Güncelleyin:**
    *   Sayfanın ana JSX yapısını `StreamProvider` ile sarmalayın.
    *   `page.tsx` içerisindeki `useStreamDetails`, `useActiveBid` hook çağrılarını ve state yönetimini `StreamProvider`'a taşıyın. Sayfa artık bir "container" görevi görecek.

2.  **Alt Bileşenleri Güncelleyin:**
    *   `ProductSection`, `StreamChat`, `StreamHeader` gibi bileşenlerin prop'larını (`streamDetails`, `socket`, `activeProductBid` vb.) kaldırın.
    *   Bunun yerine, bileşenlerin içinde `const { streamDetails, socket, activeProductBid } = useStream();` gibi `useStream` hook'unu kullanarak verilere erişmelerini sağlayın. Bu, "prop drilling" sorununu çözecektir.

---

## Faz 3: Bileşen ve Hook Optimizasyonları

**Amaç:** Sorumlulukları daha net ayırmak ve kod tekrarını ortadan kaldırmak.

### Adım 3.1: `JitsiPlayer` Bileşeni Oluşturma

1.  **Yeni Bileşen Oluşturun:**
    *   `src/app/live-streams/[id]/components/JitsiPlayer.tsx` adında bir dosya oluşturun.

2.  **Mantığı Taşıyın:**
    *   `[id]/page.tsx` içindeki tüm Jitsi'ye özel mantığı (`getJitsiConfig`, `handleApiReady`, `JitsiMeeting` component'ini render etme, iframe manipülasyonları) bu yeni bileşene taşıyın.
    *   `JitsiPlayer` bileşeni, `useStream` hook'undan `streamDetails` ve `isStreamer` gibi bilgileri alarak Jitsi'yi başlatmalıdır.

### Adım 3.2: `useCountdown` Hook'u Oluşturma

1.  **Yeni Hook Oluşturun:**
    *   `src/app/live-streams/[id]/hooks/useCountdown.ts` adında bir dosya oluşturun.
    *   Bu hook, parametre olarak bir bitiş tarihi (`countdownEnd`) almalı ve kalan süreyi (`timeLeft`) saniye cinsinden döndürmelidir. İçerisinde `setInterval` ve `useEffect` mantığını barındırmalıdır.

2.  **Tekrarlanan Kodu Değiştirin:**
    *   `ProductSection.tsx` ve `BiddingInterface.tsx` içindeki geri sayım için kullanılan `useEffect` mantığını kaldırın.
    *   Bunun yerine `const timeLeft = useCountdown(activeProductBid.countdownEnd);` şeklinde yeni hook'u kullanın.

### Adım 3.3: `useActiveBid` Hook'unu Optimize Etme

1.  **Polling'i Azaltın:**
    *   `useActiveBid.ts` içindeki `setInterval` ile her 5 saniyede bir yapılan API çağrısını (`fetchActiveBid`) kaldırın veya süresini önemli ölçüde artırın (örn. 30 saniye).
    *   Veri güncellemesi için birincil kaynak, Faz 1'de sunucuya taşınan Socket.IO olayları (`new-bid`, `new-auction` vb.) olmalıdır. Polling sadece bir yedekleme mekanizması olarak kalmalıdır.

---

## Faz 4: Stil ve Kod Organizasyonu

**Amaç:** Kod tabanının okunabilirliğini ve stil yönetiminin sürdürülebilirliğini artırmak.

### Adım 4.1: `streamStyles.css` Dosyasını Parçalara Ayırma

1.  **CSS Dosyalarını Bölün:**
    *   `src/app/live-streams/[id]/styles/streamStyles.css` dosyasını daha küçük ve odaklı dosyalara ayırın:
        *   `jitsi-overrides.css`: Sadece Jitsi arayüzünü ezen stiller.
        *   `stream-layout.css`: Sayfanın genel yerleşimi (header, chat, product section konumlandırması).
        *   `chat-styles.css`: Sohbet arayüzüne özel stiller.

2.  **Bileşen Stillerini Yerelleştirin:**
    *   Mümkünse, bileşene özel stilleri (örn. `BiddingInterface.tsx`'e ait stiller) Tailwind CSS'in `@apply` direktifi ile veya CSS Modules (`BiddingInterface.module.css`) kullanarak doğrudan bileşenin yanına taşıyın.

### Adım 4.2: Genel Kod Temizliği

1.  **Gözden Geçirme:**
    *   Tüm refactor edilen dosyalarda `useEffect`, `useCallback` gibi hook'ların bağımlılık dizilerinin (`dependency array`) doğru olduğundan emin olun.
    *   Proje genelinde auth hook'larının (`useAuth`) tutarlı kullanıldığını kontrol edin.
    *   Yeni oluşturulan `StreamProvider` ve `JitsiPlayer` gibi karmaşık bileşenlere, mantığı açıklayan kısa yorumlar ekleyin. 