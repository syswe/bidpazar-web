# BidPazar API Client - Modular Architecture

Bu klasör BidPazar uygulamasının yeni modüler API istemci yapısını içerir. Eski monolitik `api.ts` dosyası domain/feature bazında ayrılmıştır.

## 📁 Dosya Yapısı

```
src/lib/api/
├── index.ts          # Ana export dosyası ve backward compatibility
├── types.ts          # Tüm TypeScript interface'leri
├── client.ts         # Temel fetcher ve HTTP client
├── categories.ts     # Kategori işlemleri
├── products.ts       # Ürün işlemleri ve file upload
├── users.ts          # Kullanıcı işlemleri, orders, won auctions
├── livestreams.ts    # Canlı yayın işlemleri
├── messages.ts       # Mesajlaşma ve konuşmalar
├── auctions.ts       # Ürün açık arttırmaları
├── notifications.ts  # Bildirimler
├── system.ts         # Health checks, diagnostics
└── README.md         # Bu dosya
```

## 🔄 Kullanım Şekilleri

### 1. Direct Import (Önerilen)
```typescript
import { getProducts, getCategories, createUser } from '@/lib/api';

const products = await getProducts();
const categories = await getCategories();
```

### 2. Namespaced API Client
```typescript
import { api } from '@/lib/api';

const products = await api.products.getProducts();
const categories = await api.categories.getCategories();
```

### 3. Module Import
```typescript
import { products, categories, users } from '@/lib/api';

const allProducts = await products.getProducts();
const allCategories = await categories.getCategories();
const allUsers = await users.getAllUsers();
```

## 📦 Modüller

### Categories (`categories.ts`)
- `getCategories()` - Tüm kategorileri getir
- `getCategoryById()` - ID ile kategori getir
- `createCategory()` - Yeni kategori oluştur
- `updateCategory()` - Kategori güncelle
- `deleteCategory()` - Kategori sil

### Products (`products.ts`)
- `getProducts()` - Tüm ürünleri getir
- `getProductById()` - ID ile ürün getir
- `getUserProducts()` - Kullanıcının ürünleri
- `createProduct()` - Yeni ürün oluştur
- `uploadProductImages()` - Ürün resmi yükle
- `uploadProductVideos()` - Ürün videosu yükle

### Users (`users.ts`)
- `getAllUsers()` - Tüm kullanıcılar (admin)
- `getUserById()` - ID ile kullanıcı getir
- `getUserWonAuctions()` - Kullanıcının kazandığı açık arttırmalar
- `getUserOrders()` - Kullanıcının siparişleri
- `findUserByUsername()` - Username ile kullanıcı ara

### LiveStreams (`livestreams.ts`)
- `getLiveStreams()` - Canlı yayınları getir
- `createLiveStream()` - Yeni canlı yayın oluştur
- `startLiveStream()` - Canlı yayın başlat
- `addListingToLiveStream()` - Yayına ürün ekle
- `addBidToListing()` - Teklif ver

### Messages (`messages.ts`)
- `getUserConversations()` - Kullanıcının konuşmaları
- `getOrCreateConversation()` - Konuşma getir/oluştur
- `sendMessage()` - Mesaj gönder
- `getConversationMessages()` - Konuşma mesajları

### Auctions (`auctions.ts`)
- `getProductAuctions()` - Ürün açık arttırmaları
- `createProductAuction()` - Yeni açık arttırma oluştur
- `addBidToProductAuction()` - Açık arttırmaya teklif ver
- `getProductAuctionByProductId()` - Ürün ID ile açık arttırma bul

### Notifications (`notifications.ts`)
- `getUserNotifications()` - Kullanıcı bildirimleri
- `markNotificationsAsRead()` - Bildirimleri okundu işaretle

### System (`system.ts`)
- `healthCheck()` - Sistem durumu kontrolü
- `diagnosticsHealth()` - Detaylı sistem bilgisi
- `testBandwidth()` - Bant genişliği testi
- `requestVerificationCode()` - Doğrulama kodu iste

## 🔧 Core Client (`client.ts`)

Tüm HTTP istekleri için temel client:

- `fetcher<T>()` - Generic fetch wrapper
- `fetcherAuth()` - Authenticated wrapper
- `handleApiError()` - Error handling
- `apiBaseUrl` - Base API URL

## 📝 Types (`types.ts`)

Tüm TypeScript type'ları ve interface'leri:

- `Product`, `Category`, `User`
- `LiveStream`, `AuctionListing`, `Bid`
- `Message`, `Conversation`, `Notification`
- `WonAuction`, `Order`

## 🔄 Migration Guide

### Eski Kullanım
```typescript
import { getProducts, getCategories } from '@/lib/api';
```

### Yeni Kullanım (Değişiklik Yok)
```typescript
import { getProducts, getCategories } from '@/lib/api';
```

**Backward compatibility korunmuştur!** Mevcut kod değiştirilmeden çalışacaktır.

## ✅ Avantajlar

1. **Modülerlik**: Her domain ayrı dosyada
2. **Okunabilirlik**: Kod daha organize ve anlaşılır
3. **Maintenance**: Bakım ve geliştirme daha kolay
4. **Tree Shaking**: Kullanılmayan modüller bundle'a dahil edilmez
5. **Type Safety**: Daha iyi TypeScript desteği
6. **Testing**: Modüller bağımsız test edilebilir

## 🔧 Geliştirme Notları

- Tüm API istekleri relative path kullanır (`/api/...`)
- Authentication otomatik eklenir (`requireAuth: true`)
- Error handling ve retry logic korunmuştur
- Socket.IO entegrasyonu devam eder
- Debug logging development'ta aktif

## 📈 Gelecek Geliştirmeler

- GraphQL desteği eklenebilir
- Caching layer (React Query/SWR) entegrasyonu
- Request/Response interceptors
- Real-time subscriptions
- Offline support