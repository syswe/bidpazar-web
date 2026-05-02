# BidPazar Live Streams - Refactor ve İyileştirme Roadmap

## 📋 Proje Genel Bilgileri

**Teknoloji Stack:**
- Next.js 15.3.2 (App Router)
- TypeScript (Strict Mode)
- Socket.IO (Real-time)
- Jitsi Meet (WebRTC)
- TailwindCSS + CSS Variables
- Prisma ORM + PostgreSQL
- Custom Node.js Server

**Mevcut Durum:**
- ✅ Temel functionality çalışıyor
- 🔴 Performance sorunları var
- 🔴 Code maintainability düşük
- 🔴 Component'lar çok büyük
- 🔴 CSS organization kötü
- 🔴 Memory leaks riski

---

## 🎯 PHASE 1: ACİL REFACTOR (2-3 Hafta)

### **Priority: CRITICAL** 🚨

#### **1.1 StreamChat Component Refactoring**
**Mevcut Sorun:** 519 satır tek component, memory leaks, karmaşık state

```typescript
// Hedef yapı:
src/app/live-streams/[id]/components/StreamChat/
├── StreamChatContainer.tsx      // Ana container (100-150 satır)
├── ChatMessageList.tsx         // Mesaj listesi (80-100 satır)
├── ChatInput.tsx              // Input formu (60-80 satır)
├── MobileChatOverlay.tsx      // Mobile özel (100-120 satır)
├── hooks/
│   ├── useChatSocket.ts       // Socket management
│   ├── useChatMessages.ts     // Message state
│   └── useMobileChat.ts       // Mobile specific logic
└── types.ts                   // Chat type definitions
```

**Teknik Gereksinimler:**
- [ ] Socket connection'ı context'e taşı
- [ ] Mobile/desktop logic'i ayrı componentlere böl
- [ ] Memory leak'leri düzelt (timeout cleanup)
- [ ] Message state management optimize et
- [ ] React.memo() ve useMemo() ekle

#### **1.2 CSS Modülerleştirme**
**Süre:** 3-4 gün
**Mevcut Sorun:** 856 satır tek CSS dosyası

```css
/* Hedef yapı: */
src/app/live-streams/[id]/styles/
├── index.css                  // Re-export all styles
├── base.css                   // Layout ve container styles
├── chat.css                   // Chat specific styles
├── jitsi-overrides.css        // Jitsi customization
├── mobile.css                 // Mobile responsive
├── components/
│   ├── stream-header.css
│   ├── product-section.css
│   ├── bidding-interface.css
│   └── stream-actions.css
└── animations.css             // Keyframes ve transitions
```

**Teknik Gereksinimler:**
- [ ] CSS'i mantıklı parçalara böl
- [ ] Dead code'ları temizle
- [ ] CSS custom properties optimize et
- [ ] Mobile-first approach uygula
- [ ] PostCSS ile bundle optimization

#### **1.3 Socket Management Centralization**
**Mevcut Sorun:** Her component kendi socket yaratıyor

```typescript
// Hedef yapı:
src/app/live-streams/[id]/contexts/
├── SocketContext.tsx          // Global socket provider
└── StreamContext.tsx          // Stream specific state

src/app/live-streams/[id]/hooks/
├── useSocket.ts              // Socket connection hook
├── useSocketEvent.ts         // Event listener hook
└── useSocketEmit.ts          // Event emitter hook
```

**Teknik Gereksinimler:**
- [ ] Tek socket connection per stream
- [ ] Event listener cleanup optimization
- [ ] Reconnection logic iyileştirme
- [ ] Socket state management (connected/disconnected)
- [ ] Error handling ve retry mechanism

#### **1.4 Dead Code Temizliği**
**Süre:** 1-2 gün

**Silinecek Dosyalar:**
- [ ] `mediaStateManager.ts` - Kullanılmıyor
- [ ] `logging.d.ts` & `logging.ts` - Gereksiz abstraction
- [ ] CSS'deki unused Jitsi overrides
- [ ] `loopbackUtils.ts` - Over-engineered, basitleştir

---

## 🚀 PHASE 2: PERFORMANCE VE API OPTİMİZASYONU (2-3 Hafta)

### **Priority: HIGH** ⚡

#### **2.1 API Standardization**
**Süre:** 4-5 gün
**Mevcut Sorun:** Inconsistent API calls, fallback logic karmaşık

