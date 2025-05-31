# BidPazar Ana Sayfa Geliştirme Süreci

## 📋 Proje Genel Durumu
Bu doküman BidPazar ana sayfasındaki tüm fonksiyonların işlevsel hale getirilmesi için gerekli adımları detaylandırır.

### 🎯 Ana Hedefler
1. **Hoşgeldiniz banner** - Sadece giriş yapmamış kullanıcılara gösterilecek
2. **Hikayeler sistemi** - Giriş yapmış kullanıcılar hikaye ekleyebilir, diğerleri görüntüleyebilir
3. **Trend kategoriler** - DB'den emoji ile birlikte okunacak
4. **Canlı müzayedeler** - Live-streams gibi listeleme, aktif yayın yoksa bilgilendirme
5. **Ürün filtreleme** - Canlı yayın ürünlerini normal listelerden gizleme
6. **Kullanıcı tipleri** - Normal üye/satıcı ayrımı
7. **Satıcı limitleri** - Belirli adedin üzerinde paralı sistem

---

## 📊 Mevcut Durum Analizi

### ✅ HAZIR OLAN BÖLÜMLER

#### Database & Schema
- **✅ Prisma Schema**: Temel yapı mevcut (`prisma/schema.prisma`)
- **✅ User, Product, Category modelleri**: Çalışıyor
- **✅ LiveStream, AuctionListing modelleri**: Mevcut
- **✅ Migration system**: Aktif

#### Admin Panel
- **✅ AdminLayout**: Tam çalışıyor (`src/components/AdminLayout.tsx`)
- **✅ Admin Dashboard**: Mevcut (`src/app/(admin)/admin/page.tsx`)
- **✅ Admin Users**: Mevcut (`src/app/(admin)/admin/users/page.tsx`)
- **✅ Admin Categories**: Mevcut (`src/app/(admin)/admin/categories/page.tsx`)
- **✅ Admin Auth & Middleware**: Çalışıyor

#### API Endpoints
- **✅ Auth API**: Tam çalışıyor (`src/app/api/auth/*`)
- **✅ Categories API**: Mevcut (`src/app/api/categories/route.ts`)
- **✅ Live Streams API**: Mevcut (`src/app/api/live-streams/route.ts`)
- **✅ Products API**: Mevcut (`src/app/api/products/*`)
- **✅ Users API**: Mevcut (`src/app/api/users/*`)

#### Frontend Components
- **✅ Ana sayfa layout**: Mevcut (`src/app/page.tsx`)
- **✅ Auth Provider**: Çalışıyor (`src/components/AuthProvider.tsx`)
- **✅ Frontend auth utils**: Mevcut (`src/lib/frontend-auth.ts`)

### ❌ GELİŞTİRİLECEK BÖLÜMLER

#### Database Schema Eksikleri
- **❌ Story tablosu**: Hiç yok
- **❌ Category.emoji field**: Eksik
- **❌ User.userType field**: Eksik (MEMBER/SELLER)
- **❌ SellerSettings tablosu**: Limit kontrolü için eksik

#### API Eksikleri
- **❌ Stories API**: Hiç yok (`/api/stories`)
- **❌ Category emoji support**: API'de yok
- **❌ User type management**: Admin API'de eksik
- **❌ Live streams filtering**: Aktif yayın filtresi eksik
- **❌ Product filtering**: Live auction ürün filtresi eksik

#### Frontend Eksikleri
- **❌ Stories real data**: Şuan mock data
- **❌ Auth-based banner**: Conditional gösterim eksik
- **❌ Category emoji display**: Sadece hardcoded emoji
- **❌ Live streams real data**: Mock data kullanıyor
- **❌ Product live filtering**: Filtreleme logic eksik

---

## 🚀 GELİŞTİRME ADIMLARI

### **FAZE 1: Database Schema Güncellemeleri (2 Gün)**

#### 📅 Gün 1: Schema Güncellemeleri

**1.1. Story Tablosu Ekleme**
```sql
-- prisma/schema.prisma'ya eklenecek
model Story {
  id          String   @id @default(cuid())
  content     String   // Metin içerik veya medya URL
  type        String   // "text" | "image" | "video"
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  views       Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  expiresAt   DateTime // 24 saat sonra otomatik silinir
  
  @@index([userId])
  @@index([isActive, expiresAt])
}
```

**1.2. User Tablosu Güncelleme**
```sql
enum UserType {
  MEMBER
  SELLER
}

model User {
  // Mevcut fieldlar...
  userType    UserType @default(MEMBER)
  stories     Story[]
  sellerSettings SellerSettings?
}
```

