# BidPazar - Proje Refactoring Planı

## 📋 Mevcut Durum Analizi

### ✅ İyi Yapılandırılmış Alanlar
- **API Route'ları**: App Router standardında, RESTful yapı
- **Middleware**: Edge Runtime, organize public path yönetimi
- **Authentication**: Hibrit JWT + NextAuth yaklaşımı
- **Database**: Prisma ORM ile temiz ilişkiler
- **Socket.IO**: Global instance ve room yönetimi

### ❌ İyileştirme Gereken Alanlar
- **Component Organizasyonu**: Tek klasörde karışık yapı
- **Page Komponenleri**: Çok büyük dosyalar (1000+ satır)
- **Style Yönetimi**: globals.css çok büyük (692 satır)
- **Utils Dağınık**: Feature-specific utils farklı yerlerde
- **Type Definitions**: Dağınık ve az organize
- **Hooks**: Merkezi organizasyon eksik

---

## 🎯 Refactoring Hedefleri

1. **Feature-Based Architecture**: Her özellik kendi klasöründe
2. **Component Kategorileri**: UI, Form, Layout, Feature komponenleri
3. **Code Splitting**: Büyük dosyaları parçalara ayırma
4. **Style Organization**: CSS modülleri ve theme sistemi
5. **Type Safety**: Merkezi tip yönetimi
6. **Performance**: Lazy loading ve optimization

---

## 📁 Yeni Proje Yapısı

```
src/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/                  # Dashboard route group
│   │   ├── dashboard/
│   │   ├── profile/
│   │   └── settings/
│   ├── (public)/                     # Public pages route group
│   │   ├── page.tsx                  # Home page
│   │   ├── about/
│   │   ├── contact/
│   │   └── legal/                    # Legal pages (privacy, terms, etc.)
│   ├── (platform)/                  # Main platform features
│   │   ├── products/
│   │   ├── live-streams/
│   │   └── auctions/
│   ├── admin/                        # Admin area
│   ├── api/                          # API Routes (keep current structure)
│   ├── globals.css                   # Base styles only
│   └── layout.tsx
├── components/                       # Reorganized components
│   ├── ui/                          # Reusable UI components
│   │   ├── buttons/
│   │   ├── forms/
│   │   ├── modals/
│   │   ├── navigation/
│   │   └── feedback/
│   ├── layout/                      # Layout components
│   │   ├── Sidebar/
│   │   ├── Navigation/
│   │   ├── Footer/
│   │   └── MobileLayout/
│   ├── features/                    # Feature-specific components
│   │   ├── auth/
│   │   ├── products/
│   │   ├── live-streams/
│   │   ├── chat/
│   │   └── auctions/
│   └── providers/                   # Context providers
│       ├── AuthProvider/
│       ├── ThemeProvider/
│       └── SocketProvider/
├── features/                        # Feature modules
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── live-streams/
│   │   ├── components/
│   │   │   ├── StreamViewer/
│   │   │   ├── StreamControls/
│   │   │   ├── StreamChat/
│   │   │   └── ProductAuction/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── products/
│   ├── auctions/
│   └── chat/
├── lib/                             # Shared utilities
│   ├── api/                         # API client (keep current)
│   ├── auth/                        # Auth utilities (keep current)
│   ├── database/                    # Database utilities
│   ├── validation/                  # Zod schemas
│   ├── constants/                   # App constants
│   └── utils/                       # Common utilities
├── hooks/                           # Shared custom hooks
│   ├── useApi.ts
│   ├── useSocket.ts
│   ├── useLocalStorage.ts
│   └── useDebounce.ts
├── types/                           # Centralized types
│   ├── api.ts
│   ├── auth.ts
│   ├── database.ts
│   ├── live-streams.ts
│   └── shared.ts
├── styles/                          # Style organization
│   ├── globals.css                  # Base styles
│   ├── components/                  # Component-specific styles
│   ├── pages/                       # Page-specific styles
│   └── themes/                      # Theme definitions
└── utils/                           # Shared utilities
    ├── date.ts
    ├── format.ts
    ├── validation.ts
    └── constants.ts
```

---

## 🏗️ Refactoring Aşamaları

### Phase 1: Component Reorganization (1-2 hafta)

#### 1.1 UI Components Extraction
```bash
# Yeni yapı oluştur
mkdir -p src/components/ui/{buttons,forms,modals,navigation,feedback}
mkdir -p src/components/layout/{Sidebar,Navigation,Footer,MobileLayout}
mkdir -p src/components/features/{auth,products,live-streams,chat,auctions}
```

