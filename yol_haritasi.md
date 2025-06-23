# BidPazar Geliştirme Yol Haritası

Bu doküman, BidPazar platformuna eklenecek yeni özellikleri ve yapılacak iyileştirmeleri detaylandırmaktadır. Her bir madde, görevin tanımını ve görevi bir LLM (Gemini gibi) ile nasıl gerçekleştireceğinize dair adımları içerir.

---

## 1. Ana Sayfa Özellikleri

### 1.1. Popüler Yayıncılar
**Görev:** Ana sayfadaki "Popüler Yayıncılar" bölümünü, takipçi sayısına göre en popüler olan ve admin panelinden "öne çıkarılan" olarak işaretlenmiş satıcıları gösterecek şekilde dinamik hale getirmek.

**LLM İstem (Prompt) Adımları:**
1.  **Backend (API):**
    *   **İstem:** "`src/app/api/users/route.ts` dosyasını ve `prisma/schema.prisma` modelini incele. `User` modeline `isFeatured` (boolean, default: false) alanı eklemek için bir Prisma migration oluştur. Ardından, `/api/users/popular` adında yeni bir API endpoint'i oluştur. Bu endpoint, `isFeatured` alanı `true` olan kullanıcıları takipçi (`followers`) sayısına göre çoktan aza doğru sıralayarak ilk 10 kullanıcıyı getirmeli. Sonuç olarak kullanıcı adı, profil resmi, takipçi sayısı ve kategorisini döndür."
    *   **Detay:** Bu istem, veritabanı şemasını güncellemeyi, yeni bir API rotası oluşturmayı ve bu rotanın mantığını tanımlamayı kapsar.

2.  **Frontend (Ana Sayfa):**
    *   **İstem:** "`src/app/page.tsx` dosyasını aç. Mevcut statik `popularStreamers` verisini kaldır. Bunun yerine, sayfa yüklendiğinde `/api/users/popular` endpoint'ine bir istek atarak gelen veriyi kullan. Veri yüklenirken bir "loading" (iskelet) göstergesi göster. Gelen veriyi kullanarak "Popüler Yayıncılar" bölümünü dinamik olarak oluştur."

### 1.2. Öne Çıkartılan Açık Arttırmalar
**Görev:** Satıcıların satın alacakları paketler dahilinde belirli sayıda ürünü "öne çıkarma" hakkına sahip olmasını sağlamak. Ana sayfada bu ürünler gösterilecek.

**LLM İstem (Prompt) Adımları:**
1.  **Paket ve Hak Yönetimi (Backend):**
    *   **İstem:** "Prisma şemasına `SubscriptionPackage` ve `UserSubscription` adında iki yeni model ekle. `SubscriptionPackage` modeli paket adı, fiyatı ve `featureProductCount` (öne çıkarma hakkı sayısı) gibi alanlar içermeli. `UserSubscription` modeli ise bir kullanıcının hangi pakete sahip olduğunu ve kalan `featureProductCount` hakkını tutmalı. `Product` modeline de `isFeatured` (boolean) alanı ekle."

2.  **Ürün Öne Çıkarma (Backend):**
    *   **İstem:** "`src/app/api/products/[id]/feature/route.ts` adında bir endpoint oluştur. Bu endpoint, bir ürünün `isFeatured` durumunu `true` yapmalı. İşlemden önce kullanıcının `UserSubscription` modelindeki `featureProductCount` hakkının 0'dan büyük olup olmadığını kontrol et. Başarılı olursa hakkı bir azalt."

3.  **Frontend (Ana Sayfa):**
    *   **İstem:** "`src/app/page.tsx` dosyasında, `/api/products?featured=true` gibi bir endpoint'ten veri çekecek şekilde "Öne Çıkan Açık Arttırmalar" bölümünü güncelle. Bu endpoint, `isFeatured` değeri `true` olan ürünleri getirmeli."

