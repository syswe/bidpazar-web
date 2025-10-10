# BidPazar Livestream Mimarisi

## Genel Bakış
BidPazar’ın canlı açık artırmaları, LiveKit tabanlı WebRTC altyapısı ve Next.js kontrollü servis katmanının birleşimiyle çalışır. Yayıncı, moderatör ve izleyiciler için erişim jetonları Node.js tarafında üretilir; medya trafiği LiveKit üzerinden akar; eş zamanlı sohbet, teklif ve bildirim akışları ise Socket.IO destekli ayrı kanallar üzerinden dağıtılır. Bu doküman, yayın bileşenlerinin nasıl konumlandığını, hangi konfigürasyonların kullanıldığını ve üretim ortamına geçişte dikkat edilmesi gerekenleri özetler.

## Altyapı Bileşenleri

### LiveKit Sunucusu
- Konfigürasyon dosyaları: `livekit.yaml`, `livekit.local.yaml` ve `livekit.prod.yaml`.
- Varsayılan sinyal portu `7880`, TCP fallback `7881`, UDP medya aralığı ortamına göre 50000-60000 veya 60500-60599.
- `keys` alanında (ör. `devkey`) hem kontrol ucu (`livekit-server-sdk`) hem de istemci jetonu üretiminde kullanılan anahtar/secret çifti saklanır.
- Redis entegrasyonu (`redis.address`, `redis.password`) yayın ölçeklemesi ve node senkronizasyonu için zorunludur.
- `turn_servers` bloğu üretimde kamuya açık IP (`node_ip`) ve Coturn kimlik bilgileriyle doldurulur; `use_external_ip: true` ayarı NAT arkası konuşabilmek için önemlidir.
- Oda varsayılanları: H.264/Vp8/Vp9 ve Opus desteği, `auto_create: true`, 10 dakikalık boş oda zaman aşımı.
- `log_level` geliştirici ortamında `debug`, üretimde `info` olarak ayarlanır; detaylı loglar `livekit.logs` dosyasında saklanabilir.

### Coturn (TURN/STUN)
- `docker-compose.yml` ve `docker-compose-dev.yml` dosyalarındaki `coturn` servisi NAT arkasındaki istemcilere UDP/TCP üzerinden medya iletimi sağlar.
- Portlar: `3478` (UDP/TCP), `5349` (TLS için hazır), ayrıca geniş UDP aralıkları (`49152-65535` veya geliştirmede `60000-60099`).
- Kimlik bilgileri (`TURN_USERNAME`, `TURN_PASSWORD`) LiveKit istemci ayarlarıyla eşleşmek zorundadır.
- `--allowed-peer-ip` parametreleri yalnızca güvenilir ağ aralıklarını kabule zorlar; üretimde `--external-ip` kamu IP’siyle setlenmelidir.

### Redis
- `docker-compose.yml` içerisindeki `redis` servisi, hem LiveKit hem de Next.js uygulaması tarafından oturum, rate-limit ve yayın metrikleri için kullanılır.
- Persistans `appendonly yes` ile açılır; parola (`redis_password`) LiveKit yapılandırmasıyla aynı olmalıdır.

### Kontrol Ucu (Next.js / Node.js)
- `src/lib/livekit.ts` dosyası, `livekit-server-sdk` kullanarak `RoomServiceClient` ve `AccessToken` üretimini kapsüller.
- `src/app/api/live-streams/[id]/token/route.ts` uç noktası, yayın odasına katılım için jeton üretir. Kullanıcı doğrulaması JWT üzerinden (`getUserFromTokenInNode`) yapılır ve yayın sahibine `canPublish` ayrıcalığı tanınır.
- `server.js` içindeki Socket.IO katmanı, yayın odasındaki izleyicileri takip eder, teklif/sayım olaylarını senkronize eder ve LiveKit dışı gerçek zamanlı mesajlaşmayı yürütür.

## Jeton ve Oda Yaşam Döngüsü
1. İstemci (web veya mobil) `GET /api/live-streams/{id}/token` çağrısı yapar.
2. API, Prisma ile `prisma.liveStream` üzerinden yayını doğrular, kullanıcının yayıncı olup olmadığını belirler.
3. `createLiveKitToken` ( `src/lib/livekit.ts` ) oda kimliği, katılımcı adı ve yetkilerle JWT üretir.
4. İstemci tarafında `LiveKitRoom` bileşeni bu jetonla `NEXT_PUBLIC_LIVEKIT_URL` üzerinden bağlanır.
5. Yayıncı odadan ayrıldığında, Socket.IO katmanı (`server.js`) aktif izleyici listesini günceller ve LiveKit tarafındaki odanın boşaldığı durumlar için `empty_timeout` tetiklenir.