**1.3. Category Tablosu Güncelleme**
```sql
model Category {
  // Mevcut fieldlar...
  emoji       String?  // 🏺, 🎨, 💎 vb.
}
```

**1.4. SellerSettings Tablosu**
```sql
model SellerSettings {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  monthlyStreamLimit   Int      @default(5)    // Aylık ücretsiz yayın sayısı
  monthlyProductLimit  Int      @default(10)   // Aylık ücretsiz ürün sayısı
  currentMonthStreams  Int      @default(0)    // Bu ay yapılan yayın sayısı
  currentMonthProducts Int      @default(0)    // Bu ay eklenen ürün sayısı
  lastResetDate       DateTime @default(now()) // Son sıfırlama tarihi
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

**Çalıştırılacak Komutlar:**
```bash
# Migration oluştur
npx prisma migrate dev --name add_stories_and_seller_features

# Prisma client güncelle
npx prisma generate
```

#### 📅 Gün 2: Seed Data ve Test

**2.1. Seed Script Güncelleme**
- Kategorilere emoji ekleme
- Test kullanıcılarına userType atama
- Örnek story verileri ekleme

**2.2. Database Test**
- Yeni tabloların çalışmasını test
- İlişkilerin doğru kurulmasını kontrol

---

### **FAZE 2: Backend API Geliştirmeleri (3 Gün)**

#### 📅 Gün 3: Stories API Geliştirme

**3.1. Stories API Endpoints**
Dosya: `src/app/api/stories/route.ts`
```typescript
// GET /api/stories - Tüm aktif hikayeleri getir
// POST /api/stories - Yeni hikaye ekle (auth required)
```

Dosya: `src/app/api/stories/[id]/route.ts`
```typescript
// GET /api/stories/[id] - Hikaye detayı
// DELETE /api/stories/[id] - Hikaye sil (sadece sahibi)
// PATCH /api/stories/[id]/view - Görüntülenme sayısını artır
```

**3.2. Stories Utils**
Dosya: `src/lib/stories.ts`
```typescript
// Hikaye süresi kontrol fonksiyonları
// Otomatik silme job'ları
// Story validation utils
```

#### 📅 Gün 4: Auth ve User Management API

**4.1. User Type Management**
Dosya: `src/app/api/admin/users/[id]/type/route.ts`
```typescript
// PATCH /api/admin/users/[id]/type
// Admin kullanıcı tipini değiştirebilir
```

**4.2. Auth Middleware Güncelleme**
Dosya: `src/lib/auth-utils.ts`
```typescript
// Auth durumu kontrol fonksiyonları
// Seller limit kontrol fonksiyonları
```

**4.3. Seller Settings API**
Dosya: `src/app/api/seller/settings/route.ts`
```typescript
// GET/PATCH seller limit ayarları
```

#### 📅 Gün 5: Mevcut API'lerin Güncellenmesi

**5.1. Categories API Güncelleme**
Dosya: `src/app/api/categories/route.ts` (MEVCUT)
- Emoji field desteği ekleme
- Admin emoji güncelleme endpoint'i

**5.2. Live Streams API Güncelleme**
Dosya: `src/app/api/live-streams/route.ts` (MEVCUT)
- Aktif yayın filtresi ekleme
- Status-based queries

**5.3. Products API Güncelleme**
Dosya: `src/app/api/products/route.ts` (MEVCUT)
- Live auction ürünlerini filtreleme
- Query parameter desteği

---

### **FAZE 3: Frontend Component Geliştirmeleri (4 Gün)**

#### 📅 Gün 6: Ana Sayfa Auth Integration

**6.1. Auth-based Banner Component**
Dosya: `src/app/page.tsx` (MEVCUT - GÜNCELLENECEK)
```typescript
// useAuth hook ile giriş durumu kontrolü
// Banner conditional rendering
```

**6.2. Auth Hook Optimizasyonu**
Dosya: `src/hooks/useAuth.ts`
```typescript
// Giriş durumu helper fonksiyonları
```

#### 📅 Gün 7: Stories Component Geliştirme

**7.1. Stories Container Component**
Dosya: `src/components/Stories/StoriesContainer.tsx`
```typescript
// Real API entegrasyonu
// Loading states
// Error handling
```

**7.2. Story Modal Components**
Dosya: `src/components/Stories/StoryModal.tsx`
```typescript
// Story görüntüleme modal'ı
// Story ekleme modal'ı
// Media upload support
```

**7.3. Ana Sayfa Stories Integration**
Dosya: `src/app/page.tsx` (MEVCUT - GÜNCELLENECEK)
```typescript
// Mock data yerine real API kullanımı
// Auth kontrolü ile story ekleme butonu
```

#### 📅 Gün 8: Kategoriler Real Data Integration

**8.1. Categories Component Güncelleme**
Dosya: `src/app/page.tsx` (MEVCUT - GÜNCELLENECEK)
```typescript
// Trend kategoriler DB'den çekme
// Emoji display
```

**8.2. Category API Integration**
```typescript
// getCategories API güncellemesi
// Emoji field desteği
```

#### 📅 Gün 9: Live Streams ve Products Filtreleme

**9.1. Live Streams Real Data**
Dosya: `src/app/page.tsx` (MEVCUT - GÜNCELLENECEK)
```typescript
// Mock data yerine real API
// Aktif yayın filtresi
// "Henüz aktif yayın yok" durumu
```

**9.2. Products Filtreleme Logic**
Dosya: `src/lib/api.ts` (MEVCUT - GÜNCELLENECEK)
```typescript
// getProducts filtreleme
// Live auction ürünlerini gizleme
```

---

### **FAZE 4: Admin Panel Güncellemeleri (3 Gün)**

#### 📅 Gün 10: Admin User Management

**10.1. User Type Management**
Dosya: `src/app/(admin)/admin/users/page.tsx` (MEVCUT - GÜNCELLENECEK)
```typescript
// User type gösterimi
// Tip değiştirme functionality
// Bulk operations
```

**10.2. User Type Change Modal**
Dosya: `src/components/Admin/UserTypeModal.tsx`
```typescript
// MEMBER/SELLER değişim modal'ı
// Onay mekanizması
```

#### 📅 Gün 11: Admin Category Management

**11.1. Category Emoji Picker**
Dosya: `src/app/(admin)/admin/categories/page.tsx` (MEVCUT - GÜNCELLENECEK)
```typescript
// Emoji seçici component
// Kategori ekleme/düzenleme
```

**11.2. Emoji Picker Component**
Dosya: `src/components/Admin/EmojiPicker.tsx`
```typescript
// Emoji seçim interface'i
// Popüler kategoriler emoji seti
```

#### 📅 Gün 12: Seller Limits Management

**12.1. Seller Settings Panel**
Dosya: `src/app/(admin)/admin/seller-settings/page.tsx`
```typescript
// Seller limit ayarlama interface'i
// Toplu limit güncelleme
```

**12.2. Seller Dashboard Integration**
Dosya: `src/app/(dashboard)/seller/page.tsx`
```typescript
// Limit gösterimi
// Kullanım durumu tracking
```

---

### **FAZE 5: UI/UX İyileştirmeleri ve Test (2 Gün)**

#### 📅 Gün 13: UI Polish ve Responsive Design

**13.1. Component Optimizasyonu**
- Loading state'ler iyileştirme
- Error handling standardizasyonu
- Responsive design kontrolleri

**13.2. Performance Optimizasyonu**
- API call optimizasyonu
- Lazy loading implementasyonu
- Caching stratejileri

#### 📅 Gün 14: Integration Testing ve Bug Fixes

**14.1. End-to-End Testing**
- Tüm flow'ların test edilmesi
- Cross-browser compatibility
- Mobile responsive test

**14.2. Final Bug Fixes**
- QA test sonuçlarına göre düzeltmeler
- Performance iyileştirmeleri

---

### **FAZE 6: Production Deployment (1 Gün)**

#### 📅 Gün 15: Deployment ve Go-Live

**15.1. Production Deployment**
```bash
# Database migration
npx prisma migrate deploy

