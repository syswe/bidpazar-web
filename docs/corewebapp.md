# BidPazar Web Uygulaması Mimarisi

## Teknoloji Yığını
- **Çatı:** Next.js 15 (App Router) + React 19 + TypeScript 5 (`package.json`).
- **Sunucu ortamı:** Node.js 22 üzerinde çalışan `server.js` tabanlı özel HTTP + Socket.IO sunucusu.
- **Veri katmanı:** Prisma ORM (`prisma/schema.prisma`) ile PostgreSQL 17 (`docker-compose-pgsql.yaml`).
- **Gerçek zamanlılık:** Socket.IO (`server.js`) ve LiveKit WebRTC entegrasyonu (`src/lib/livekit.ts`).
- **Ön yüz:** Tailwind CSS (`tailwind.config.js`), `Inter` fontu, tema sağlayıcısı (`src/components/ThemeProvider`).
- **Doğrulama:** `jose` tabanlı JWT doğrulaması (`src/lib/auth.ts`), istemci tarafı `frontend-auth` yardımcıları.
- **Araçlar:** Jest, Testing Library, Playwright, ESLint 9, esbuild (logger bundle).

## Katmanlı Yapı ve Dizinler
- `src/app`: App Router sayfaları ve API rotaları. Öne çıkan modüller:
  - `live-streams`: LiveKit istemcisi, sohbet, ürün sunumu.
  - `dashboard`, `products`, `auth`, `api/*` altındaki REST uç noktaları.
- `src/components`: Ortak UI parçaları (`Sidebar`, `MobileLayout`, `AuthProvider`, `MobileSidebar`, vb.).
- `src/lib`: Çekirdek servis katmanı
  - `auth.ts`, `frontend-auth.ts`: JWT üretimi/doğrulaması, tarayıcı depolaması.
  - `livekit.ts`: LiveKit token üretimi ve `RoomServiceClient`.
  - `webrtc-config.ts`: ICE sunucuları, bağlantı seçenekleri ve teşhis yardımcıları.
  - `api/*`: İstemci tarafı fetch katmanı ve domain spesifik API çağrıları.
  - `logger.ts`: Yapılandırılabilir log sağlayıcısı.
- `prisma`: Şema, migrasyonlar ve seed scriptleri.
- `server.js`: Next.js uygulamasını özel HTTP sunucusu olarak başlatır ve Socket.IO olay haritasını barındırır.
- `docs`: Süreç, altyapı ve özelliklere dair ek referanslar (bu dokümanlar dahil).

## Sunucu Katmanı ve Socket.IO
- HTTP sunucusu `app.prepare()` sonrası `createServer` ile oluşturulur; tüm Next.js istekleri `handle()` üzerinden geçer.
- Socket.IO aynı portu kullanır (`/socket.io` path). CORS izinleri geliştirme ve üretim URL’lerine göre dinamik.
- `activeStreams`, `activeUsers`, `activeConversations` haritaları yayın katılımcılarını ve sohbet oturumlarını yönetir.
- Yayın olayları: `join-stream`, `leave-stream`, `new-bid`, `start-countdown`, `stream-state-changed` vb. ( `server.js` ).
- Socket instance `global.socketIO` olarak setlenir; API rotaları ihtiyaç halinde yayın/sohbet tetikleyebilir.

## API ve İş Mantığı
- App Router API rotaları `src/app/api/**/*` altında. Örnekler:
  - `live-streams/[id]/token`: LiveKit erişim jetonu üretimi.
  - `messages/conversations/...`: Mesajlaşma servisi, Prisma ile akış.
  - `health`: Docker health check uç noktası.
- `src/lib/api/client.ts` fetcher, JWT’yi header’a ekler ve hata yönetimi sunar.
- `src/lib/server/*`: Sunucu tarafı yardımcılar (örn. `conversationMessaging`, `productAuctionUtils`).

## Veri Modeli
- `prisma/schema.prisma` ana tablolar:
  - `User`, `Story`, `Category`, `Product`, `ProductMedia`.
  - `LiveStream`, `AuctionListing`, `Bid`, `StreamAnalytics`, `StreamModeration`, `StreamReward`.
  - Mesajlaşma (`Conversation`, `Message`), bildirim (`Notification`) ve izleme metrikleri (`StreamViewTime`, `StreamShare`).
- PostgreSQL bağlantısı `DATABASE_URL` ortam değişkeniyle sağlanır; generator `linux-musl` dahil farklı binariler üretir.
- Prisma client `src/lib/prisma.ts` ile tekil instance olarak paylaşılır.

## Kimlik Doğrulama ve Yetkilendirme
- `src/lib/auth.ts`:
  - NextAuth Credentials Provider ile temel giriş formu desteği.
  - `verifyToken` fonksiyonu `jose` kütüphanesiyle JWT doğrular, `APP_VERSION` karşılaştırması yapar.
  - Cookie ve Authorization header analizi için `getTokenFromRequest`.