**Taşınacak Dosyalar:**
- `components/Sidebar.tsx` → `components/layout/Sidebar/index.tsx`
- `components/Navigation.tsx` → `components/layout/Navigation/index.tsx`
- `components/MobileLayout.tsx` → `components/layout/MobileLayout/index.tsx`
- `components/AuthProvider.tsx` → `components/providers/AuthProvider/index.tsx`

#### 1.2 Page Components Breakdown

**src/app/page.tsx (1205 satır) → Parçalara Ayır:**
```typescript
// src/app/(public)/page.tsx - Ana container (50-100 satır)
// src/components/features/home/HeroBanner.tsx
// src/components/features/home/StorySection.tsx  
// src/components/features/home/ProductGrid.tsx
// src/components/features/home/LiveStreamSection.tsx
// src/components/features/home/ComingSoonPopup.tsx
```

**src/app/live-streams/[id]/page.tsx (864 satır) → Parçalara Ayır:**
```typescript
// src/app/(platform)/live-streams/[id]/page.tsx - Container (100-150 satır)
// src/features/live-streams/components/StreamViewer/JitsiContainer.tsx
// src/features/live-streams/components/StreamViewer/StreamOverlay.tsx
// src/features/live-streams/components/StreamControls/StreamHeader.tsx
// src/features/live-streams/components/ProductAuction/BiddingInterface.tsx
```

### Phase 2: Feature Module Creation (1-2 hafta)

#### 2.1 Live Streams Feature Module
```bash
mkdir -p src/features/live-streams/{components,hooks,services,types,utils}
```

**Taşınacak/Düzenlenecek:**
- `app/live-streams/[id]/components/*` → `features/live-streams/components/`
- `app/live-streams/[id]/hooks/*` → `features/live-streams/hooks/`
- `app/live-streams/[id]/utils/*` → `features/live-streams/utils/`

#### 2.2 Authentication Feature Module
```bash
mkdir -p src/features/auth/{components,hooks,services,types,utils}
```

**Taşınacak:**
- Login/Register page components → `features/auth/components/`
- Auth-related utilities → `features/auth/utils/`

#### 2.3 Products Feature Module
```bash
mkdir -p src/features/products/{components,hooks,services,types,utils}
```

### Phase 3: Style Reorganization (1 hafta)

#### 3.1 CSS Module Structure
```bash
mkdir -p src/styles/{components,pages,themes}
```

**globals.css (692 satır) → Parçalara Ayır:**
- `styles/globals.css` - Base styles (50-100 satır)
- `styles/components/buttons.css` - Button styles
- `styles/components/forms.css` - Form styles  
- `styles/components/cards.css` - Card styles
- `styles/themes/variables.css` - CSS variables
- `styles/themes/dark.css` - Dark theme
- `styles/themes/light.css` - Light theme

#### 3.2 Component-Specific Styles
```typescript
// Example: StreamViewer with CSS modules
import styles from './StreamViewer.module.css';

export const StreamViewer = () => {
  return <div className={styles.container}>...</div>;
};
```

### Phase 4: Type Safety Enhancement (1 hafta)

#### 4.1 Centralized Type Definitions
```typescript
// src/types/api.ts
export interface APIResponse<T = any> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    total?: number;
  };
  error?: string;
}

// src/types/live-streams.ts  
export interface LiveStream {
  id: string;
  title: string;
  status: StreamStatus;
  // ...
}

// src/types/database.ts - Prisma types re-export
export type { User, Product, LiveStream } from '@prisma/client';
```

#### 4.2 Feature-Specific Types
```typescript
// src/features/live-streams/types/index.ts
export interface StreamViewerProps {
  streamId: string;
  isStreamer: boolean;
  // ...
}
```

### Phase 5: Hook Optimization (1 hafta)

#### 5.1 Shared Hooks
```bash
mkdir -p src/hooks
```

**Yeni Hooks:**
- `useApi.ts` - API call wrapper
- `useSocket.ts` - Socket.IO wrapper
- `useLocalStorage.ts` - LocalStorage wrapper
- `useDebounce.ts` - Debounce utility

#### 5.2 Feature Hooks
```typescript
// src/features/live-streams/hooks/useStreamViewer.ts
export const useStreamViewer = (streamId: string) => {
  // Combine useStreamDetails + useActiveBid + socket logic
};
```

---

## 🚀 Implementation Plan

### Week 1-2: Foundation Refactoring
1. **Day 1-3**: Component reorganization (UI, Layout)
2. **Day 4-7**: Page component breakdown (Home, LiveStream)  
3. **Day 8-10**: Feature module setup (LiveStreams, Auth)

### Week 3-4: Advanced Refactoring  
1. **Day 1-3**: Style reorganization + CSS modules
2. **Day 4-5**: Type safety enhancement
3. **Day 6-7**: Hook optimization + cleanup

