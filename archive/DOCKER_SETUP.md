# Docker Setup Guide - BidPazar

## 🚀 Local Development Setup (Recommended)

Bu kurulum local development için optimize edilmiştir. Sadece destekleyici servisleri (Redis, Coturn, LiveKit) Docker ile çalıştırır, Next.js uygulamasını local'de `npm run dev` ile çalıştırırsınız.

### Gereksinimler
- Docker ve Docker Compose
- Node.js 18+
- PostgreSQL (ayrı çalışıyor)

### 1. Destekleyici Servisleri Başlatın

```bash
# Destekleyici servisleri başlat (Redis, Coturn, LiveKit)
docker-compose -f docker-compose-dev.yml up -d

# Servis durumunu kontrol et
docker-compose -f docker-compose-dev.yml ps

# Logları takip et
docker-compose -f docker-compose-dev.yml logs -f
```

### 2. Next.js Uygulamasını Başlatın

```bash
# Dependencies yükle
npm install

# Development modunda çalıştır
npm run dev

# Veya custom server ile
node server.js
```

### 3. Erişim Adresleri

| Servis | URL | Açıklama |
|--------|-----|----------|
| **Next.js App** | http://localhost:3000 | Ana uygulama (npm run dev) |
| **LiveKit** | http://localhost:7880 | LiveKit HTTP API |
| **Redis** | localhost:6379 | Redis cache (password: redis_dev_password) |
| **TURN Server** | localhost:3478 | Coturn TURN/STUN server |

### 4. Environment Variables

`.env` dosyası local development için ayarlandı:

```env
# LiveKit
LIVEKIT_URL=http://localhost:7880
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880

# Redis
REDIS_URL=redis://:redis_dev_password@localhost:6379

# TURN Server
NEXT_PUBLIC_TURN_SERVER_URL=turn:localhost:3478
NEXT_PUBLIC_TURN_USERNAME=bidpazar_dev
NEXT_PUBLIC_TURN_PASSWORD=coturn_dev_secret
```

### 5. Development Workflow

```bash
# 1. Servisleri başlat
docker-compose -f docker-compose-dev.yml up -d

# 2. Uygulamayı çalıştır
npm run dev

# 3. Geliştirme yap...

# 4. Servisleri durdur
docker-compose -f docker-compose-dev.yml down
```

### 6. Troubleshooting

**LiveKit bağlantı sorunu:**
```bash
# LiveKit health check
curl http://localhost:7880/

# LiveKit logları
docker logs bidpazar-livekit-dev
```

**Redis bağlantı sorunu:**
```bash
# Redis bağlantı testi
redis-cli -h localhost -p 6379 -a redis_dev_password ping

# Redis logları
docker logs bidpazar-redis-dev
```

**TURN server testi:**
```bash
# TURN server testi (requires coturn utils)
turnutils_uclient -v -t -T -u bidpazar_dev -w coturn_dev_secret localhost
```

### 7. Service Management

```bash
# Sadece belirli servisi yeniden başlat
docker-compose -f docker-compose-dev.yml restart livekit

# Tek servis log takibi
docker-compose -f docker-compose-dev.yml logs -f redis

# Servisleri temizle
docker-compose -f docker-compose-dev.yml down -v
```

---

## 🐳 Full Docker Setup (Production-like)

Full production benzeri kurulum için orijinal `docker-compose.yml` kullanın.

### Production Setup

```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Development with all services in Docker
docker-compose up -d
```

### Environment Files

- `.env` - Local development variables
- `.env.local` - Local overrides
- `.env.prod` - Production variables

### LiveKit Configuration Files

- `livekit.local.yaml` - Development configuration
- `livekit.prod.yaml` - Production configuration (IP: 207.180.247.20)

### Production Deployment

```bash
# Production environment
export NODE_ENV=production

# Production deployment with external IP
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Health check
curl https://your-domain.com/api/health
```

### Security Notes

1. **Development**:
   - Debug logs enabled
   - Weak passwords (OK for local)
   - HTTP connections

2. **Production**:
   - Strong passwords required
   - HTTPS/WSS connections
   - Security headers
   - Firewall configuration

### Database Setup

PostgreSQL ayrı yönetiliyor. Connection string:
```
DATABASE_URL="postgresql://user:password@localhost:5432/bidpazar?schema=public"
```

### Support

Docker kurulum sorunları için:
1. `docker-compose logs` kontrol edin
2. Port çakışmalarını kontrol edin (`netstat -tulpn`)
3. Firewall ayarlarını kontrol edin
4. Environment variables doğruluğunu kontrol edin 