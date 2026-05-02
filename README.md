# BidPazar — Web & Mobil Platform

**BidPazar**, canlı yayın üzerinden gerçek zamanlı açık artırma deneyimi sunan, hem web hem mobil platformları kapsayan bir e-ticaret/müzayede ürünüdür. Satıcılar canlı yayın açar, ürünleri tanıtır ve izleyiciler yayın boyunca anlık teklif vererek satın alabilir.

Bu monorepo iki ana bileşen içerir:

| Bileşen | Klasör | Stack |
|---|---|---|
| **Web (Next.js + custom Node.js + Socket.IO)** | repo kökü | Next.js 15, Prisma, PostgreSQL, LiveKit, Redis, Coturn |
| **Mobil (Expo / React Native)** | `bpmobile/` | Expo SDK 53, React Native 0.79, EAS Build/Submit |

LiveKit sunucusu sunucuda **ayrı bir `docker-compose.yaml` ile** çalıştırılır.

---

## İçindekiler

- [Mimari Genel Bakış](#mimari-genel-bakış)
- [Web Tarafı](#web-tarafı)
  - [Web Teknoloji Yığını](#web-teknoloji-yığını)
  - [Web Proje Yapısı](#web-proje-yapısı)
  - [Veritabanı Modeli](#veritabanı-modeli)
  - [Web Ortam Değişkenleri](#web-ortam-değişkenleri)
  - [Web Kurulum & Çalıştırma](#web-kurulum--çalıştırma)
  - [LiveKit (Sunucuda Ayrı Çalışır)](#livekit-sunucuda-ayrı-çalışır)
  - [Yardımcı Servisler (Redis & Coturn)](#yardımcı-servisler-redis--coturn)
  - [Web API Yapısı](#web-api-yapısı)
  - [Socket.IO Olayları](#socketio-olayları)
  - [Web Production Deployment](#web-production-deployment)
- [Mobil Tarafı (`bpmobile/`)](#mobil-tarafı-bpmobile)
  - [Mobil Teknoloji Yığını](#mobil-teknoloji-yığını)
  - [Mobil Proje Yapısı](#mobil-proje-yapısı)
  - [Ekranlar (Native vs WebView)](#ekranlar-native-vs-webview)
  - [Mobil Ortam Değişkenleri](#mobil-ortam-değişkenleri)
  - [Mobil Kurulum & Çalıştırma](#mobil-kurulum--çalıştırma)
- [Web ↔ Mobil Entegrasyonu](#web--mobil-entegrasyonu)
  - [Mobil Tespit Parametreleri](#mobil-tespit-parametreleri)
  - [Auth Köprüsü (Native ↔ WebView)](#auth-köprüsü-native--webview)
  - [Cookie Paylaşımı (SSR Uyumu)](#cookie-paylaşımı-ssr-uyumu)
  - [Tema Senkronizasyonu](#tema-senkronizasyonu)
  - [Native Ekran ↔ Native API](#native-ekran--native-api)
  - [App Version Uyumu](#app-version-uyumu)
  - [Deep Linking](#deep-linking)
- [Komutlar (Scripts)](#komutlar-scripts)
- [Test](#test)
- [Sorun Giderme](#sorun-giderme)
- [iOS App Store Yayınlama](#ios-app-store-yayınlama)
- [Google Play Store Yayınlama](#google-play-store-yayınlama)
- [Hızlı Mağaza Komutları](#hızlı-mağaza-komutları)

---

## Mimari Genel Bakış

```
┌────────────────────┐                       ┌─────────────────────────┐
│  Mobil (Expo RN)   │  HTTPS / WSS / Deep   │  Tarayıcı kullanıcısı   │
│  bpmobile/         │  ◄──────────────────► │  (web)                  │
└─────────┬──────────┘                       └─────────────┬───────────┘
          │ WebView (com.bidpazar.mobile)                  │
          │ + native screens (Login/Register/Messages...)  │
          │ + native fetch → /api/*                        │
          │                                                │
          │      mobile=true&app=1&web_app=true            │
          │      Authorization: Bearer <jwt>               │
          │      Cookie: token=<jwt>                       │
          └───────────────────┬────────────────────────────┘
                              │
                ┌─────────────▼──────────────────────────────┐
                │  Next.js + server.js (web)                 │
                │  - App Router (RSC)                        │
                │  - REST API (/api/*)                       │
                │  - Socket.IO (chat, bidding, presence)     │
                │  - JWT (jose) auth + middleware            │
                └────┬───────────────┬──────────────────┬────┘
                     │               │                  │
                Prisma │             │ Redis            │ Token üret
                     ▼               ▼                  ▼
              ┌────────────┐  ┌────────────┐    ┌────────────────────┐
              │ PostgreSQL │  │   Redis    │    │   LiveKit Server   │
              │  (ayrı)    │  │     7      │◄──►│ (sunucuda ayrı     │
              └────────────┘  └────────────┘    │  docker-compose)   │
                                                │  ws://7880, UDP    │
                                                │  50000-60000       │
                                                └────────────────────┘
                                                          ▲
                                                          │
                                              ┌───────────┴────────┐
                                              │   Coturn (TURN)    │
                                              │   3478, 5349       │
                                              └────────────────────┘
```

**Temel akış**:
1. Satıcı (web veya mobil) yayın oluşturur, **LiveKit** üzerinden ses/video yayınlar.
2. İzleyiciler yayına katılır, **Socket.IO** üzerinden chat ve teklif iletişimi yapar.
3. Teklifler önce **REST API + Prisma** ile veritabanına yazılır, ardından Socket.IO odasına yayınlanır.
4. Yayın bitince kazanan teklif sahibi belirlenir, `Order` kaydı üretilir.
5. Mobil uygulama içerideki sayfaları **WebView** ile gösterir; ancak Login/Register/SMS doğrulama/Profil/Mesajlar/Bildirimler **native ekran** olarak çalışır ve API'yi doğrudan çağırır.
6. Native auth durumu WebView'a `injectedJavaScript` ile seed edilir ve cookie köprüsü ile SSR'a aktarılır.

---

## Web Tarafı

### Web Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 15 (App Router)** + Custom Node.js Server (`server.js`) |
| Dil | **TypeScript** + JavaScript (server.js) |
| Veritabanı | **PostgreSQL** (ayrı çalışır) |
| ORM | **Prisma 6** |
| Gerçek Zamanlı Medya | **LiveKit** (`livekit-client`, `@livekit/components-react`, `livekit-server-sdk`) |
| Gerçek Zamanlı Mesajlaşma & Teklif | **Socket.IO 4** |
| Stil | **Tailwind CSS** + CSS Değişkenleri (light/dark) |
| UI Bileşenleri | Radix UI primitives, **lucide-react**, `sonner`, `react-hot-toast` |
| Form | `react-hook-form` + `zod` |
| Auth | Custom **JWT** (`jose`, Edge uyumlu) + NextAuth.js hibrit |
| SMS | Mutlucell |
| Cache | **Redis 7** |
| WebRTC NAT | **Coturn** (TURN/STUN) |
| Test | Jest + Testing Library, Playwright |
| Görsel | **sharp** (WebP dönüşümü dahil) |

### Web Proje Yapısı

```
.
├── prisma/
│   ├── schema.prisma                # Tüm modeller ve enum'lar
│   └── migrations/
├── public/uploads/                  # Kullanıcı yüklemeleri
├── src/
│   ├── app/
│   │   ├── (debug)/                 # Debug sayfa grubu
│   │   ├── (static-pages)/          # Statik sayfalar
│   │   ├── admin/                   # Admin paneli (users, products, categories,
│   │   │                            # moderation, seller-requests, streams)
│   │   ├── api/                     # Tüm REST endpoint'leri
│   │   │   ├── admin/, auctions/, auth/, categories/, cron/, devices/,
│   │   │   ├── health/, live-streams/, messages/, moderation/, notifications/,
│   │   │   ├── orders/, product-auctions/, products/, seller-requests/,
│   │   │   ├── socket/, stories/, users/
│   │   ├── categories/, products/, search/, sellers/
│   │   ├── dashboard/               # Profil, mesajlar, siparişler,
│   │   │                            # kazanılan açık artırmalar, adresler
│   │   ├── live-streams/            # Yayın listesi, oluşturma, izleme sayfası
│   │   ├── login/, register/        # Kimlik doğrulama
│   │   ├── packages/                # Satıcı paketleri
│   │   ├── globals.css, layout.tsx, error.tsx, not-found.tsx
│   │   └── middleware.ts (içe alınır)
│   ├── components/                  # AuthProvider, BottomNavigation, BidModal,
│   │                                # MobileLayout, MobileSidebar, TopMobileBar,
│   │                                # moderation/, sellers/, ui/ ...
│   ├── contexts/StreamDetailsContext.tsx
│   ├── hooks/                       # useModerationGate, usePageTracking,
│   │                                # useStreamDetails, useSwipeGesture
│   ├── lib/
│   │   ├── api/                     # client, auctions, categories, livestreams,
│   │   │                            # messages, products, users ...
│   │   ├── server/, socket/, hooks/
│   │   ├── auth.ts, frontend-auth.ts
│   │   ├── livekit.ts               # LiveKit token üretimi (server-only)
│   │   ├── prisma.ts                # Prisma singleton
│   │   ├── moderation-service.ts
│   │   ├── webrtc-config.ts
│   │   ├── sms.ts, image-utils.ts, imageLoader.ts ...
│   ├── tests/, types/
│   └── middleware.ts                # Edge runtime auth guard
├── scripts/
│   ├── create-test-users.ts, create-users.sql, start-server.sh
├── server.js                        # Custom Next.js + Socket.IO sunucusu
├── docker-compose.yml               # Tam stack
├── docker-compose.prod.yml          # Production override
├── docker-compose-dev.yml           # Local dev: redis + coturn + livekit
├── docker-compose.livekit.yml       # SADECE LiveKit (sunucuda ayrı çalıştırılır)
├── docker-compose-pgsql.yaml        # PostgreSQL (ayrı çalıştırılır)
├── livekit.yaml, livekit.local.yaml, livekit.prod.yaml
├── Dockerfile                       # Multi-stage Node 22 build
├── .env.example, .env.local.example
└── package.json
```

### Veritabanı Modeli

`prisma/schema.prisma` ana model grupları:

- **Kullanıcı & Sosyal**: `User`, `Follows`, `Story`
- **Katalog**: `Category`, `Product`, `ProductMedia`
- **Müzayede**: `AuctionListing`, `Bid`, `ProductAuction`
- **Canlı Yayın**: `LiveStream`, `LiveStreamProduct`, `LiveStreamBid`, `ChatMessage`, `StreamHighlight`, `StreamReward`, `StreamShare`, `StreamViewTime`, `StreamModeration`, `StreamAnalytics`
- **Mesajlaşma & Bildirim**: `Conversation`, `Message`, `Notification`
- **Sipariş**: `Order`
- **Satıcı**: `SellerRequest` (onay akışı, aylık ürün/yayın kotaları User'da)
- **Moderasyon**: `ContentReport`, `ModerationAction`, `ContentFilter`, `UserViolation`, `UserAppeal`

Önemli enum'lar: `StreamStatus`, `ListingStatus`, `NotificationType`, `RewardType`, `SharePlatform`, `UserType`, `SellerRequestStatus`, `StoryType`, `OrderStatus`, `OrderType`, `ReportContentType`, `ReportReason`, `ReportStatus`, `ModerationActionType`, `AppealStatus`.

### Web Ortam Değişkenleri

Tam liste için `.env.example`. Önemli olanlar:

**Sunucu (server-only — `NEXT_PUBLIC_` *olmadan*):**

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı dizesi |
| `JWT_SECRET` | JWT imzalama anahtarı |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | NextAuth |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit credentials (≥32 karakter) |
| `LIVEKIT_URL` | LiveKit HTTP URL'i (sunucu içi) |
| `REDIS_URL` | Redis bağlantı dizesi |
| `SMS_USERNAME`, `SMS_PASSWORD`, `SMS_ORIGIN`, `SMS_API_URL`, `SEND_MESSAGE` | SMS (Mutlucell) |
| `APP_VERSION` | Token doğrulamada kullanılır — mobil ile **eşleşmek zorunda** |
| `DEBUG_AUTH`, `DEBUG_NOTIFICATIONS`, `DEBUG_MESSAGES`, `DEBUG_CHAT`, `DEBUG_ACTIVE_BID` | Debug bayrakları |
| `GA_MEASUREMENT_ID` | Server-side GA |

**İstemci (`NEXT_PUBLIC_` ile — tarayıcıya gider; secret koymayın):**

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` | Public URL'ler |
| `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_WS_URL` | Socket.IO |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit WebSocket (`wss://live.bidpazar.com`) |
| `NEXT_PUBLIC_STUN_SERVER_URL`, `NEXT_PUBLIC_TURN_SERVER_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_PASSWORD` | WebRTC |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager |

> **Asla `NEXT_PUBLIC_*` ile secret yayınlamayın** (`JWT_SECRET`, `LIVEKIT_API_SECRET`, `DATABASE_URL`, SMS şifreleri).

### Web Kurulum & Çalıştırma

```bash
# 1) Bağımlılıkları yükle
npm install

# 2) Ortam dosyalarını oluştur
cp .env.example .env
cp .env.local.example .env.local
# DATABASE_URL, JWT_SECRET, LIVEKIT_*, REDIS_URL, SMS_* doldurun

# 3) Prisma client + migration
npm run prisma:generate
npm run prisma:migrate

# 4) Yardımcı servisleri (Redis + Coturn + LiveKit) docker ile başlat
docker compose -f docker-compose-dev.yml up -d

# 5) Uygulamayı başlat (custom server + Socket.IO)
npm run dev
# -> http://localhost:3000
```

> Custom Node.js sunucusu (`server.js`) Socket.IO'yu Next.js HTTP sunucusuyla aynı süreçte birleştirir. **`next dev` doğrudan kullanılmaz**; `npm run dev` daima `server.js` üzerinden başlar. Aksi halde canlı yayın chat/teklif akışı çalışmaz.

### LiveKit (Sunucuda Ayrı Çalışır)

Bu projede **LiveKit sunucusu, web uygulamasından bağımsız bir `docker-compose.yaml` ile sunucuda ayrı çalıştırılır**. Bu sayede LiveKit farklı bir host üzerinde, farklı kaynaklarla ölçeklendirilebilir.

LiveKit ile ilgili dosyalar:

| Dosya | Amaç |
|---|---|
| `docker-compose.livekit.yml` | **Sadece** LiveKit container'ı (production'da ayrı çalıştırmak için) |
| `docker-compose-dev.yml` | Local dev: Redis + Coturn + LiveKit birlikte |
| `livekit.yaml` | Varsayılan/fallback konfigürasyon |
| `livekit.local.yaml` | Local geliştirme |
| `livekit.prod.yaml` | Production (public IP, STUN, TURN) |

**Production sunucusunda LiveKit'i ayrı çalıştırma:**

```bash
docker compose -f docker-compose.livekit.yml up -d
docker logs -f livekit
curl http://<sunucu-ip>:7880/   # health check
```

**Açılması gereken portlar:**

| Port | Protokol | Amaç |
|---|---|---|
| 7880 | TCP | Signal / HTTP |
| 7881 | UDP/TCP | Media (RTC TCP fallback) |
| 7882 | TCP | Media (TCP/TURN fallback) |
| 5349 | UDP | Media |
| 3478 | UDP | TURN |
| 50000-60000 | UDP | WebRTC media (production) |

**Web → LiveKit bağlantısı:**

```env
# Sunucu (token üretimi için)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=dev-secret-key-at-least-32-characters-long-for-security
LIVEKIT_URL=https://live.bidpazar.com   # production
# LIVEKIT_URL=http://localhost:7880     # local

# İstemci (tarayıcı bağlantısı)
NEXT_PUBLIC_LIVEKIT_URL=wss://live.bidpazar.com   # production
# NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880     # local
```

Token üretimi `src/lib/livekit.ts` içindeki `createLiveKitToken()` ile yapılır; **API secret asla istemciye gönderilmez**.

### Yardımcı Servisler (Redis & Coturn)

```bash
# Local: Redis + Coturn + LiveKit birlikte
docker compose -f docker-compose-dev.yml up -d
docker compose -f docker-compose-dev.yml ps
docker compose -f docker-compose-dev.yml logs -f
```

PostgreSQL ayrı yönetilir; gerekirse `docker-compose-pgsql.yaml` ile başlatılabilir.

### Web API Yapısı

`src/app/api/` altında App Router RESTful yapısı. Kurallar:

- Koleksiyon: `[resource]/route.ts` — Öğe: `[resource]/[id]/route.ts`
- Tüm girdiler **Zod** ile doğrulanır
- Yanıt formatı:
  - Başarı: `{ data: any, meta?: any }`
  - Hata: `{ error: string, details?: any }`
- Desteklenmeyen HTTP metodları için `405`
- Korumalı uçlar: `withAuthHeader()` ya da middleware

Önemli kaynak grupları: `auth/`, `users/`, `products/`, `categories/`, `live-streams/`, `auctions/`, `product-auctions/`, `messages/`, `notifications/`, `orders/`, `seller-requests/`, `moderation/`, `admin/`, `stories/`, `devices/`, `cron/`, `health/`, `socket/`.

### Socket.IO Olayları

Socket.IO örneği `server.js` içinde Next.js HTTP sunucusuna entegre olur ve API rotalarından `global.socketIO` ile erişilebilir.

| Oda | Amaç |
|---|---|
| `stream:{streamId}` | Yayın katılımcıları (chat, teklif, izleyici sayısı) |
| `user:{userId}` | Kullanıcıya özel bildirimler |
| `conversation:{conversationId}` | Birebir mesajlaşma |

Tipik akış:
1. Tarayıcı handshake'te token gönderir
2. Sunucu kullanıcıyı doğrulayıp odalara dahil eder
3. Mesaj/teklif önce REST API ile DB'ye yazılır, sonra Socket.IO ile yayınlanır
4. Disconnect olduğunda izleyici sayısı güncellenir

Debug bayrakları: `DEBUG_CHAT`, `DEBUG_MESSAGES`, `DEBUG_ACTIVE_BID`, `DEBUG_NOTIFICATIONS`.

### Web Production Deployment

```bash
# Tam stack (LiveKit, Redis, Coturn dahil)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Sadece web (LiveKit ayrı host'ta varsa)
docker build -t bidpazar-web .
docker run -d --name bidpazar-web -p 3000:3000 --env-file .env.prod bidpazar-web

# Health check
curl https://bidpazar.com/api/health
curl https://live.bidpazar.com/
```

`Dockerfile` çok aşamalı (deps → builder → runner) Node 22 imajıdır; Next.js standalone output kullanır. Reverse proxy olarak Nginx (örnek: `nginx.conf.example`) veya Caddy önerilir; LiveKit için ayrı bir alt domain (örn. `live.bidpazar.com`) kullanılır.

---

## Mobil Tarafı (`bpmobile/`)

`bpmobile/` klasörü; iOS ve Android için **Expo (React Native)** tabanlı mobil uygulamayı içerir. Uygulama; **bir yandan native ekranlar** (Home, Login, Register, SMS doğrulama, Profil, Mesajlar, Bildirimler), **bir yandan da WebView** içeren hibrit bir yapıdadır. WebView, web tarafının mobil-öncelikli sayfalarını gösterir; native köprü ile auth/cookie/tema senkronize edilir.

### Mobil Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | **Expo SDK 53**, React Native **0.79.6**, React **19** |
| Dil | TypeScript 5.8 |
| Navigasyon | `@react-navigation/native` v7 + native stack |
| WebView | `react-native-webview` 13.13 |
| Storage | `@react-native-async-storage/async-storage` (Android), `expo-secure-store` (iOS Keychain) |
| Cookie köprüsü | `@react-native-cookies/cookies` |
| Network | `@react-native-community/netinfo` |
| Deep Link | `expo-linking` (`bidpazar://`) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Build & Submit | **EAS (Expo Application Services)** |
| Bundle ID | `com.bidpazar.mobile` (iOS bundle / Android package) |
| EAS Project ID | `f1dc6bab-c041-440a-9788-eaafcf984dcd` |

### Mobil Proje Yapısı

```
bpmobile/
├── App.tsx                       # ErrorBoundary + AuthProvider + ThemedAppContainer
├── index.ts                      # registerRootComponent(App)
├── app.json                      # Expo config (bundleId, ikonlar, izinler,
│                                 # privacyManifests, plugins)
├── eas.json                      # EAS build profiles (development, preview, production)
├── package.json
├── tsconfig.json
├── android/                      # Native Android proje (expo prebuild çıktısı)
├── ios/                          # Native iOS proje (expo prebuild çıktısı)
├── assets/                       # icon.png (1024x1024), splash-icon.png,
│                                 # adaptive-icon.png, favicon.png
├── src/
│   ├── components/
│   │   └── NetworkBanner.tsx     # Çevrimdışı uyarı çubuğu
│   ├── constants/
│   │   ├── theme.ts              # COLORS, SHADOWS, TYPOGRAPHY (light/dark)
│   │   └── urls.ts               # BASE_URL ve tüm endpoint URL'leri
│   ├── context/
│   │   └── AuthContext.tsx       # Global auth state, tema, cookie köprüsü
│   ├── lib/
│   │   └── frontend-auth.ts      # JWT login/register/verify/validate;
│   │                             # iOS Keychain (SecureStore) + retry logic
│   ├── navigation/
│   │   ├── AppNavigator.tsx      # RootStack + AppStack + AuthStack
│   │   └── types.ts              # Param list tipleri
│   └── screens/
│       ├── OnboardingScreen.tsx  # İlk açılış tanıtımı (AsyncStorage flag)
│       ├── HomeScreen.tsx        # Native ana ekran (canlı yayınlar, ilanlar,
│       │                         # hikayeler, hızlı erişim, hesap kartları)
│       ├── LoginScreen.tsx       # Native giriş
│       ├── RegisterScreen.tsx    # Native kayıt
│       ├── VerifySmsScreen.tsx   # Native SMS doğrulama
│       ├── ProfileEditScreen.tsx # Native profil düzenleme
│       ├── MessagesScreen.tsx    # Native mesaj listesi
│       ├── NotificationsScreen.tsx
│       ├── AccountScreen.tsx
│       └── WebViewScreen.tsx     # Web sayfalarını gösteren WebView (köprü ile)
├── README.md, AGENTS.md, openspec/
├── android-store.md              # Google Play Store kılavuzu (uçtan uca)
├── ios-store.md                  # Apple App Store kılavuzu (uçtan uca)
└── send-stores.md                # Kısa mağaza özeti
```

### Ekranlar (Native vs WebView)

| Ekran | Tür | Açıklama |
|---|---|---|
| **Onboarding** | Native | İlk açılışta gösterilir (`AsyncStorage.onboardingCompleted`). |
| **Home** | Native | `@react-native-community`/Ionicons ile özel UI. `/api/live-streams?onlyActive=true`, `/api/product-auctions?status=ACTIVE`, `/api/products`, `/api/stories` doğrudan çağrılır. Hızlı erişim kartları WebView'a yönlendirir. |
| **Login / Register / VerifySms** | Native | `frontend-auth.ts` üzerinden `/api/auth/{login,register,verify,resend-verification}` çağrılır. Token alındığında Keychain/AsyncStorage + cookie köprüsü beslenir. |
| **ProfileEdit / Messages / Notifications / Account** | Native | API'yi doğrudan çağıran native ekranlar. |
| **WebView** | Hibrit | `live-streams/[id]`, `dashboard/*`, `categories`, `products`, `search` gibi sayfaları gösterir; `injectedJavaScript` ile auth/tema seed edilir. |

URL haritası `src/constants/urls.ts` içindedir. Her web URL'sine **mobil tespit parametreleri** eklenir (aşağıda).

### Mobil Ortam Değişkenleri

```env
# bpmobile/.env / .env.local
# Backend API base URL — local için bilgisayarınızın LAN IP'sini kullanın,
# `localhost` cihazda yanlış çözümlenir.
EXPO_PUBLIC_API_URL=https://bidpazar.com           # production
# EXPO_PUBLIC_API_URL=http://192.168.1.10:3000     # local LAN testi
```

`EXPO_PUBLIC_*` prefix'i Expo build sırasında istemciye gömülür. Build profili bazlı override `eas.json` içinde tutulur — `development`, `preview`, `production` profillerinin tümü `EXPO_PUBLIC_API_URL=https://bidpazar.com` ile build edilir.

### Mobil Kurulum & Çalıştırma

```bash
cd bpmobile
npm install

# Expo dev server (Expo Go veya dev client)
npm start

# Native build + cihazda çalıştır
npm run ios       # macOS gerekli (Xcode)
npm run android   # Android Studio + emulator/cihaz

# Web preview (rare; debug)
npm run web
```

> Expo Go ile çalışırken native modüllerin (`expo-secure-store`, `@react-native-cookies/cookies`) bazıları kısıtlı çalışır. Tam doğrulama için `npm run ios` / `npm run android` ile native build önerilir.

---

## Web ↔ Mobil Entegrasyonu

Mobil uygulama, web tarafı ile **dört farklı yolla** konuşur:

1. **WebView** üzerinden Next.js sayfalarını yükler (UI bütünlüğü, tek kaynaklı tasarım).
2. **Native HTTP fetch** ile `/api/*` çağrıları yapar (Login, Register, Home feed, Notifications…).
3. **Auth köprüsü** ile native JWT durumu WebView'ın `localStorage`'ına seed edilir.
4. **Cookie köprüsü** ile aynı JWT, web SSR'ın okuduğu HTTP cookie store'una yazılır.

### Mobil Tespit Parametreleri

Tüm web URL'lerine `bpmobile/src/constants/urls.ts` içindeki `createUrl()` yardımcısı şu sorgu parametrelerini ekler:

```
?mobile=true&app=1&web_app=true
```

Bu parametreler web tarafında mobil-özel UI/UX davranışlarını (alt navigasyon, sade düzen, native gibi davranan kontroller, AppBar gizleme vb.) tetiklemek için kullanılır. Mobile-specific CSS ve script'ler `WebViewScreen.tsx` tarafından da enjekte edilir.

### Auth Köprüsü (Native ↔ WebView)

`bpmobile/src/screens/WebViewScreen.tsx` içindeki `getInjectedJavascript()` her WebView yüklemesinde şunları yapar:

1. Native auth durumunu IIFE içine **doğrudan gömer** (`injectedToken`, `injectedUser`, `injectedTheme`).
2. WebView yüklenir yüklenmez `localStorage.setItem('auth', JSON.stringify({ token, user }))` yazar — yani Next.js client-side `frontend-auth` mantığı tokenı hemen bulur.
3. Native logout durumunda WebView içindeki `localStorage.auth` ve `localStorage.token` agresif şekilde temizlenir (`localStorage.clear()` dahil) — "native logged out, WebView still authed" çakışması olmaz.
4. Tema değişimini `applyTheme()` ile `data-theme` attribute'una yazar; CSS değişkenleri buna tepki verir.
5. Mobile-only style ve viewport düzeltmeleri enjekte edilir (alt nav sabitleme, scroll fix, Android tap-highlight vb.).

Login/Register/Verify ekranları **native** olduğu için, bu akış sonunda `setAuth(token, user)` çağrılır:

- **iOS**: `expo-secure-store` (Keychain) — retry logic + AsyncStorage fallback
- **Android**: `AsyncStorage` (üç anahtar: `bidpazar_auth`, `bidpazar_token`, `bidpazar_user` + paylaşılan `auth` anahtarı)

Sonraki WebView yüklemelerinde bu token enjekte edilir; uygulama yeniden açıldığında `validateToken(true)` ile `/api/auth/validate?appVersion=...` çağrılarak server-side doğrulanır.

### Cookie Paylaşımı (SSR Uyumu)

Sadece `localStorage` enjekte etmek yeterli değildir; **Next.js SSR sayfaları HTTP cookie'leri okur** (özellikle middleware ve server component'ler). Bu nedenle `AuthContext.tsx`, native auth set edilirken `@react-native-cookies/cookies` ile şu cookie'leri paylaşımlı cookie store'a yazar:

- `authToken` ve `token` cookies (her ikisi de — backend ikisini de kabul eder)
- `path=/`, `version=1`, 7 gün TTL, `sameSite=Lax`
- `secure` bayrağı `BASE_URL` https ise `true`, http ise `false`
- Domain'i hem `host` hem `.host` olarak iki kez yazar (subdomain compat)

Akışlar:

| Olay | Ne yapılır |
|---|---|
| `setAuthState(token, user)` | Cookie'ler `BASE_URL` için yazılır |
| Cold start (uygulama açılır, token bulunur) | Cookie'ler ile-tohumlanır, sonra `validateToken` çağrılır |
| `refreshAuthState()` başarılıysa | Cookie'ler tekrar yazılır (server'dan gelen güncel token ile) |
| `logout()` | `CookieManager.clearByName(BASE_URL, 'token')` veya `clearAll()` çağrılır |

Bu sayede: native logout yapıldığında WebView SSR'a artık authed user'mış gibi davranamaz.

### Tema Senkronizasyonu

- `AuthContext` içinde `theme: 'light' | 'dark'` durumu `AsyncStorage` ile persisted.
- Tema her değiştiğinde, sonraki WebView yüklemesindeki `injectedJavaScript` yeni temayı `data-theme` ve `localStorage.theme` üzerine yazar.
- Web tarafı CSS değişkenleri (`var(--background)`, `var(--foreground)` vb.) `data-theme` attribute'una göre dark/light geçer.

### Native Ekran ↔ Native API

Bazı sayfalar performans ve UX için tamamen native:

| Ekran | Çağırdığı API |
|---|---|
| HomeScreen | `/api/live-streams?onlyActive=true`, `/api/product-auctions?status=ACTIVE`, `/api/products`, `/api/stories` |
| MessagesScreen | `/api/messages/conversations`, `/api/messages/messages` |
| NotificationsScreen | `/api/notifications`, `/api/notifications/read` |
| LoginScreen | `/api/auth/login` |
| RegisterScreen | `/api/auth/register` |
| VerifySmsScreen | `/api/auth/verify`, `/api/auth/resend-verification` |
| ProfileEditScreen | `/api/user/profile` |

Tüm bu çağrılar `Authorization: Bearer <jwt>` header'ı ile yapılır.

### App Version Uyumu

- Web `.env` içinde `APP_VERSION` değişkeni ile sunucu mevcut sürümünü belirler.
- Mobil `frontend-auth.ts` içinde `APP_VERSION = "1.0.0"` sabittir.
- `validateToken(true)` çağrısı `?appVersion=<v>` query'siyle gider; sunucu sürüm uyuşmazsa `412` döner.
- `412` yakalandığında mobil tarafta auth tamamen temizlenir (`removeAuth()`), kullanıcı yeniden giriş yapar.
- Web/mobil sürüm artırılırken her iki yerde de `APP_VERSION` güncellenmelidir (zorunlu logout için).

### Deep Linking

`bpmobile/app.json` ve `AppNavigator.tsx`:

- Scheme: `bidpazar://`
- Routes:
  - `bidpazar://` → Home
  - `bidpazar://webview` → WebView
  - `bidpazar://profile/edit` → ProfileEdit
  - `bidpazar://messages` → Messages
  - `bidpazar://notifications` → Notifications
  - `bidpazar://onboarding` → Onboarding

iOS Universal Link / Android App Link kurulumu yapılırsa `bidpazar.com` üzerindeki belirli URL'ler doğrudan native uygulamada açılabilir (bu kurulum opsiyoneldir; `apple-app-site-association` ve `assetlinks.json` dosyaları gerekir).

---

## Komutlar (Scripts)

### Web (`package.json`)

| Komut | Açıklama |
|---|---|
| `npm run dev` | Custom server + Socket.IO ile geliştirme |
| `npm run dev:next` | Sadece `next dev` (Socket.IO yok — nadiren) |
| `npm run build` | Production build |
| `npm run build:no-lint` | Lint/type-check atla |
| `npm start` | Production'da `server.js` |
| `npm run start:next` | Production'da yalnızca Next.js |
| `npm run lint` | ESLint |
| `npm test` / `test:watch` / `test:coverage` / `test:ci` | Jest |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:studio` | Prisma araçları |

### Mobil (`bpmobile/package.json`)

| Komut | Açıklama |
|---|---|
| `npm start` | `expo start` (dev server) |
| `npm run ios` | `expo run:ios` (native build + simulator) |
| `npm run android` | `expo run:android` |
| `npm run web` | `expo start --web` |

### EAS (Mobil dağıtım — global CLI)

| Komut | Açıklama |
|---|---|
| `eas login` | Expo hesabıyla giriş |
| `eas credentials --platform ios` / `--platform android` | Sertifika/keystore yönetimi |
| `eas build --platform ios --profile production` | iOS production `.ipa` |
| `eas build --platform android --profile production` | Android production `.aab` |
| `eas build --platform all --profile production` | Her ikisi |
| `eas submit --platform ios --latest` | Son build'i App Store Connect'e yükle |
| `eas submit --platform android --latest` | Son build'i Play Console'a yükle |
| `eas build --platform all --profile production --auto-submit` | Build + submit tek seferde |
| `eas build:list --platform <ios\|android>` | Build geçmişi |
| `eas diagnostics` | Ortam kontrolü |

---

## Test

- **Web**: Jest (`jest.config.js`) + Testing Library + Playwright. `npm test`, `npm run test:coverage`.
- **Mobil**: Manuel test + `eas build --profile preview` ile cihazda doğrulama. Otomatik test henüz yok.

---

## Sorun Giderme

### Web

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| `npm run dev` Socket.IO başlatmıyor | `next dev` direkt çağrılmış | `npm run dev` (server.js) kullanın |
| LiveKit bağlanmıyor | Anahtar eşleşmiyor | `livekit*.yaml` `keys` ile `.env` `LIVEKIT_API_KEY/SECRET` aynı olmalı |
| Redis hatası | Şifre yanlış | `REDIS_URL` parolası container ile eşleşmeli |
| TURN test | `turnutils_uclient -v -t -T -u <user> -w <pass> <host>` |
| 412 logout döngüsü | `APP_VERSION` uyumsuz | Build ve runtime `APP_VERSION` aynı olsun |

### Mobil

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| Cihazda `localhost` çalışmıyor | RN cihazda kendi loopback'ine bakar | LAN IP kullanın (`http://192.168.x.x:3000`) |
| iOS auth kayboluyor | SecureStore retry yetmedi | Otomatik AsyncStorage fallback devreye girer; logları kontrol edin |
| WebView'da kullanıcı görünmüyor (SSR) | Cookie köprüsü kurulmamış | `@react-native-cookies/cookies` yüklü mü; `BASE_URL` https mi (secure cookie) |
| 412 sonrası sürekli logout | Web `APP_VERSION` ≠ mobil `APP_VERSION` | İki tarafı da güncelleyin |
| Bottom nav scroll ile kayıyor | WebView CSS override eksik | `WebViewScreen.tsx` mevcut; build cache temizleyip tekrar deneyin |

---

# iOS App Store Yayınlama

> Detaylı sürüm: [`bpmobile/ios-store.md`](bpmobile/ios-store.md). Buradaki bölüm proje teslimine yetecek özetidir.

## 1. Ön Koşullar

- **Apple Developer Program** üyeliği aktif (yıllık $99)
- macOS + Xcode (sertifika ve test için)
- EAS CLI: `npm install -g eas-cli`
- `eas login` ile Expo hesabına giriş
- App-Specific Password ([appleid.apple.com](https://appleid.apple.com) → Oturum Açma ve Güvenlik → Uygulamaya Özel Parolalar)

## 2. Proje Konfigürasyon Kontrolü (`bpmobile/app.json`)

Mevcut kurulum App Store kurallarıyla uyumludur:

| Alan | Değer |
|---|---|
| `bundleIdentifier` | `com.bidpazar.mobile` |
| `buildNumber` | `1` (EAS otomatik artırır) |
| `supportsTablet` | `true` (iPad ekran görüntüsü zorunlu olur) |
| `ITSAppUsesNonExemptEncryption` | `false` (export compliance otomatik geçer) |
| `NSPhotoLibraryUsageDescription` | "Profil fotoğrafı ve ürün görselleri yüklemek için..." |
| `NSCameraUsageDescription` | "Profil fotoğrafı ve ürün görselleri çekmek için..." |
| `privacyManifests` | NSPrivacyAccessedAPIType girişleri tanımlı |

`assets/icon.png` 1024×1024, **alfa kanalı içermemeli** (opak PNG).

## 3. Production Build Alma

```bash
cd bpmobile
eas build --platform ios --profile production
```

İlk seferde:

1. EAS, Apple ID'nizi ve App-Specific Password'ü ister.
2. Distribution Certificate ve Provisioning Profile'ı **otomatik üretir** (alternatif: `eas credentials --platform ios` ile manuel yönetim).
3. Build bulutta 15-30 dk sürer.
4. Tamamlandığında bir `.ipa` indirme linki verir.

**Sertifikaları yedekleyin** — kaybedilirse uygulama güncellenemez:

```bash
eas credentials --platform ios   # → "Download credentials"
```

## 4. App Store Connect — Uygulama Kaydı

[App Store Connect](https://appstoreconnect.apple.com) → **Uygulamalarım → + → Yeni Uygulama**:

| Alan | Değer |
|---|---|
| Platform | iOS |
| Ad | BidPazar |
| Birincil Dil | Türkçe |
| Bundle ID | `com.bidpazar.mobile` (listeden) |
| SKU | `bidpazar-mobile` |
| Kullanıcı Erişimi | Tam Erişim |

## 5. Mağaza Bilgileri

**App Store** sekmesinde:

- **Alt Başlık** (≤30 karakter): `Açık Artırma ile Alışveriş`
- **Kategori**: Alışveriş (ikincil: Yaşam Tarzı)
- **Açıklama** (örnek):
  ```
  BidPazar, Türkiye'nin yeni nesil açık artırma ve alışveriş platformudur.
  Özellikler:
  • Canlı açık artırmalara katılın
  • Güvenli alışveriş deneyimi
  • Anlık bildirimler
  • Mesajlaşma
  • Profil ve sipariş yönetimi
  ```
- **Anahtar Kelimeler** (≤100 karakter, virgülle, boşluksuz): `açık artırma,alışveriş,teklif,bidpazar,ihale,müzayede,pazar,satış,fırsat`
- **Destek URL**: `https://bidpazar.com/support`
- **Gizlilik Politikası URL** (zorunlu, aktif olmalı): `https://bidpazar.com/privacy`

## 6. Ekran Görüntüleri

| Cihaz | Boyut (px) | Zorunlu |
|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320×2868 | Evet |
| iPhone 5.5" (iPhone 8 Plus) | 1242×2208 | Evet |
| iPad Pro 13" | 2048×2732 | Evet (`supportsTablet: true`) |
| iPad Pro 11" | 1668×2388 | Önerilir |

Her boyut için 2-10 görsel. Önerilen ekran sırası: Ana sayfa → Ürün/Açık Artırma → Bildirimler → Mesajlar → Profil. Çerçeve eklemek için Figma veya screenshots.pro.

## 7. Yaş Derecelendirmesi & Gizlilik

- **Yaş**: Cinsel/şiddet/kumar/madde sorularına Hayır → genellikle 4+ veya 12+
- **App Privacy** (Gizlilik Etiketleri):
  - Topla: E-posta, Ad-Soyad, Telefon, Fotoğraflar (profil), Kullanım verileri
  - Üçüncü taraf paylaşımı: Yok (analitik kullanılıyorsa belirtin)

## 8. Build Yükleme & Review'a Gönderme

```bash
# Otomatik (önerilen)
eas submit --platform ios --latest

# Veya tek komutla build + submit
eas build --platform ios --profile production --auto-submit
```

EAS Submit:
1. Build listesinden seçim yapar.
2. Apple ID + App-Specific Password ister.
3. `.ipa`'yı App Store Connect'e yükler.
4. App Store Connect'te **İşleniyor** (5-30 dk).

Alternatif: EAS Dashboard'dan `.ipa`'yı indirip macOS **Transporter** uygulamasına bırakın.

## 9. Review için Demo Hesap (KRİTİK)

App Store Connect → **App Review Information**:

```
Demo hesap (giriş zorunlu olduğu için):
E-posta: demo@bidpazar.com
Şifre:   DemoTest123!

Bu uygulama açık artırma platformudur. Giriş sonrası ana sayfada
canlı yayınlar, ürün listesi, mesajlar ve bildirimler görüntülenebilir.
```

**Demo hesap eksik → review reddi.**

## 10. Sık Karşılaşılan Red Sebepleri

| Guideline | Sorun | Çözüm |
|---|---|---|
| 4.0 Design (Min Functionality) | "Sadece WebView sarmalayıcısı" | Native ekranları (Login, Home, Push, Messages) review notlarında vurgulayın |
| 2.1 Performance | Çökme/boş ekran | Production build'i gerçek cihazda test edin; `https://bidpazar.com` aktif olsun |
| 5.1.1 Privacy | Gizlilik politikası geçersiz | `https://bidpazar.com/privacy` aktif ve erişilebilir olmalı |
| 3.1.1 IAP | Dijital ürün satışı IAP'sız | BidPazar fiziksel ürün satıyor → IAP gerekmez; review notunda belirtin |

## 11. Güncelleme Yayınlama

```bash
# bpmobile/app.json -> "version": "1.0.0" -> "1.1.0"
# buildNumber EAS tarafından otomatik artar (autoIncrement: true)

eas build --platform ios --profile production --auto-submit
```

App Store Connect → "Bu sürümdeki yenilikler" doldurun → Review.

---

# Google Play Store Yayınlama

> Detaylı sürüm: [`bpmobile/android-store.md`](bpmobile/android-store.md). Buradaki bölüm proje teslimine yetecek özetidir.

## 1. Ön Koşullar

- **Google Play Console** geliştirici hesabı (tek seferlik $25, kimlik doğrulama tamamlanmış)
- EAS CLI: `npm install -g eas-cli` + `eas login`

## 2. Proje Konfigürasyon Kontrolü (`bpmobile/app.json`)

| Alan | Değer |
|---|---|
| `package` | `com.bidpazar.mobile` |
| `versionCode` | `1` (EAS otomatik artırır) |
| `adaptiveIcon.foregroundImage` | `./assets/adaptive-icon.png` (1024×1024, içerik merkezdeki 512×512 güvenli alanda) |
| `adaptiveIcon.backgroundColor` | `#FFFFFF` |
| `icon` | `./assets/icon.png` (512×512+) |

## 3. Keystore (İmza Anahtarı)

İlk production build sırasında EAS sorar:
```
Would you like to generate a new Android Keystore? (Y/n) → Y
```

EAS keystore'u bulutta saklar. **MUTLAKA yedekleyin** — kaybederseniz uygulamanızı asla güncelleyemezsiniz:

```bash
eas credentials --platform android   # → "Download Keystore"
```

Play Console'da **Play App Signing** zorunludur (Setup → App Signing); ilk AAB yüklendiğinde otomatik etkinleşir.

## 4. Production Build Alma

```bash
cd bpmobile
eas build --platform android --profile production
```

- Çıktı: `.aab` (Android App Bundle — Play Store 2021'den beri APK kabul etmiyor)
- Süre: 10-20 dk
- İndirme linki EAS Dashboard ve terminalde görünür

## 5. Play Console — Uygulama Kaydı

[Google Play Console](https://play.google.com/console) → **Tüm uygulamalar → Uygulama oluştur**:

| Alan | Değer |
|---|---|
| Uygulama adı | BidPazar |
| Varsayılan dil | Türkçe — tr-TR |
| Uygulama / oyun | Uygulama |
| Ücretsiz / ücretli | Ücretsiz |

## 6. Mağaza Girişi (Store Listing)

**Ana mağaza girişi → Varsayılan mağaza girişi**:

- **Kısa açıklama** (≤80): `Açık artırma ile alışverişin yeni adresi. Teklif ver, kazan!`
- **Tam açıklama** (≤4000): canlı açık artırma, mesajlaşma, bildirimler, profil yönetimi, güvenli alışveriş özelliklerini öne çıkaran metin (`bpmobile/android-store.md` Bölüm 5.3'te tam metin var).

**Görseller**:

| Görsel | Boyut |
|---|---|
| Uygulama ikonu | 512×512 PNG (alfa OK) |
| Feature Graphic | 1024×500 banner |
| Telefon ekran görüntüleri | min 2, max 8; 1080×1920 önerilir |
| Tablet ekran görüntüleri | Opsiyonel |

## 7. Politika Beyanları

- **İçerik derecelendirmesi**: Diğer (Alışveriş) → şiddet/cinsel/madde Hayır → UGC (kullanıcılar ürün yükleyebilir) → Evet
- **Hedef kitle**: 18+
- **Veri güvenliği** (Data Safety):
  - Toplanan: Kişisel bilgiler (ad, e-posta, telefon), Fotoğraflar (profil), Uygulama etkinliği, Cihaz kimlikleri
  - Aktarımda şifreleme: Evet (HTTPS)
  - Veri silme talep edebilir: Evet → URL: `https://bidpazar.com/account/delete`
- **Gizlilik politikası URL**: `https://bidpazar.com/privacy` (zorunlu, aktif olmalı)
- **Reklam beyanı**: Hayır (reklam yoksa)

## 8. İlk AAB Yüklemesi (Manuel)

> Google Play **ilk** sürümü manuel yüklemenizi ister; EAS Submit ilk yükleme sonrası çalışır.

İndirilen `.aab` dosyasını yükleme kanalları:

| Kanal | Review | Önerilen kullanım |
|---|---|---|
| **Dahili test** | Yok | İlk denemeler |
| **Kapalı test** | 1-3 gün | 20 kişi 14 gün gereksinimi (yeni hesaplar) |
| **Açık test** | 1-3 gün | Beta |
| **Production** | 1-7 gün | Final |

> **Yeni geliştirici hesapları için (2023+)**: Production'a geçmeden önce kapalı testte en az **20 kişi 14 gün** uygulamayı test etmeli. Eski hesaplarda bu kısıt geçerli olmayabilir.

Adımlar:
1. Play Console → Uygulama → **Test → Dahili test → Yeni sürüm oluştur**
2. Play App Signing'i kabul edin
3. `.aab` yükleyin
4. Sürüm notları girin: `BidPazar v1.0.0 - İlk sürüm`
5. **Sürümü incele → Yayınla**

## 9. EAS Submit ile Otomatik Gönderim (Sonraki Sürümler)

Service Account oluştur:

1. [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts → **Create Service Account** (ad: `eas-submit`)
2. Service Account → **Keys → Add Key → Create new key → JSON** → İndir
3. Play Console → **Setup → API erişimi** → Cloud projeyi bağla → Service Account'a yetki ver (Sürüm yönetimi)
4. JSON'ı `bpmobile/play-store-credentials.json` olarak koy ve **`.gitignore`'a ekle**

`bpmobile/eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./play-store-credentials.json"
      }
    }
  }
}
```

Sonra:

```bash
eas submit --platform android --latest
# veya
eas build --platform android --profile production --auto-submit
```

## 10. Sık Karşılaşılan Red Sebepleri

| Sorun | Çözüm |
|---|---|
| Veri güvenliği boş | Bölüm 7'yi tamamlayın |
| Gizlilik politikası geçersiz | `https://bidpazar.com/privacy` aktif olmalı |
| Min fonksiyonalite ("sadece web sarmalayıcısı") | Native ekranlar + push + bottom nav'ı vurgulayın; review notunda native özellikleri listeleyin |
| UGC moderasyon | Web tarafında raporlama ve içerik moderasyonu mevcut; bunu belirtin |
| Hesap silme (2024+ zorunlu) | Hesap silme akışı sunulmalı |

## 11. Kademeli Yayın

Production yayınında %10 → %25 → %50 → %100 aşamalı rollout kullanın; sorunları erken yakalamak için.

## 12. Güncelleme Yayınlama

```bash
# bpmobile/app.json -> "version": "1.0.0" -> "1.1.0"
# versionCode otomatik artar
eas build --platform android --profile production --auto-submit
```

Play Console'da **Sürüm notları** kısmına "Bu güncellemede yenilikler"i yazın.

---

# Hızlı Mağaza Komutları

```bash
# === Tek seferde her iki platforma build + submit ===
cd bpmobile
eas build --platform all --profile production --auto-submit

# === Sadece iOS ===
eas build --platform ios --profile production
eas submit --platform ios --latest

# === Sadece Android ===
eas build --platform android --profile production
eas submit --platform android --latest

# === Build durumu / sertifika kontrolü ===
eas build:list --platform ios
eas build:list --platform android
eas credentials --platform ios
eas credentials --platform android
eas diagnostics
```

## Mağaza Gönderimi Kontrol Listesi (Özet)

### iOS
- [ ] Apple Developer aktif, App-Specific Password hazır
- [ ] `bpmobile/app.json` (`bundleIdentifier`, `version`, `icon`) doğru
- [ ] `assets/icon.png` 1024×1024, alfa kanalı yok
- [ ] EAS production build başarılı (`.ipa`)
- [ ] Sertifikalar yedeklendi
- [ ] App Store Connect'te uygulama oluşturuldu
- [ ] Açıklama, anahtar kelimeler, ikon, ekran görüntüleri (iPhone 6.9" + 5.5" + iPad)
- [ ] Gizlilik politikası URL aktif
- [ ] App Privacy etiketleri doldu
- [ ] Demo hesap girildi
- [ ] Yaş derecelendirmesi tamam
- [ ] Build seçildi → Review'a gönderildi

### Android
- [ ] Play Console hesabı aktif
- [ ] `bpmobile/app.json` (`package`, `versionCode`, `adaptiveIcon`) doğru
- [ ] EAS production build başarılı (`.aab`)
- [ ] Keystore yedeklendi
- [ ] Play Console'da uygulama oluşturuldu
- [ ] İkon 512×512, Feature Graphic 1024×500
- [ ] Min 2 telefon ekran görüntüsü
- [ ] Kısa + tam açıklama
- [ ] İçerik derecelendirmesi anketi
- [ ] Hedef kitle: 18+
- [ ] Veri güvenliği formu
- [ ] Gizlilik politikası URL
- [ ] (Yeni hesap) 20 kişi kapalı test gereksinimi
- [ ] İlk AAB yüklendi → Yayınlandı

---

## Önemli Dosyalar (Hızlı Referans)

| Dosya | Amaç |
|---|---|
| `server.js` | Custom Next.js + Socket.IO sunucusu |
| `src/middleware.ts` | Edge auth middleware |
| `src/lib/livekit.ts` | LiveKit token üretimi |
| `prisma/schema.prisma` | Tüm domain modeli |
| `docker-compose.livekit.yml` | Sunucuda **ayrı** çalışan LiveKit |
| `docker-compose-dev.yml` | Local dev yardımcı servisleri |
| `livekit.prod.yaml` | Üretim LiveKit konfigürasyonu |
| `bpmobile/App.tsx` | RN giriş noktası |
| `bpmobile/src/context/AuthContext.tsx` | Auth state + cookie köprüsü |
| `bpmobile/src/lib/frontend-auth.ts` | JWT, SecureStore/AsyncStorage |
| `bpmobile/src/screens/WebViewScreen.tsx` | WebView + injectedJavaScript köprüsü |
| `bpmobile/src/constants/urls.ts` | Web URL haritası + `mobile=true&app=1` |
| `bpmobile/app.json`, `bpmobile/eas.json` | Mağaza konfigürasyonu |
| `bpmobile/ios-store.md`, `bpmobile/android-store.md` | Detaylı mağaza kılavuzları |

Geliştirme kuralları için `.cursorrules`, mimari kararlar için `STRUCTURES.md`, refactor planları için `REFACTOR.md` / `REFACTORING.md`, yol haritası için `roadmap.md` ve `LIVE_STREAMS_ROADMAP.md` dosyalarına bakabilirsiniz.