### 1.3. Favori Satıcılar
**Görev:** "Favori Satıcılar" bölümünde şimdilik tüm satıcıları (seller tipi) göstermek.

**LLM İstem (Prompt) Adımları:**
1.  **API Endpoint'i:**
    *   **İstem:** "`src/app/api/users/sellers/route.ts` adında bir API endpoint'i oluştur. Bu endpoint, `userType` alanı `SELLER` olan tüm kullanıcıları getirmeli. Her satıcının adı, puanı, ürün sayısı ve takipçi sayısı gibi bilgileri döndür."

2.  **Frontend Entegrasyonu:**
    *   **İstem:** "`src/app/page.tsx`'deki `favoriteSellers` statik verisini kaldır. Bunun yerine `/api/users/sellers` endpoint'inden gelen veriyi kullanarak bölümü dinamik olarak oluştur."

---

## 2. Dashboard ve Arayüz İyileştirmeleri

### 2.1. Canlı Yayın Butonlarının Kaldırılması
**Görev:** Kullanıcı `dashboard` ekranlarındaki "Canlı Yayın Aç" ile ilgili butonları ve bölümleri kaldırmak. Bu işlevsellik sadece belirli bir akış üzerinden yönetilecek.

**LLM İstem (Prompt) Adımları:**
*   **İstem:** "`src/app/dashboard/page.tsx`, `src/components/Sidebar.tsx` ve `src/components/MobileNavigation.tsx` dosyalarını incele. "Canlı Yayın Aç", "Create Stream" veya benzeri metinler içeren ve `/dashboard/streams/create` adresine yönlendiren `Link` veya `button` bileşenlerini kaldır veya yorum satırına al."

### 2.2. Satıcı Başvuru Durumu Görünümü
**Görev:** Satıcı başvuru durumunu gösteren bilgilendirme kutusunun light mode (açık tema) görünümünü revize etmek.

**LLM İstem (Prompt) Adımları:**
*   **İstem:** "`src/components/SellerRequestSection.tsx` dosyasını ve `src/app/globals.css` dosyasını incele. Satıcı başvuru durumunu gösteren (`Değerlendirme Aşamasında` vb.) bileşenin CSS sınıflarını analiz et. `globals.css` içinde light mode için `--info-background`, `--info-foreground` ve `--info-border` gibi yeni CSS değişkenleri tanımla. Bu değişkenleri kullanarak light mode'da daha modern ve temayla uyumlu bir görünüm oluştur. Örneğin, soluk sarı bir arka plan ve koyu sarı bir metin rengi kullanabilirsin."

---

## 3. Ürün Ekleme ve Açık Arttırma Akışı

### 3.1. Ürün Ekleme Süresi Seçenekleri
**Görev:** `http://localhost:3000/products/create` ekranına "Açık Arttırma Süresi" için 3, 5, 7 gün gibi seçenekler eklemek.

**LLM İstem (Prompt) Adımları:**
1.  **Veritabanı Güncellemesi:**
    *   **İstem:** "`prisma/schema.prisma` dosyasındaki `Product` modeline `auctionEndsAt` adında bir `DateTime` alanı ekle."
2.  **Frontend Arayüzü:**
    *   **İstem:** "`src/app/products/create/page.tsx` dosyasını aç. Form içerisine "Açık Arttırma Süresi" adında bir `select` (dropdown) menüsü ekle. Seçenekler "3 Gün", "5 Gün", "7 Gün" olsun."
3.  **Form Mantığı:**
    *   **İstem:** "Ürün oluşturma formunun `handleSubmit` fonksiyonunda, seçilen süreye göre (`3`, `5` veya `7` gün) `auctionEndsAt` tarihini hesapla ve API'ye gönderilecek veri objesine ekle."

### 3.2. Anında Başlayan Açık Arttırma
**Görev:** Ürün eklendiğinde açık arttırmanın hemen başlamasını sağlamak ve sonradan "açık arttırma başlat" butonunu kaldırmak.