## WebRTC İstemci Konfigürasyonu
- Web istemcisi ayarları `src/lib/webrtc-config.ts` dosyasında merkezi olarak yönetilir.
- Dinamik TURN sunucuları `NEXT_PUBLIC_TURN_SERVER_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_PASSWORD` değişkenlerinden okunur; Google ve Cloudflare STUN adresleri ön tanımlıdır.
- `livekitRoomOptions` adaptif yayın (`adaptiveStream`), `dynacast` ve 720p hedef çözünürlüğü aktifleştirir.
- `livekitConnectOptions` agresif yeniden deneme ve yedek kodek (`vp8` + `h264`) tanımlar.
- Yardımcı fonksiyonlar (`checkWebRTCSupport`, `testICEGathering`, `initializeAudioContext`) kullanıcı tarayıcısı için bağlantı teşhisleri sunar.

## Dağıtım Senaryoları

### Geliştirme
- `docker-compose-dev.yml` LiveKit, Coturn ve Redis’i tek ağda ( `bidpazar-dev-network` ) ayağa kaldırır.
- `livekit.local.yaml` dosyası localhost domain’ine sabitlenmiştir; UDP aralığı çakışmayı engellemek için 60500-60599’a daraltılmıştır.
- Socket.IO geliştirme logları `DEBUG_CHAT=true` ile açılabilir; LiveKit log seviyesi `debug`’dır.

### Üretim
- `docker-compose.prod.yml` dış IP (`207.180.247.20`) ve ayrı kimlik bilgileri (`prodkey`) ile LiveKit’i çalıştırır.
- `livekit.prod.yaml` dış IP’yi (`node_ip`) zorunlu kılar ve aynı Coturn bilgilerini tekrarlar; `log_level: info`.
- Uygulama konteyneri (`app`) LiveKit’e `http://livekit:7880` üzerinden erişir; istemci tarafı `NEXT_PUBLIC_LIVEKIT_URL=ws://207.180.247.20:7880` ile bağlanır.
- Sağlık kontrolleri: LiveKit için `wget --spider http://localhost:7880/`, uygulama için `/api/health`.

### İzole LiveKit Kurulumu
- `docker-compose.livekit.yml` yalnızca LiveKit’i bağımsız çalışma senaryoları için sağlar; konfigürasyon dosyası olarak `./livekit.yaml` mount edilir.

## Ağ ve Güvenlik Notları
- API anahtarı/secret değerleri en az 32 karakter olmalıdır; dokümandaki örnekler yalnızca geliştime içindir.
- Coturn parolaları üretimde rastgele ve uzun tutulmalı; TLS (`5349`) etkinleştirilerek şifreli TURN sağlanmalıdır.
- LiveKit `development: true` bayrağı üretimde kapatılmalıdır.
- Reverse proxy (Nginx vb.) üzerinden 7880 HTTP/WebSocket trafiği TLS ile terminate edilmelidir.

## Operasyon ve İzleme
- LiveKit konteyneri `restart: unless-stopped` ile ayarlanmıştır; loglar Docker üzerinden takip edilir. Geliştiriciler `livekit.logs` dosyasıyla anlık telemetri tutabilir.
- Redis ve LiveKit sağlık kontrolleri compose dosyalarında tanımlıdır; `docker compose ps` ile durum izlenebilir.
- Oda, izleyici ve teklif olayları Socket.IO tarafında `activeStreams`, `activeUsers` haritalarında tutulur; gerektiğinde metrikler dış sistemlere aktarılabilir.

## Genişletme Önerileri
- `RoomServiceClient` ile ( `src/lib/livekit.ts` ) otomatik oda temizliği, katılımcı sayacı ve kayıt gibi ileri senaryolar hayata geçirilebilir.
- LiveKit webhooks (henüz aktive edilmemiş) kullanılarak yayının başladığı/bittiği olayları veri tabanına işlemek mümkündür.
- Coturn ve LiveKit için ayrı monitörleme panelleri (Prometheus, Grafana) eklenmesi operasyonda görünürlük kazandıracaktır.
