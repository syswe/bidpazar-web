# BidPazar Web

**BidPazar**, canlı yayın üzerinden gerçek zamanlı açık artırma deneyimi sunan, Next.js 15 tabanlı bir e-ticaret ve müzayede platformudur. Satıcılar canlı yayın açar, ürünleri gerçek zamanlı tanıtır ve izleyiciler yayın boyunca anlık teklif vererek ürünleri satın alabilir.

> Bu repo platformun **web (frontend + API + Socket.IO + custom Node sunucu)** tarafını içerir. Mobil uygulama (`bpmobile`) ayrı bir projedir; bu README kapsamı dışındadır.

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Mimari](#mimari)
- [Proje Yapısı](#proje-yapısı)
- [Temel Özellikler](#temel-özellikler)
- [Veritabanı Modeli](#veritabanı-modeli)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri (.env)](#ortam-değişkenleri-env)
- [LiveKit Sunucu Kurulumu (Sunucuda Ayrı Çalışır)](#livekit-sunucu-kurulumu-sunucuda-ayrı-çalışır)
- [Yardımcı Servisler (Redis & Coturn)](#yardımcı-servisler-redis--coturn)
- [Uygulamayı Çalıştırma](#uygulamayı-çalıştırma)
- [API Yapısı](#api-yapısı)
- [Gerçek Zamanlı Olaylar (Socket.IO)](#gerçek-zamanlı-olaylar-socketio)
- [Production Deployment](#production-deployment)
- [Komutlar (Scripts)](#komutlar-scripts)
- [Test](#test)
- [Önemli Dosya ve Klasörler](#önemli-dosya-ve-klasörler)
- [Sorun Giderme](#sorun-giderme)

---

## Genel Bakış

BidPazar, satıcıların canlı yayın açtığı, izleyicilerin gerçek zamanlı teklif verdiği bir mobil-öncelikli (mobile-first) Türkçe arayüze sahip platformdur.

Temel iş akışı:

1. **Satıcı**, satıcı başvurusu yapar (admin onayı gerekli) ve onay sonrası ürün ekleyebilir.
2. Onaylı satıcı **canlı yayın** başlatır; yayında bir veya birden fazla ürünü sıraya alabilir.
3. **İzleyici**, yayına katılır, sohbet eder ve aktif üründe canlı teklif verir.
4. **Anlık teklif** Socket.IO üzerinden tüm izleyicilere yayınlanır; LiveKit ses/video aktarımını yönetir.
5. Yayın bitiminde kazanan teklif sahibi belirlenir ve **sipariş** kaydı oluşturulur.
6. Bir **moderasyon sistemi** (içerik raporlama, kullanıcı uyarıları, itirazlar, içerik filtreleri) içerik kalitesini ve güvenliğini sağlar.
7. **Admin paneli** kullanıcı, ürün, kategori, satıcı başvuruları, moderasyon ve canlı yayınları yönetir.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 15 (App Router)** + Custom Node.js Server (`server.js`) |
| Dil | **TypeScript** + JavaScript (server.js) |
| Veritabanı | **PostgreSQL** (ayrı çalışır — Docker container veya managed) |
| ORM | **Prisma 6** |
| Gerçek Zamanlı Medya | **LiveKit** (`livekit-client`, `@livekit/components-react`, `livekit-server-sdk`) |
| Gerçek Zamanlı Mesajlaşma & Teklif | **Socket.IO 4** (chat, bidding, bildirimler) |
| Stil | **Tailwind CSS** + CSS Değişkenleri (light/dark tema) |
| UI Bileşenleri | Radix UI primitives, **lucide-react**, **sonner**, react-hot-toast |
| Form & Doğrulama | `react-hook-form` + `zod` |
| Kimlik Doğrulama | Custom **JWT** (`jose`, Edge uyumlu) + NextAuth.js hibrit |
| Bildirim | SMS (Mutlucell), in-app notifications |
| Cache & Pub/Sub | **Redis 7** |
| WebRTC NAT Geçişi | **Coturn** (TURN/STUN sunucusu) |
| Test | Jest + Testing Library, Playwright |
| Görsel İşleme | **sharp** |
| Konteynerleştirme | Docker + Docker Compose |

---

## Mimari

```
┌──────────────────────────────────────────────────────────────────┐
│                          Kullanıcı (Tarayıcı)                     │
└────────────┬─────────────────────────┬───────────────────────────┘
             │ HTTP / WS               │ WebRTC (UDP)
             │                         │
┌────────────▼─────────────┐   ┌───────▼──────────────────────────┐
│  Next.js + server.js     │   │  LiveKit Server                  │
│  (web container)         │   │  (sunucuda ayrı docker-compose)  │
│                          │   │                                  │
│  ├ App Router (RSC)      │   │  Port: 7880 (signal)             │
│  ├ API Routes            │   │  Port: 7881 (TCP fallback)       │
│  ├ Socket.IO server      │   │  UDP: 50000-60000                │
│  └ Static + Uploads      │   │                                  │
└─────┬────────────────┬───┘   └─────────────┬────────────────────┘
      │                │                     │
      │ Prisma         │ Redis              │ Redis (paylaşımlı)
      │                │                     │
┌─────▼──────┐   ┌─────▼─────┐        ┌──────▼─────┐
│ PostgreSQL │   │   Redis   │        │   Coturn   │
│  (ayrı)    │   │   7       │        │ TURN/STUN  │
└────────────┘   └───────────┘        └────────────┘
```

- **Next.js + Socket.IO** tek bir Node.js sürecinde çalışır (`server.js`); Socket.IO örneği API rotalarında `global.socketIO` ile erişilebilir hale getirilir.
- **LiveKit sunucusu sunucuda ayrı bir `docker-compose.yaml` ile çalıştırılır** — uygulama containerı ile aynı host üzerinde olabilir veya farklı bir host üzerinde de çalıştırılabilir.
- **PostgreSQL** ayrı yönetilir (managed servis veya bağımsız Docker container).
- LiveKit token üretimi server-side (`src/lib/livekit.ts`); API anahtarları **asla** istemciye sızdırılmaz.

---

## Proje Yapısı

```
bpweb/
├── prisma/
│   ├── schema.prisma              # Tüm modeller ve enum'lar
│   └── migrations/                # Veritabanı geçişleri
├── public/
│   └── uploads/                   # Kullanıcı tarafından yüklenen medyalar
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (debug)/               # Debug sayfa grubu
│   │   ├── (static-pages)/        # Statik sayfalar
│   │   ├── admin/                 # Admin paneli (kullanıcılar, ürünler, kategoriler,
│   │   │                          # moderation, seller-requests, streams)
│   │   ├── api/                   # Backend API rotaları
│   │   │   ├── admin/             # Admin uçları
│   │   │   ├── auctions/          # Müzayede uçları
│   │   │   ├── auth/              # Kimlik doğrulama
│   │   │   ├── categories/        # Kategoriler
│   │   │   ├── cron/              # Zamanlanmış işler
│   │   │   ├── devices/           # Kullanıcı cihaz tercihleri
│   │   │   ├── health/            # Health check
│   │   │   ├── live-streams/      # Canlı yayın yönetimi (LiveKit token vb.)
│   │   │   ├── messages/          # Özel mesajlaşma
│   │   │   ├── moderation/        # Moderasyon (rapor, itiraz, filtre)
│   │   │   ├── notifications/     # Bildirimler
│   │   │   ├── orders/            # Siparişler
│   │   │   ├── product-auctions/  # Ürün müzayedeleri
│   │   │   ├── products/          # Ürünler
│   │   │   ├── seller-requests/   # Satıcı başvuruları
│   │   │   ├── socket/            # Socket.IO yardımcıları
│   │   │   ├── stories/           # Story (24 saatlik) içerikler
│   │   │   └── users/             # Kullanıcı işlemleri
│   │   ├── categories/            # Kategori sayfaları
│   │   ├── dashboard/             # Kullanıcı dashboard (profil, mesajlar,
│   │   │                          # siparişler, kazanılan açık artırmalar)
│   │   ├── live-streams/          # Yayın listesi, oluşturma ve yayın izleme sayfası
│   │   ├── login/                 # Giriş
│   │   ├── packages/              # Satıcı paketleri / kotalar
│   │   ├── products/              # Ürün detay sayfaları
│   │   ├── register/              # Kayıt
│   │   ├── search/                # Arama
│   │   ├── sellers/               # Satıcı profilleri
│   │   ├── globals.css            # Global stiller (tema değişkenleri)
│   │   ├── layout.tsx             # Kök layout
│   │   ├── error.tsx              # Hata sayfası
│   │   └── not-found.tsx          # 404 sayfası
│   ├── components/                # Yeniden kullanılabilir UI bileşenleri
│   │   ├── ui/                    # Düşük seviye UI primitives
│   │   ├── moderation/            # Moderasyon bileşenleri
│   │   ├── sellers/               # Satıcı bileşenleri
│   │   ├── AuthProvider.tsx       # Global auth state
│   │   ├── BottomNavigation.tsx   # Mobil alt nav
│   │   ├── BidConfirmationModal.tsx, BidModal.tsx
│   │   ├── MobileLayout.tsx, MobileSidebar.tsx, TopMobileBar.tsx
│   │   └── ...
│   ├── contexts/
│   │   └── StreamDetailsContext.tsx
│   ├── hooks/                     # React hook'ları (moderation gate, page tracking,
│   │                              # stream details, swipe gesture)
│   ├── lib/                       # Yardımcı modüller
│   │   ├── api/                   # API istemci (auctions, categories, livestreams,
│   │   │                          # messages, products, users vb.)
│   │   ├── server/                # Sunucu tarafı yardımcılar
│   │   ├── socket/                # Socket.IO yardımcıları
│   │   ├── auth.ts, frontend-auth.ts
│   │   ├── livekit.ts             # LiveKit token üretimi
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── moderation-service.ts  # Moderasyon iş mantığı
│   │   ├── webrtc-config.ts       # WebRTC/TURN/STUN yapılandırması
│   │   ├── sms.ts                 # SMS gönderimi
│   │   └── ...
│   ├── tests/                     # Birim ve entegrasyon testleri
│   ├── types/                     # TypeScript tip tanımları
│   └── middleware.ts              # Edge middleware (auth + route koruması)
├── scripts/
│   ├── create-test-users.ts
│   ├── create-users.sql
│   └── start-server.sh
├── server.js                      # Custom Next.js + Socket.IO sunucusu
├── docker-compose.yml             # Tam stack (web + redis + coturn + livekit)
├── docker-compose.prod.yml        # Production override
├── docker-compose-dev.yml         # Local dev: redis + coturn + livekit (web yok)
├── docker-compose.livekit.yml     # SADECE LiveKit (sunucuda ayrı çalıştırılır)
├── docker-compose-pgsql.yaml      # PostgreSQL (ayrı çalışır)
├── livekit.yaml                   # LiveKit varsayılan konfigürasyon
├── livekit.local.yaml             # LiveKit local geliştirme konfigürasyonu
├── livekit.prod.yaml              # LiveKit production konfigürasyonu
├── Dockerfile                     # Production için multi-stage build
├── prisma/schema.prisma
├── .env.example                   # Tam ortam değişkeni şablonu
├── .env.local.example             # Lokal override şablonu
└── package.json
```

---

## Temel Özellikler

- **Canlı Yayın & Açık Artırma**
  - LiveKit tabanlı düşük gecikmeli ses/video yayını
  - Yayın içerisinde aktif ürün rotasyonu (`LiveStreamProduct`)
  - Anlık teklif ve hızlı teklif (`LiveStreamBid`)
  - Yayın istatistikleri, izlenme süresi (`StreamViewTime`), paylaşım (`StreamShare`)
  - Yayın highlight'ları (`StreamHighlight`)
  - Yayın ödülleri (`StreamReward`)
  - Yayın moderasyonu (mute/ban, `StreamModeration`)
  - Yayın analitiği (`StreamAnalytics`)
- **Ürün ve Müzayede**
  - Klasik ürün ilanı (`Product`) ve süreli müzayede (`AuctionListing`)
  - Otomatik kazanan belirleme ve `Order` üretimi
  - Çoklu ürün medyası (`ProductMedia`)
- **Kullanıcı Sistemi**
  - JWT tabanlı kimlik doğrulama (jose, 7 günlük session)
  - Telefon doğrulama (SMS)
  - Profil, profil fotoğrafı, biyografi, takip sistemi (`Follows`)
  - Cihaz tercihleri (kamera/mikrofon)
- **Satıcı Sistemi**
  - Satıcı başvuruları (`SellerRequest`) — admin onayı zorunlu
  - **Aylık kota sistemi**: aylık ürün limiti ve aylık yayın dakikası
  - Popüler streamer ve favori satıcı işaretleri
- **Mesajlaşma**
  - Birebir konuşmalar (`Conversation`, `Message`)
  - Yayın içi sohbet (`ChatMessage`)
  - Bildirim sistemi (`Notification`)
- **Moderasyon Sistemi**
  - İçerik raporlama (`ContentReport`)
  - Moderatör eylemleri (`ModerationAction`)
  - Kullanıcı ihlalleri (`UserViolation`) ve itiraz akışı (`UserAppeal`)
  - İçerik filtreleri (`ContentFilter`)
  - Admin moderasyon paneli ve analitik
- **Sipariş Sistemi**
  - Alıcı/satıcı siparişleri (`Order`)
  - Çeşitli sipariş tipleri ve durumları
- **Story (24 Saatlik İçerik)**
  - Metin/medya story desteği (`Story`)
- **Admin Paneli**
  - Kullanıcı yönetimi, kullanıcı tipi atama (kotalar dahil)
  - Ürün ve kategori yönetimi
  - Satıcı başvurularının onaylanması/reddi
  - Yayın yönetimi
  - Moderasyon paneli
- **Mobil Öncelikli UI**
  - Tailwind CSS + CSS değişkenleri (dark/light tema)
  - Mobil için özel layout, alt navigasyon, swipe-gesture desteği
  - Türkçe arayüz

---

## Veritabanı Modeli

Prisma şeması (`prisma/schema.prisma`) ana olarak şu modelleri içerir:

- **Kullanıcı & Sosyal**: `User`, `Follows`, `Story`
- **Katalog**: `Category`, `Product`, `ProductMedia`
- **Müzayede**: `AuctionListing`, `Bid`, `ProductAuction`
- **Canlı Yayın**: `LiveStream`, `LiveStreamProduct`, `LiveStreamBid`, `ChatMessage`, `StreamHighlight`, `StreamReward`, `StreamShare`, `StreamViewTime`, `StreamModeration`, `StreamAnalytics`
- **Mesajlaşma & Bildirim**: `Conversation`, `Message`, `Notification`
- **Sipariş**: `Order`
- **Satıcı**: `SellerRequest`
- **Moderasyon**: `ContentReport`, `ModerationAction`, `ContentFilter`, `UserViolation`, `UserAppeal`

Önemli enum'lar: `StreamStatus`, `ListingStatus`, `NotificationType`, `RewardType`, `SharePlatform`, `UserType`, `SellerRequestStatus`, `StoryType`, `OrderStatus`, `OrderType`, `ReportContentType`, `ReportReason`, `ReportStatus`, `ModerationActionType`, `AppealStatus`.

---

## Gereksinimler

- **Node.js 22+** (`Dockerfile` Node 22 üzerine inşa eder)
- **npm 9+**
- **PostgreSQL 14+** (ayrı bir process/container olarak çalışmalıdır)
- **Docker & Docker Compose** (LiveKit, Redis ve Coturn için)
- Geliştirme makinesinde şu portların boş olması:
  - `3000` — Next.js + Socket.IO
  - `5432` — PostgreSQL (kullanılan kuruluma göre)
  - `6379` — Redis
  - `7880` — LiveKit Signal/HTTP
  - `7881` — LiveKit RTC TCP fallback
  - `3478` UDP/TCP — Coturn TURN/STUN
  - `50000-60000` UDP — LiveKit WebRTC media (production), `60500-60599` (dev)

---

## Kurulum

```bash
# 1) Repoyu klonla
git clone <repo-url>
cd bpweb

# 2) Bağımlılıkları yükle
npm install

# 3) Ortam dosyalarını oluştur
cp .env.example .env
cp .env.local.example .env.local
# Düzenle: DATABASE_URL, JWT_SECRET, LIVEKIT_*, REDIS_URL, SMS_* vb.

# 4) Prisma client oluştur ve migration uygula
npm run prisma:generate
npm run prisma:migrate

# 5) Yardımcı servisleri (Redis, Coturn, LiveKit) docker ile başlat
docker compose -f docker-compose-dev.yml up -d

# 6) Uygulamayı başlat
npm run dev
# -> http://localhost:3000
```

---

## Ortam Değişkenleri (.env)

Tam liste için `.env.example` dosyasına bakın. Kritik değişkenler:

### Sunucu (server-only — `NEXT_PUBLIC_` prefix'i **olmadan**)

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı dizesi (`postgresql://user:pass@host:5432/bidpazar?schema=public`) |
| `JWT_SECRET` | JWT imzalama anahtarı |
| `NEXTAUTH_SECRET` | NextAuth secret |
| `NEXTAUTH_URL` | NextAuth URL |
| `LIVEKIT_API_KEY` | LiveKit server API anahtarı |
| `LIVEKIT_API_SECRET` | LiveKit server API secret (en az 32 karakter) |
| `LIVEKIT_URL` | LiveKit HTTP URL'i (sunucu içi: `http://livekit:7880` / public: `https://live.bidpazar.com`) |
| `REDIS_URL` | Redis bağlantı dizesi (`redis://:password@host:6379`) |
| `SMS_USERNAME` / `SMS_PASSWORD` / `SMS_ORIGIN` / `SMS_API_URL` | SMS sağlayıcı (Mutlucell) |
| `SEND_MESSAGE` | `real` veya `test` |
| `APP_VERSION` | App sürümü (token doğrulamada kullanılır) |
| `DEBUG_AUTH`, `DEBUG_NOTIFICATIONS`, `DEBUG_MESSAGES`, `DEBUG_CHAT`, `DEBUG_ACTIVE_BID` | Debug log bayrakları |
| `GA_MEASUREMENT_ID` | Sunucu taraflı Google Analytics |

### İstemci (`NEXT_PUBLIC_` prefix'i ile — tarayıcıya gider; **secret koymayın**)

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Public uygulama URL'i |
| `NEXT_PUBLIC_API_URL` | Public API URL'i |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO bağlantı URL'i |
| `NEXT_PUBLIC_WS_URL` | Socket.IO path (`/socket.io`) |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit WebSocket URL'i (`wss://live.bidpazar.com` veya `ws://localhost:7880`) |
| `NEXT_PUBLIC_STUN_SERVER_URL` | STUN sunucusu (`stun:stun.l.google.com:19302`) |
| `NEXT_PUBLIC_TURN_SERVER_URL` | TURN sunucusu URL'i |
| `NEXT_PUBLIC_TURN_USERNAME` / `NEXT_PUBLIC_TURN_PASSWORD` | TURN kimlik bilgileri |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager container ID |
| `NEXT_PUBLIC_DEBUG_ACTIVE_BID` | İstemci debug bayrağı |

> **Önemli:** `JWT_SECRET`, `LIVEKIT_API_SECRET`, `DATABASE_URL`, SMS şifreleri **asla** `NEXT_PUBLIC_` prefix'i almamalı.

---

## LiveKit Sunucu Kurulumu (Sunucuda Ayrı Çalışır)

Bu projede **LiveKit sunucusu, web uygulamasından bağımsız bir `docker-compose.yaml` ile sunucuda ayrı çalıştırılır**. Bu sayede LiveKit'i farklı bir host üzerinde, farklı kaynaklarla ölçeklendirebilirsiniz.

Repo içinde LiveKit için iki adet docker-compose dosyası bulunur:

- `docker-compose.livekit.yml` — yalnızca LiveKit container'ı (production sunucusunda ayrı çalıştırmak için)
- `docker-compose-dev.yml` — local geliştirme: Redis + Coturn + LiveKit birlikte

LiveKit konfigürasyonları:

- `livekit.yaml` — varsayılan/fallback config
- `livekit.local.yaml` — local geliştirme
- `livekit.prod.yaml` — production (public IP, STUN, TURN ayarlarıyla)

### Production Sunucusunda LiveKit'i Ayrı Çalıştırma

```bash
# Production sunucusunda LiveKit container'ını başlat
docker compose -f docker-compose.livekit.yml up -d

# Logları takip et
docker logs -f livekit

# Health check
curl http://<sunucu-ip>:7880/

# Durdurmak için
docker compose -f docker-compose.livekit.yml down
```

### LiveKit'in Açtığı Portlar

| Port | Protokol | Amaç |
|---|---|---|
| `7880` | TCP | Signal / HTTP |
| `7881` | UDP | Media (UDP) |
| `7882` | TCP | Media (TCP/TURN fallback) |
| `5349` | UDP | Media (UDP) |
| `3478` | UDP | TURN |
| `50000-60000` | UDP | WebRTC media (production config) |

Production'da bu portların **firewall'da açık olduğundan** emin olun.

### Web Uygulamasının LiveKit'e Bağlanması

Web uygulaması LiveKit'e şu ortam değişkenleri üzerinden bağlanır:

```env
# Sunucu (token üretimi için)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=dev-secret-key-at-least-32-characters-long-for-security
LIVEKIT_URL=https://live.bidpazar.com   # production
# LIVEKIT_URL=http://localhost:7880     # local

# İstemci (tarayıcı bağlantısı için)
NEXT_PUBLIC_LIVEKIT_URL=wss://live.bidpazar.com  # production
# NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880    # local
```

Token üretimi `src/lib/livekit.ts` içindeki `createLiveKitToken()` fonksiyonu ile yapılır; **API secret asla** istemciye gönderilmez.

---

## Yardımcı Servisler (Redis & Coturn)

LiveKit'in dışında uygulama Redis ve Coturn'a ihtiyaç duyar:

```bash
# Local geliştirme: Redis + Coturn + LiveKit birlikte
docker compose -f docker-compose-dev.yml up -d

# Servis durumunu kontrol et
docker compose -f docker-compose-dev.yml ps

# Logları takip et
docker compose -f docker-compose-dev.yml logs -f
```

**PostgreSQL** ayrı yönetilir. İhtiyaç halinde `docker-compose-pgsql.yaml` ile başlatılabilir veya managed servis kullanılabilir.

---

## Uygulamayı Çalıştırma

> Custom Node.js sunucusu (`server.js`) Socket.IO'yu Next.js HTTP sunucusu ile aynı süreçte birleştirir. **`next dev` doğrudan kullanılmaz**, `npm run dev` daima `server.js` üzerinden başlar.

### Geliştirme

```bash
# Önce yardımcı servisler ayakta olmalı (redis, coturn, livekit)
docker compose -f docker-compose-dev.yml up -d

# Uygulamayı başlat
npm run dev
# -> http://localhost:3000
```

### Production Build

```bash
npm run build
NODE_ENV=production npm start
```

### Build (lint/type-check atla)

```bash
npm run build:no-lint
```

### Sadece Next.js (Socket.IO olmadan, nadiren)

```bash
npm run dev:next      # next dev
npm run start:next    # next start
```

---

## API Yapısı

API rotaları `src/app/api/` altında, RESTful App Router yapısındadır. Genel kurallar:

- Koleksiyon: `src/app/api/[resource]/route.ts`
- Tek öğe: `src/app/api/[resource]/[id]/route.ts`
- Tüm girdiler **Zod** ile doğrulanır.
- Yanıt formatları:
  - Başarı: `{ data: any, meta?: any }`
  - Hata: `{ error: string, details?: any }`
- Desteklenmeyen HTTP metodları için `405` döner.
- Korumalı uçlar `withAuthHeader()` veya middleware üzerinden doğrulanır.

Önemli kaynak grupları:

- `auth/` — kayıt, giriş, telefon doğrulama, token yenileme
- `users/` — profil, arama, popüler streamer, favori satıcı, varlık kontrolü
- `products/` — ürün CRUD, medya yükleme, kategori bazlı listeleme, öne çıkan ürünler
- `categories/` — kategori ağacı
- `live-streams/` — yayın oluşturma, listeleme, LiveKit token üretimi, yayın istemcisi
- `auctions/` — kazanılan açık artırmalar
- `product-auctions/` — süreli ürün müzayedeleri
- `messages/` — konuşmalar, mesajlar, kullanıcı arama, satıcı listesi, bildirimler
- `notifications/` — bildirim listeleme ve okundu işaretleme
- `orders/` — sipariş kayıtları
- `seller-requests/` — satıcı başvuruları
- `moderation/` — içerik raporlama, itiraz, moderatör eylemleri
- `admin/` — admin'e özel uçlar (kullanıcılar, ürünler, moderation analytics)
- `stories/` — story CRUD
- `devices/` — kullanıcı cihaz tercihleri
- `cron/` — zamanlanmış görevler (yayın bitirme, kota sıfırlama vb.)
- `health/` — health check (`/api/health`)
- `socket/` — Socket.IO yardımcı uçları

---

## Gerçek Zamanlı Olaylar (Socket.IO)

Socket.IO örneği `server.js` içinde Next.js HTTP sunucusuna entegre edilir ve `global.socketIO` ile API rotalarından erişilebilir hale gelir.

Kullanılan oda (room) yapısı:

| Oda | Amaç |
|---|---|
| `stream:{streamId}` | Yayın bazlı katılımcılar (chat, teklif, izleyici sayısı) |
| `user:{userId}` | Kullanıcıya özel bildirimler |
| `conversation:{conversationId}` | Birebir mesajlaşma |

Tipik olay akışı:

1. Tarayıcı handshake sırasında token gönderir.
2. Sunucu kullanıcıyı doğrulayıp ilgili odalara dahil eder.
3. Mesaj/teklif önce REST API üzerinden DB'ye yazılır, sonra Socket.IO ile yayınlanır.
4. Disconnect olduğunda izleyici sayısı güncellenir, kullanıcı odadan çıkarılır.

Yayın chat ve teklifleri ile bildirimler için debug bayrakları:

- `DEBUG_CHAT=true`
- `DEBUG_MESSAGES=true`
- `DEBUG_ACTIVE_BID=true`
- `DEBUG_NOTIFICATIONS=true`

---

## Production Deployment

### 1) Web Uygulaması (Docker)

```bash
# Tam stack production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Sadece web (LiveKit ayrı host'ta varsa)
docker build -t bidpazar-web .
docker run -d --name bidpazar-web \
  -p 3000:3000 \
  --env-file .env.prod \
  bidpazar-web
```

`Dockerfile` çok aşamalıdır (deps → builder → runner) ve Next.js standalone output'unu kullanır.

### 2) LiveKit (Ayrı Sunucu / Container)

```bash
# Production sunucusunda
docker compose -f docker-compose.livekit.yml up -d
```

`livekit.prod.yaml` üretim için STUN/TURN, public IP (`node_ip`), Redis ve port aralıklarını içerir. Public IP'yi kendi sunucunuza göre güncelleyin.

### 3) Reverse Proxy

Web uygulamasının önüne Nginx (örnek: `nginx.conf.example`) veya Caddy konularak SSL sonlandırma, gzip ve WebSocket upgrade'ları yapılır. LiveKit için `wss://live.bidpazar.com` gibi alt domain önerilir.

### 4) Health Check

```bash
curl https://bidpazar.com/api/health
curl https://live.bidpazar.com/
```

---

## Komutlar (Scripts)

`package.json` üzerinden:

| Komut | Açıklama |
|---|---|
| `npm run dev` | Custom server (`server.js`) ile geliştirme modu |
| `npm run dev:next` | Next.js'i tek başına geliştirme modunda başlat (Socket.IO yok) |
| `npm run build` | Production build |
| `npm run build:no-lint` | Lint/type-check atlayarak build |
| `npm start` | Production'da `server.js` ile başlat |
| `npm run start:next` | Production'da yalnızca Next.js |
| `npm run lint` | ESLint |
| `npm test` | Jest testleri |
| `npm run test:watch` | Jest watch modu |
| `npm run test:coverage` | Jest coverage raporu |
| `npm run test:ci` | CI için Jest (coverage + ci) |
| `npm run prisma:generate` | Prisma client üret |
| `npm run prisma:migrate` | Migration oluştur ve uygula (dev) |
| `npm run prisma:studio` | Prisma Studio'yu başlat |

Yardımcı script'ler `scripts/` altındadır:

- `scripts/create-test-users.ts` — test kullanıcıları üret
- `scripts/create-users.sql` — SQL üzerinden kullanıcı oluşturma
- `scripts/start-server.sh` — sunucu başlatma yardımcı betiği

Veritabanı seed örnekleri için `seed.sql` ve `dump.sql` dosyalarına bakın.

---

## Test

- **Framework:** Jest (`jest.config.js`) + Testing Library (React/DOM/jest-dom)
- **E2E:** Playwright (`@playwright/test`)
- **Testler:** `src/tests/` ve modül komşusunda `*.test.ts` dosyaları

```bash
npm test                # Tüm testleri çalıştır
npm run test:watch      # Watch modunda
npm run test:coverage   # Coverage raporu
```

---

## Önemli Dosya ve Klasörler

- **`server.js`** — Custom Next.js + Socket.IO sunucusu (chat, bidding, viewer presence).
- **`src/middleware.ts`** — Edge runtime auth middleware.
- **`src/lib/livekit.ts`** — LiveKit `RoomServiceClient` ve token üretimi.
- **`src/lib/auth.ts` / `src/lib/frontend-auth.ts`** — JWT doğrulama, oturum yönetimi.
- **`src/lib/prisma.ts`** — Prisma client singleton.
- **`src/lib/moderation-service.ts`** — Moderasyon iş mantığı.
- **`src/lib/webrtc-config.ts`** — TURN/STUN sunucu yapılandırması.
- **`prisma/schema.prisma`** — Tüm domain modeli.
- **`docker-compose.livekit.yml`** — Sunucuda **ayrı** çalışan LiveKit servisi.
- **`docker-compose-dev.yml`** — Local geliştirme yardımcı servisleri.
- **`livekit.prod.yaml`** — Üretim LiveKit konfigürasyonu (public IP, STUN/TURN).

---

## Sorun Giderme

### LiveKit'e bağlanamıyorum

```bash
# LiveKit ayakta mı?
curl http://localhost:7880/

# Konteyner logları
docker logs -f livekit            # production (docker-compose.livekit.yml)
docker logs -f bidpazar-livekit-dev   # local (docker-compose-dev.yml)

# Yapılandırmada anahtar eşleşmesi
# livekit.yaml içindeki keys ile .env içindeki LIVEKIT_API_KEY/SECRET aynı olmalı.
```

### Redis bağlantı hatası

```bash
redis-cli -h localhost -p 6379 -a redis_dev_password ping
docker logs bidpazar-redis-dev
```

### TURN sunucusu testi

```bash
turnutils_uclient -v -t -T -u bidpazar_dev -w coturn_dev_secret localhost
```

### "App version mismatch" çıkışı

`.env` içindeki `APP_VERSION` ile build sırasındaki `APP_VERSION` farklıysa kullanıcılar otomatik logout edilir. Build ve runtime değerlerini eşitleyin.

### Socket.IO bağlanmıyor

- Reverse proxy WebSocket upgrade ayarlarını kontrol edin.
- `NEXT_PUBLIC_SOCKET_URL` doğru protokolü (ws/wss) kullanmalı.
- Custom server'ın gerçekten ayakta olduğunu doğrulayın (`npm run dev`, `next dev` **değil**).

### Next.js dev'i `next dev` ile başlatma

`server.js` Socket.IO'yu HTTP sunucusu ile birleştirdiği için canlı yayın chat/teklif akışı `next dev` ile çalışmaz. Daima `npm run dev` kullanın.

---

## Lisans & Notlar

Bu repo BidPazar platformunun web bileşenidir. Mobil uygulama (`bpmobile`) ayrı bir kod tabanında geliştirilmektedir ve bu README kapsamı dışındadır.

Geliştirme kuralları için `.cursorrules`, mimari kararlar için `STRUCTURES.md`, refactor planları için `REFACTOR.md` / `REFACTORING.md`, yol haritası için `roadmap.md` ve `LIVE_STREAMS_ROADMAP.md` dosyalarına bakabilirsiniz.
