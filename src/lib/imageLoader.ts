/**
 * Custom Image Loader for Next.js
 * 
 * STRATEJİ:
 * 1. /uploads/* → Direkt URL döner (Nginx static serve)
 *    - Zaten WebP formatında
 *    - Nginx çok daha hızlı sunuyor
 *    - Next.js "received null" hatasını bypass ediyor
 * 
 * 2. Diğer her şey → /_next/image pipeline
 *    - Unsplash, S3, LoremFlickr vb. optimize edilir
 *    - Local assets (/assets/logo.png) optimize edilir
 *    - remotePatterns güvenlik kontrolü uygulanır
 */

interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // 1. STRATEJİ: Yerel Uploads (Nginx Static Serve)
  // Bu dosyalar zaten WebP ve diskte mevcut. Next.js işlemci yormasın.
  // Hem relative path (/uploads/...) hem de full URL (https://bidpazar.com/uploads/...) desteklenir.
  if (src.startsWith('/uploads/')) {
    return src;
  }
  
  // Full URL'lerde bidpazar.com/uploads/ path'ini kontrol et
  // Bu URL'ler zaten optimize edilmiş WebP formatında, doğrudan döndür
  if (src.includes('bidpazar.com/uploads/')) {
    return src;
  }

  // 2. STRATEJİ: Diğer Her Şey (Next.js Image Optimization)
  // Unsplash, S3, LoremFlickr, local assets, external URLs...
  // Bunları Next.js'in default optimizasyon pipeline'ına yönlendiriyoruz.
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}