- İstemci tarafı `src/components/AuthProvider.tsx` ve `src/lib/frontend-auth.ts`:
  - LocalStorage tabanlı token saklama, /api/auth/validate üzerinden yeniden doğrulama.
  - Çıkış (`logout`) süreci hem depolama temizler hem de backend’i çağırır.
- Mobil ile aynı token formatını kullanabilmek için `APP_VERSION` eşleşmesi önemlidir.

## Ön Yüz ve Tema Katmanı
- `src/app/layout.tsx`:
  - Tema, auth provider ve Google Tag Manager entegre edilir.
  - `Sidebar` + `MobileLayout` hibrit düzen; mobil cihazlar için alt navigasyon/Drawer bileşenleri.
- Tailwind CSS `var(--primary)` tabanlı tema renkleriyle çalışır; CSS değişkenleri `globals.css` içinde yönetilir.
- UI kitaplıkları: Radix UI (Progress, Tabs), Lucide ikonları, `sonner` toast bildirimleri.

## Canlı Yayın Arayüzü
- `src/app/live-streams/[id]/page.tsx`:
  - `LiveKitRoom`, `VideoConference`, `ParticipantTile` bileşenleri ile toplantı arayüzü.
  - `StreamChat`, `StreamHeader`, `ProductSection` gibi modüler bileşenler.
  - Socket.IO istemcisi (`socket.io-client`) ile chat, teklif ve sayaç olayları.
  - Tarayıcı uyumluluğu için `checkWebRTCSupport`, `initializeAudioContext` çağrıları.
- Token alımı için `useEffect` ile API çağrısı yapılır; anonim katılımcılar için rastgele kimlik oluşturulur.

## Yapılandırma ve Ortam Değişkenleri
- `next.config.js`:
  - `output: "standalone"`; Docker image’ında yalnızca gerekli dosyalar.
  - WebSocket erişimleri için global CORS header’ları.
  - `serverExternalPackages` boş, ancak webpack fallback’leri `fs`, `net`, `tls` için false.
  - `optimizePackageImports` ve `experimental.serverActions` yapılandırması.
- `tsconfig.json`: `moduleResolution: "bundler"`, `paths` `@/*` alias’ı, `typeRoots` içinde `src/types`.
- `.env` örüntüsü `docker-compose.yml` içinde gösterildiği gibi LiveKit, Redis, JWT, SMS servislerini içerir.

## Derleme ve Dağıtım
- NPM scriptleri: `npm run dev`, `build`, `start`, `prisma:*`, `test` (`package.json`).
- Docker çok aşamalı build (`Dockerfile`):
  - `builder` aşaması Next.js derler, Prisma client üretir.
  - `runner` aşaması sadeleştirilmiş node_modules ile `server.js` çalıştırır.
  - Ek olarak esbuild ile `dist/logger.js` bundle’ı üretilir.
- Compose senaryoları:
  - `docker-compose.yml`: App + Redis + LiveKit + Coturn tek ağda.
  - `docker-compose.prod.yml`: Prod ortamında çevresel değişkenler ve dış IP tanımları.
- Health check: `curl http://localhost:3000/api/health`.

## Test, Kalite ve Geliştirme Deneyimi
- Test: Jest + Testing Library (React & DOM), Supertest ile API testleri, Playwright E2E.
- Lint: ESLint 9 + `eslint-config-next`; lint hataları build’i durdurmamak için `ignoreDuringBuilds: true`.
- `DEBUG_*` flag’leri (`DEBUG_AUTH`, `DEBUG_CHAT`, `DEBUG_MESSAGES`) hem sunucu hem istemci tarafında detaylı log çıkışı sağlar.
- `logger.configure` ile sunucuya log gönderimi açılabilir (`BACKEND_API_URL` üzerinden).

## İzleme ve Operasyon
- Socket.IO olay akışı `server.js` içinde kapsamlı loglamayla desteklenir; hata durumlarında kullanıcıya toast bildirimleri gösterilir.
- LiveKit ile eşgüdüm için `RoomServiceClient` ileride oda yönetimi (kick, mute, kayıt) için kullanılabilir.
- Redis sağlık kontrolleri (`redis-cli incr ping`) compose dosyasında tanımlı; servis bağımlılıkları `depends_on` bloklarıyla güvence altına alınır.

## Gelecek Genişletme Alanları
- Next.js Server Actions ile bazı API rotaları basitleştirilebilir.
- Socket.IO payload’ları kalıcı hale getirmek için Redis/Prisma tabanlı kuyruklar eklenebilir.
- Observability için OpenTelemetry veya Logflare entegrasyonu yapılabilir.