```typescript
// Hedef yapı:
src/lib/api/
├── apiClient.ts              // Centralized HTTP client
├── streams/
│   ├── index.ts             // Stream CRUD operations
│   ├── viewers.ts           // Viewer management
│   └── status.ts            // Stream status updates
├── chat/
│   ├── index.ts             // Chat API calls
│   └── messages.ts          // Message operations
├── bidding/
│   ├── index.ts             // Bidding operations
│   ├── products.ts          // Product management
│   └── auctions.ts          // Auction lifecycle
└── types.ts                 // Shared API types
```

**Teknik Gereksinimler:**
- [ ] Standardize API response format
- [ ] Error handling centralization
- [ ] Request/response interceptors
- [ ] Type-safe API calls
- [ ] Retry mechanism for failed requests

#### **2.2 Performance Optimization**
**Süre:** 5-6 gün

**Polling Issues Fix:**
```typescript
// Mevcut sorunlar:
❌ İzleyici sayısı: 10 saniyede bir HTTP poll
❌ Active bid: 5 saniyede bir HTTP poll
❌ Chat messages: sürekli re-render

// Çözümler:
✅ WebSocket events ile real-time updates
✅ React.memo() ve useMemo() optimizations
✅ Debounced updates
✅ Virtual scrolling for chat messages
```

**Teknik Gereksinimler:**
- [ ] WebSocket event'ler ile polling'i değiştir
- [ ] Component memoization
- [ ] Virtual scrolling implementation
- [ ] Image lazy loading
- [ ] Bundle size optimization

#### **2.3 useActiveBid Hook Optimization**
**Süre:** 2-3 gün
**Mevcut Sorun:** Complex state management, 5s polling

```typescript
// Hedef iyileştirmeler:
src/app/live-streams/[id]/hooks/
├── useActiveBid.ts           // Optimized version
├── useBidSocket.ts          // Socket events for bidding
└── useBidTimer.ts           // Countdown timer logic
```

**Teknik Gereksinimler:**
- [ ] Socket events ile polling'i değiştir
- [ ] Timer logic separation
- [ ] State management simplification
- [ ] Error recovery mechanism

---

## 🏗️ PHASE 3: ARCHİTECTURE RESTRUCTURING (3-4 Hafta)

### **Priority: MEDIUM** 🔧

#### **3.1 Component Architecture Redesign**
**Süre:** 6-8 gün

```typescript
// Hedef yapı:
src/app/live-streams/
├── page.tsx                    // Sadece container logic
├── components/
│   ├── StreamList/
│   │   ├── StreamList.tsx
│   │   ├── StreamCard.tsx
│   │   ├── StreamFilters.tsx
│   │   └── EmptyState.tsx
│   ├── CreateStreamButton/
│   └── shared/
│       ├── StreamStatusBadge.tsx
│       └── ViewerCount.tsx
├── [id]/
│   ├── page.tsx               // Sadece layout coordinator
│   ├── components/
│   │   ├── StreamViewer/
│   │   │   ├── JitsiContainer.tsx
│   │   │   ├── StreamOverlay.tsx
│   │   │   └── ViewerHUD.tsx
│   │   ├── StreamChat/        // Already refactored in Phase 1
│   │   ├── ProductAuction/
│   │   │   ├── ProductSection.tsx
│   │   │   ├── BiddingInterface.tsx
│   │   │   ├── AddProductForm.tsx
│   │   │   └── AuctionTimer.tsx
│   │   ├── StreamControls/
│   │   │   ├── StreamHeader.tsx
│   │   │   ├── StreamActions.tsx
│   │   │   └── StatusControls.tsx
│   │   └── layouts/
│   │       ├── StreamLayout.tsx
│   │       └── MobileLayout.tsx
│   ├── contexts/              // Already done in Phase 1
│   └── hooks/                 // Optimized in Phase 2
├── create/
│   ├── page.tsx
│   ├── components/
│   │   ├── CreateStreamForm.tsx
│   │   ├── StreamSettings.tsx
│   │   └── PreviewSection.tsx
│   └── hooks/
│       └── useCreateStream.ts
└── shared/
    ├── components/
    ├── hooks/
    ├── types/
    └── utils/
```

#### **3.2 State Management Restructuring**
**Süre:** 4-5 gün

```typescript
// Context yapısı:
src/app/live-streams/[id]/contexts/
├── StreamProvider.tsx         // Main stream state
├── SocketProvider.tsx         // Socket management
├── BiddingProvider.tsx        // Bidding state
└── ChatProvider.tsx           // Chat state

// Custom hooks:
src/app/live-streams/[id]/hooks/
├── stream/
│   ├── useStreamDetails.ts
│   ├── useStreamStatus.ts
│   └── useViewerCount.ts
├── bidding/
│   ├── useActiveBid.ts
│   ├── useBidding.ts
│   └── useAuctionTimer.ts
├── chat/
│   ├── useChatMessages.ts
│   ├── useChatSocket.ts
│   └── useChatInput.ts
└── media/
    ├── useJitsiConfig.ts
    └── useStreamPermissions.ts
```