**LLM İstem (Prompt) Adımları:**
*   **İstem:** "`src/app/products/create/page.tsx` ve ilgili API endpoint'i olan `src/app/api/products/route.ts` dosyasını düzenle. Ürün oluşturulduğu anda `status` alanını otomatik olarak `AUCTION_ACTIVE` gibi bir değere ayarla. Ürün detay sayfasındaki (`src/app/products/[id]/page.tsx`) "Açık Arttırma Başlat" butonunu kaldır."

---

## 4. Dinamik Teklif Artış Sistemi

**Görev:** Ürünün başlangıç fiyatına göre teklif artış miktarını dinamik olarak belirlemek.

**LLM İstem (Prompt) Adımları:**
1.  **Utility Fonksiyonu:**
    *   **İstem:** "`src/lib/utils.ts` dosyasına `getBidIncrement(price: number): number` adında bir fonksiyon ekle. Bu fonksiyon, verilen fiyata göre şu kuralları uygulasın:
        *   1-100 TL arası: 10 TL
        *   100-500 TL arası: 50 TL
        *   500-2000 TL arası: 100 TL
        *   2000-5000 TL arası: 200 TL
        *   5000 TL üzeri: 500 TL"

2.  **Backend (Teklif Verme API):**
    *   **İstem:** "Tekliflerin işlendiği API endpoint'ini (`src/app/api/product-auctions/[id]/bids/route.ts` veya benzeri) aç. Yeni bir teklif geldiğinde, mevcut en yüksek teklif ile yeni teklif arasındaki farkın `getBidIncrement` fonksiyonundan dönen değere eşit veya daha büyük olduğunu doğrula. Değilse, "Geçersiz teklif miktarı" gibi bir hata döndür."

3.  **Frontend (Teklif Arayüzü):**
    *   **İstem:** "Teklif verme arayüzünü (`src/app/products/[id]/page.tsx` ve `src/app/live-streams/[id]/components/BiddingInterface.tsx`) güncelle. Mevcut fiyata göre `getBidIncrement` fonksiyonunu kullanarak bir sonraki minimum teklif miktarını kullanıcıya göster. Örneğin, "Minimum Teklif: 110 TL" gibi."

---

## 5. Ürün Detay Sayfası İyileştirmeleri

**Görev:** Ürün detay sayfasında, satıcının diğer ürünlerini listelemek. Eğer başka ürünü yoksa, farklı satıcıların ürünlerini göstermek.

**LLM İstem (Prompt) Adımları:**
1.  **API Güncellemesi:**
    *   **İstem:** "`src/app/api/products/[id]/route.ts` (GET metodu) endpoint'ini güncelle. Ürün bilgileriyle birlikte, aynı satıcının diğer ürünlerinden birkaç tanesini (`sellerOtherProducts`) ve eğer bunlar yoksa, rastgele diğer ürünlerden birkaç tanesini (`recommendedProducts`) de döndür."
2.  **Frontend Entegrasyonu:**
    *   **İstem:** "`src/app/products/[id]/page.tsx` dosyasını aç. API'den gelen `sellerOtherProducts` veya `recommendedProducts` verisini kullanarak sayfanın altında yeni bir "Satıcının Diğer Ürünleri" veya "Bunlar da İlgini Çekebilir" bölümü oluştur. Bu ürünleri `ProductCard` bileşeni ile listeleyin."

---

## 6. Canlı Yayın Geliştirmeleri

### 6.1. Kamera Değiştirme Özelliği
**Görev:** Jitsi entegrasyonunu kullanarak canlı yayın sırasında ön ve arka kamera arasında geçiş yapma özelliği eklemek.