# Build ve deploy
npm run build
```

**15.2. Post-Deploy Verification**
- Tüm fonksiyonların çalışmasını doğrulama
- Performance monitoring
- Error tracking

---

## ⚡ Öncelik Sırası

### 🔥 YÜKSEK ÖNCELİK (Hemen Başlanmalı)
1. **Database Schema Güncellemeleri** - Tüm diğer işler buna bağlı
2. **Stories API Development** - Ana sayfa core feature
3. **Auth-based Banner** - En basit ama etkili özellik

### 🔶 ORTA ÖNCELİK 
4. **Categories Emoji Integration** - Backend + Frontend
5. **Live Streams Filtering** - Var olan API'yi geliştirme
6. **User Type Management** - Admin feature

### 🔵 DÜŞÜK ÖNCELİK (Son Hafta)
7. **Seller Limits System** - Complex business logic
8. **UI/UX Polish** - Son rötuşlar
9. **Advanced Admin Features** - Nice to have

---

## 🎯 Başlangıç Önerisi

**1. FAZ 1'den başla:** Database schema güncellemeleri kritik
**2. Backend-First approach:** API'leri hazırla, sonra frontend'e entegre et
**3. Increment development:** Her özelliği tek tek tamamla ve test et

Hangi fazdan başlamak istiyorsun? 