#### **3.3 Error Handling & Loading States**
**Süre:** 3-4 gün

```typescript
// Error boundary yapısı:
src/app/live-streams/components/
├── ErrorBoundary/
│   ├── StreamErrorBoundary.tsx
│   ├── ChatErrorBoundary.tsx
│   └── BiddingErrorBoundary.tsx
├── LoadingStates/
│   ├── StreamSkeleton.tsx
│   ├── ChatSkeleton.tsx
│   └── ProductSkeleton.tsx
└── ErrorStates/
    ├── StreamError.tsx
    ├── NetworkError.tsx
    └── AuthError.tsx
```

---

## 🧪 PHASE 4: TEST & QUALİTY ASSURANCE (2-3 Hafta)

### **Priority: MEDIUM** 🔍

#### **4.1 TypeScript Strict Mode**
**Süre:** 4-5 gün

```typescript
// tsconfig.json updates:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Teknik Gereksinimler:**
- [ ] Tüm `any` type'ları düzelt
- [ ] Missing type definitions ekle
- [ ] Optional chaining optimization
- [ ] Type guards implementation

#### **4.2 Performance Monitoring**
**Süre:** 3-4 gün

```typescript
// Performance tracking:
src/lib/monitoring/
├── performance.ts            // Web Vitals tracking
├── socketMetrics.ts         // Socket performance
├── jitsiMetrics.ts          // Video call quality
└── userMetrics.ts           // User interaction tracking
```

---

## 🚀 PHASE 5: YENİ ÖZELLİKLER VE OPTİMİZASYON (3-4 Hafta)

### **Priority: LOW** ✨

#### **5.1 Advanced Features**
**Süre:** 8-10 gün

- [ ] **Stream Recording**: Yayın kaydetme özelliği
- [ ] **Stream Highlights**: Önemli anları işaretleme
- [ ] **Advanced Chat**: Emoji reactions, mentions
- [ ] **Better Mobile Experience**: PWA features
- [ ] **Analytics Dashboard**: Stream analytics

#### **5.2 Performance Enhancements**
**Süre:** 5-6 gün

- [ ] **CDN Integration**: Video content delivery
- [ ] **Caching Strategy**: Redis implementation
- [ ] **Database Optimization**: Query optimization
- [ ] **Bundle Splitting**: Code splitting optimization

---

## 📊 SUCCESS METRICS

### **Performance KPIs:**
- [ ] Page load time < 2 seconds
- [ ] Chat message delivery < 100ms
- [ ] WebRTC connection time < 3 seconds
- [ ] Memory usage stable (no leaks)
- [ ] Bundle size < 500KB (gzipped)

### **Code Quality KPIs:**
- [ ] Component LOC < 200 satır
- [ ] CSS file LOC < 150 satır
- [ ] TypeScript strict mode compliance
- [ ] Test coverage > 80%
- [ ] Zero console errors/warnings

### **User Experience KPIs:**
- [ ] Stream join success rate > 95%
- [ ] Chat message success rate > 99%
- [ ] Bidding response time < 200ms
- [ ] Mobile usability score > 90

---

## ⚠️ RİSK DEĞERLENDİRMESİ

### **HIGH RISK:**
- **Jitsi Integration Breaking**: Major refactor sırasında video calls bozulabilir
- **Socket Connection Issues**: Real-time features etkilenebilir
- **Database Migration**: Mevcut data migration riskleri

### **MEDIUM RISK:**
- **Performance Regression**: Optimization sırasında performance düşebilir
- **Mobile Compatibility**: Responsive design bozulabilir
- **SEO Impact**: Route changes SEO'yu etkileyebilir

### **MITIGATION STRATEGIES:**
- [ ] Feature flags ile gradual rollout
- [ ] Comprehensive testing her phase'de
- [ ] Database backup stratejisi
- [ ] Rollback planları hazırla
- [ ] Monitoring ve alerting setup

---

## 📋 NEXT STEPS

### **Hemen Başlanacak (Bu Hafta):**
1. [ ] StreamChat component refactor başlat
2. [ ] CSS modülerleştirme planla
3. [ ] Socket context yapısını design et
4. [ ] Dead code inventory çıkar

### **Önümüzdeki Hafta:**
1. [ ] Performance baseline measurements al
2. [ ] API standardization design doc
3. [ ] Component architecture blueprint
4. [ ] Testing strategy document

---

*Bu roadmap live document olarak güncellenecek ve her phase tamamlandıktan sonra review edilecektir.* 