**LLM İstem (Prompt) Adımları:**
*   **İstem:** "Projedeki Jitsi Meet entegrasyonunu (`src/app/live-streams/[id]/page.tsx` veya ilgili bileşen) incele. Jitsi `API.getAvailableDevices()` ve `API.setVideoInput()` komutlarını kullanarak bir "Kamera Değiştir" butonu oluştur. Bu buton, mevcut video cihazları arasında döngü yaparak geçiş sağlamalı. Jitsi yönetim araçlarının yayıncı için görünür olduğundan emin ol."

### 6.2. Anlık Ürün Kontrolleri
**Görev:** Canlı yayında anlık eklenen bir ürün için sayaç başlamadan teklif alınabilmesini ve ürünün iptal edilebilmesini sağlamak.

**LLM İstem (Prompt) Adımları:**
1.  **Backend (Prisma & API):**
    *   **İstem:** "`prisma/schema.prisma`'daki `LiveStreamListing` (veya benzeri) modeline `status` alanı ekle. Durumlar: `PENDING`, `ACTIVE`, `SOLD`, `CANCELLED`. Ürün ilk eklendiğinde durumu `PENDING` olsun. `src/app/api/live-streams/[id]/listings/[listingId]/cancel/route.ts` adında bir endpoint oluşturarak durumu `CANCELLED` yap."
2.  **Frontend (Yayıncı Arayüzü):**
    *   **İstem:** "Yayıncının ürün ekleme arayüzünü (`src/app/live-streams/[id]/components/AddProductAuction.tsx` veya benzeri) güncelle. Eklenen ürün `PENDING` durumundayken "Sayacı Başlat" ve "İptal Et" butonları göster. Teklifler bu aşamada da verilebilmeli. "Sayacı Başlat" tıklandığında ürün durumu `ACTIVE` olur."

---

## 7. Canlı Yayın Arayüzü Yenileme (Modernizasyon)

**Görev:** Yayıncı ve izleyici için canlı yayın ekranlarını tamamen modernize etmek.

**Bu görev büyük olduğu için adımlara ayrılmalıdır:**

**LLM İstem (Prompt) Adımları:**

1.  **Genel Layout:**
    *   **İstem (Adım 1):** "`src/app/live-streams/[id]/page.tsx` dosyasını aç. Flexbox veya Grid kullanarak yeni bir layout oluştur. Üstte kanal bilgileri (profil resmi, kullanıcı adı, takipçi sayısı), ortada video oynatıcı, altta ise chat ve ürün bilgisi alanı olacak şekilde bir yapı kur."

2.  **Kaydırılabilir Chat:**
    *   **İstem (Adım 2):** "Chat bileşenini (`StreamChat.tsx`) yeniden tasarla. Mesajlar aşağıdan yukarıya doğru aksın. Normalde sınırlı bir yükseklikte dursun, ancak üzerine gelindiğinde (hover) veya tıklandığında geçici olarak daha fazla alan kaplasın ve kaydırılabilir olsun. Yayıncı için Jitsi kontrol butonlarını bu chat alanının hemen üstüne veya altına yerleştir."

3.  **Modern Ürün Ekleme Arayüzü (Yayıncı):**
    *   **İstem (Adım 3):** "`AddProductAuction.tsx` bileşenini modal (popup) yerine ekranın bir kenarında açılan modern bir panel olarak yeniden tasarla. Formda "Stoktan Satış" (sabit fiyat) ve "Açık Arttırma" seçenekleri sun. Seçime göre form alanları (fiyat, başlangıç fiyatı, stok vb.) dinamik olarak değişsin."

4.  **Anlık Ürün Gösterimi:**
    *   **İstem (Adım 4):** "Chat alanının üzerinde, o an satılmakta olan ürünü gösteren dinamik bir bileşen oluştur. Bu bileşen ürün resmini, başlığını, mevcut teklifi/fiyatı ve kalan süreyi (sayaç aktifse) göstermeli. `useStreamDetails` hook'unu kullanarak bu veriyi anlık olarak güncelleyin." 