# Debug Logs Konfigürasyonu

Bu proje, spam log'ları azaltmak için debug mod sistemi kullanır. Normal kullanımda log spam'ı olmaz, ancak gerektiğinde debug modları aktif edilebilir.

## Debug Mod Türleri

### 1. Auth Logları
```bash
DEBUG_AUTH=true npm run dev
```
- Token verification logları
- User authentication logları
- JWT processing logları

### 2. Notification Logları
```bash
DEBUG_NOTIFICATIONS=true npm run dev
```
- Notification API request/response logları
- Notification polling logları

### 3. Message Logları
```bash
DEBUG_MESSAGES=true npm run dev
```
- Message API logları
- Conversation logları
- Message notification logları

### 4. Chat Logları
```bash
DEBUG_CHAT=true npm run dev
```
- Live stream chat logları
- Chat message processing logları

## Tüm Debug Loglarını Aktif Etme

```bash
DEBUG_AUTH=true DEBUG_NOTIFICATIONS=true DEBUG_MESSAGES=true DEBUG_CHAT=true npm run dev
```

Veya `.env.local` dosyasına ekleyerek:

```env
DEBUG_AUTH=true
DEBUG_NOTIFICATIONS=true
DEBUG_MESSAGES=true
DEBUG_CHAT=true
```

## Production'da Debug Logları

Production ortamında debug logları varsayılan olarak kapalıdır. Sadece error logları görünür.

## Log Sistemi Geliştirme

Yeni API endpoint'leri eklerken, sürekli çalışan/polling yapan endpoint'ler için debug mod kullanmayı unutmayın:

```typescript
// Enable debug logs with DEBUG_FEATURE=true
const DEBUG_FEATURE = process.env.DEBUG_FEATURE === 'true';

// Only log in debug mode
if (DEBUG_FEATURE) {
  logger.info('Debug message');
}
```

Bu sayede hem geliştirme deneyimi iyileşir hem de production logları temiz kalır. 