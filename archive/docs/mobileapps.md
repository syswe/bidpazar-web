# BidPazar Mobil Uygulamalar Mimarisi

## Teknoloji Yığını
- **Çatı:** Expo 53, React Native 0.79, React 19 (`bpmobile/package.json`).
- **Navigasyon:** React Navigation 7 (Stack + Bottom Tabs), `@expo/vector-icons`.
- **Depolama:** `@react-native-async-storage/async-storage`, iOS için `expo-secure-store`.
- **Auth & API:** Mobil `frontend-auth` yardımcıları (`bpmobile/src/lib/frontend-auth.ts`), `fetch` tabanlı REST çağrıları.
- **Hibrit yaklaşım:** Web içerikleri `react-native-webview` üzerinden `bidpazar.com` URL’lerine yönlendirilir; kritik ekranlar native olarak inşa edilmiştir.
- **Yapılandırma:** `app.json`, `eas.json`, platforma özel `ios` ve `android` klasörleri.

## Dizin Yapısı
- `App.tsx`: Uygulamanın giriş noktası; `AuthProvider` + `AppNavigator` + `ErrorBoundary`.
- `src/constants`: Tema (`theme.ts`) ve URL sabitleri (`urls.ts`).
- `src/context/AuthContext.tsx`: Kimlik, tema ve guest-mode durumunu yöneten global context.
- `src/lib/frontend-auth.ts`: Token saklama, oturum yenileme, mobil API endpointleri (`LOGIN_URL`, `LIVE_STREAMS_URL` vb.).
- `src/navigation`: `AppNavigator.tsx` & tip tanımları; kök stack, auth stack ve uygulama stack’i burada.
- `src/screens`: Her ekran için ayrı dosya (Home, Messages, Notifications, Onboarding, WebView, Login/Register/VerifySms vb.).
- `assets`: Uygulama ikonları, splash görselleri.
- `bpmobile/web-app`: Aynı Next.js kod tabanının mobil WebView optimizasyonlu kopyası; gerektiğinde PWA/embedded çözümler için kullanılır.

## Kimlik Doğrulama Akışı
- `AuthContext`:
  - Token ve kullanıcı bilgilerini yükler, `refreshAuthState` ile backend doğrulaması yapar (`validateToken(true)` çağrısı).
  - Guest mode desteği (`continueAsGuest`) ve tema seçimi (`setAppTheme`) sağlar.
  - AppState değişikliklerini dinleyerek iOS’ta arka plandan dönüşte yeniden doğrulama yapar.
- `frontend-auth.ts`:
  - iOS’ta SecureStore, Android’de AsyncStorage kullanır; SecureStore işlemleri için retry mekanizması (`withRetry`).
  - Token/JWT saklama anahtarları (`bidpazar_auth`, `bidpazar_token`); geri dönüşte JSON parse/doğrulama yapar.
  - Auth API tabanı `https://bidpazar.com/api/auth`; login/register/verify/resend uç noktaları ayrı sabitler olarak tanımlıdır.
  - Çıkış (`logout`) işlemi token’ı temizler, guest mode bayraklarını sıfırlar.
- Mobil token formatı, web uygulamasıyla uyumlu olacak şekilde `APP_VERSION` eşleşmesini bekler.

## Navigasyon ve Durum Yönetimi
- `AppNavigator.tsx`:
  - `RootStack` üç ana rotayı yönetir: Onboarding, AuthStack, AppStack.
  - `AuthStack`: Login, Register, SMS doğrulama ekranları (header’sız, `slide_from_right` animasyon).
  - `AppStack`: Home, WebView, ProfileEdit, Messages, Notifications; tema temelli header özelleştirmeleri.
  - Onboarding tamamlanma durumu AsyncStorage (`onboardingCompleted`) üzerinden izlenir; iOS ve Android için farklı polling süreleri.
  - Tema, React Navigation `DefaultTheme`/`DarkTheme` üzerine genişletilir; `StatusBar` ayarları tema ile eşlenir.
- `App.tsx` içinde ErrorBoundary, kritik hatalarda kullanıcıya bilgi mesajı gösterir.