### Week 5: Testing & Polish
1. **Day 1-3**: Integration testing
2. **Day 4-5**: Performance optimization
3. **Day 6-7**: Documentation update

---

## 🔧 Migration Guidelines

### File Movement Rules
1. **Keep API routes unchanged** - Current structure is good
2. **Use barrel exports** - `index.ts` files for clean imports
3. **Maintain backward compatibility** - Gradual migration
4. **Update imports progressively** - One feature at a time

### Component Naming Conventions
```typescript
// Feature components: Feature + Component
LiveStreamViewer, ProductCard, AuthLoginForm

// UI components: Generic names
Button, Modal, Input, Card

// Layout components: Layout + Name  
LayoutSidebar, LayoutNavigation, LayoutMobileNav
```

### Import Organization
```typescript
// 1. React & Next.js
import React from 'react';
import { useRouter } from 'next/navigation';

// 2. External libraries
import { toast } from 'sonner';

// 3. Internal components
import { Button } from '@/components/ui/buttons';
import { LiveStreamViewer } from '@/features/live-streams/components';

// 4. Hooks & utilities
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/date';

// 5. Types
import type { LiveStream } from '@/types/live-streams';
```

---

## 📏 Code Quality Standards

### Component Standards
- **Max 200 lines** per component file
- **Single responsibility** principle
- **TypeScript strict mode** enabled
- **Props interface** for all components
- **Error boundaries** for complex components

### Performance Standards
- **Lazy loading** for non-critical components
- **React.memo** for expensive components  
- **useMemo/useCallback** for optimization
- **Code splitting** at route level

### Testing Standards
- **Unit tests** for utilities and hooks
- **Component tests** for UI components
- **Integration tests** for features
- **E2E tests** for critical user flows

---

## 🎉 Expected Benefits

### Developer Experience
- **Faster development** - Clear structure and patterns
- **Easier maintenance** - Logical organization
- **Better collaboration** - Consistent conventions
- **Reduced bugs** - Better type safety

### Performance
- **Smaller bundles** - Code splitting and lazy loading
- **Faster rendering** - Optimized components
- **Better caching** - CSS modules and static assets
- **Improved SEO** - Cleaner markup and structure

### Scalability
- **Feature isolation** - Independent development
- **Reusable components** - Design system approach
- **Modular architecture** - Easy to extend
- **Clean dependencies** - Reduced coupling

---

## ⚠️ Migration Risks & Mitigation

### Potential Issues
1. **Import path changes** - Massive refactoring needed
2. **Build breaks** - Dependencies might fail
3. **Performance regression** - Over-optimization
4. **Team coordination** - Multiple developers working

### Mitigation Strategies
1. **Gradual migration** - One feature at a time
2. **Comprehensive testing** - Before and after each phase
3. **Code review** - Peer review for all changes
4. **Rollback plan** - Git branching strategy

---

## 📋 Checklist

### Pre-Migration
- [ ] Create feature branches for each phase
- [ ] Set up backup of current codebase
- [ ] Update development environment
- [ ] Inform team about refactoring plan

### Phase 1 Checklist
- [ ] Create new directory structure
- [ ] Move UI components to `components/ui/`
- [ ] Move layout components to `components/layout/`
- [ ] Update import paths
- [ ] Test component rendering

### Phase 2 Checklist  
- [ ] Create feature modules
- [ ] Move feature-specific components
- [ ] Reorganize hooks and utilities
- [ ] Update API integrations
- [ ] Test feature functionality

### Phase 3 Checklist
- [ ] Split globals.css into modules
- [ ] Implement CSS modules
- [ ] Update component styles
- [ ] Test responsive design
- [ ] Verify theme switching

### Phase 4 Checklist
- [ ] Centralize type definitions
- [ ] Add missing TypeScript types
- [ ] Fix type errors
- [ ] Add prop interfaces
- [ ] Verify type safety

### Phase 5 Checklist
- [ ] Create shared hooks
- [ ] Optimize component hooks
- [ ] Test hook functionality
- [ ] Performance verification
- [ ] Documentation update

### Post-Migration
- [ ] Full integration testing
- [ ] Performance benchmarking
- [ ] Documentation update
- [ ] Team training on new structure
- [ ] Deployment verification

---

## 📚 Documentation Updates Needed

1. **README.md** - Updated project structure
2. **Component docs** - Storybook or similar
3. **API docs** - Feature integration guides
4. **Development guide** - New patterns and conventions
5. **Deployment guide** - Build and deployment updates

Bu refactoring planı, proje yapısını modern standartlara uygun hale getirecek ve gelecekte daha kolay genişletilebilir bir temel oluşturacaktır. 