## Ekranlar ve Deneyim
- **HomeScreen.tsx:**
  - Quick action kartları (Canlı Yayınlar, Ürünler, Mesajlar, Bildirimler).
  - `API_BASE_URL` üzerinden `live-streams?onlyActive=true` ve `products` endpointlerine istek atar.
  - Guest kullanıcılar için login yönlendirmesi veya WebView fallback’i.
- **WebViewScreen.tsx:**
  - Mobil uyumluluk için kapsamlı JavaScript enjeksiyonu (tema eşitleme, nav çubuğu sabitleme, scroll optimizasyonları).
  - Native dışa çıkış (`BackHandler`), kaydırma jestleri ve `Linking` ile mail/tel açılış desteği.
  - WebView içindeki Next.js layout’u tam ekran deneyime zorlar (`#__next` scroll container).
- **MessagesScreen / NotificationsScreen:**
  - API çağrıları ve placeholder bileşenleri ile native liste deneyimi.
  - Bildirimleri okundu işaretleme (`API_NOTIFICATIONS_READ_URL`).
- **Login/Register/VerifySmsScreen.tsx:**
  - Form doğrulaması, SMS kodu gönderimi, tekrar gönderme gibi akışlar.
  - Başarılı işlem sonrası `setAuthState` ile context güncellenir.
- **OnboardingScreen:** Carousel yapısı, AsyncStorage ile tamamlama flag’i.

## API ve Servis Entegrasyonu
- Tüm URL’ler `src/constants/urls.ts` üzerinden oluşturulur; mobil istekler `mobile=true&app=1&web_app=true` query parametreleriyle backend’e işaretlenir.
- Native ekranlar doğrudan REST çağrıları yaparken, bazı kapsamlı sayfalar (ürün listeleri, canlı yayın ekranı) WebView ile web uygulamasını kullanır.
- Push bildirim veya native modüller için şimdilik özel paket yok; ihtiyaç halinde Expo modül eklentileri `plugins` altında (ör. `expo-router`) görülebilir.

## Tema ve UX
- Tema renkleri `COLORS` objesiyle merkezi yönetilir (`src/constants/theme.ts`).
- `AuthProvider` tema tercihini AsyncStorage’da saklar, WebView içeriğine JS enjeksiyonuyla aktarır (`applyMobileTheme`).
- IOS/Android farklılıkları: SecureStore uyarıları bastırılır, StatusBar stilleri platforma göre değiştirilir.

## Yayın Deneyimi
- Mobil kullanıcı canlı yayın akışına `LIVE_STREAMS_URL` üzerinden WebView ile katılır; böylece LiveKit bileşenlerinin web sürümü kullanılabilir.
- Aynı token/doğrulama mekanizması paylaşıldığı için yayın odasına giren kullanıcıların yetkileri web ile aynıdır.
- Yerel LiveKit SDK entegrasyonu planlanırsa, mevcut `frontend-auth` ve token API akışı yeniden kullanılabilir.

## Yapılandırma ve Dağıtım
- `app.json`: Uygulama adı, ikonlar, paket kimlikleri (`com.bidpazar.mobile`), tablet desteği.
- `eas.json`: Development/preview/production build profilleri, auto increment ayarı.
- Komutlar (`bpmobile/package.json`):
  - `npm run start` → Metro bundler.
  - `npm run android` / `ios` → native derleme.
  - `npm run web` → Expo web (bpmobile/web-app kullanılabilir).
- Expo EAS ile dağıtım için `eas build --platform ios|android` ve `eas submit` akışları hazırdır.

## Gözlemler ve Öneriler
- WebView ağırlıklı yaklaşım, yeni feature’ların webde geliştirilip mobile yansıtılmasını kolaylaştırır ancak native his için optimizasyon devam etmelidir (özellikle nav bar scroll düzeltmeleri).
- Offline senaryoları için `frontend-auth` ve API çağrılarına ek hata yönetimi (retry/backoff) planlanabilir.
- LiveKit native SDK entegrasyonu hedeflenirse, `AuthContext` üzerinden alınan token ile doğrudan odaya bağlanma senaryosu kurgulanabilir.
