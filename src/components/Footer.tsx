'use client';

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--muted)] border-t border-[var(--border)] mt-16 pt-8 pb-6 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          {/* Column 1: About & Company */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-[var(--foreground)]">Kurumsal</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Bidpazar Nedir?</Link></li>
              <li><Link href="/shipping-returns" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Gönderim, İade ve Geri Ödeme</Link></li>
            </ul>
          </div>

          {/* Column 2: Support */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-[var(--foreground)]">Destek</h3>
            <ul className="space-y-2">
              <li><Link href="/contact" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Bize ulaş!</Link></li>
              <li><Link href="/faq" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Sıkça Sorulan Sorular</Link></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-[var(--foreground)]">Yasal</h3>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Kullanım Koşulları</Link></li>
              <li><Link href="/user-agreement" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Kullanıcı Sözleşmesi</Link></li>
            </ul>
          </div>
          
          {/* Column 4: Privacy */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-[var(--foreground)]">Gizlilik</h3>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Gizlilik Politikası</Link></li>
              <li><Link href="/kvkk" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">KVKK Aydınlatma Metni</Link></li>
              <li><Link href="/cookies" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">Çerezler Aydınlatma Metni</Link></li>
            </ul>
          </div>

          {/* Column 5: Mobile App */}
          <div className="md:col-span-3 lg:col-span-1">
            <h3 className="text-lg font-bold mb-3 text-[var(--foreground)]">Mobil Uygulama</h3>
            <div className="space-y-2">
              {/* Google Play Button */}
              <Link href="/download/android" className="flex items-center bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 w-full max-w-[200px] hover:shadow-md transition-all">
                <div className="mr-2 text-[var(--accent)]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                    <path d="M5.5 12.5l1.5-3.5h10l1.5 3.5-6.5 6.8-6.5-6.8zm6.5 2.8l4-4.3h-8l4 4.3z" /><path d="M12 4L3 15h6l3-4 3 4h6L12 4z" /><path d="M3 16h18v4H3v-4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-[var(--foreground)]">Google Play</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">İndir</div>
                </div>
              </Link>

              {/* App Store Button */}
              <Link href="/download/ios" className="flex items-center bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 w-full max-w-[200px] hover:shadow-md transition-all">
                <div className="mr-2 text-[var(--accent)]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                    <path d="M17.001 18.536c-.417.929-.918 1.733-1.514 2.422-.833.958-1.514 1.63-2.042 2.001-.814.754-1.694 1.141-2.639 1.162-.676 0-1.487-.192-2.437-.583-.95-.389-1.82-.583-2.611-.583-.833 0-1.722.194-2.669.583-.949.389-1.713.591-2.3.61-.889.038-1.776-.359-2.661-1.192-.571-.399-1.286-1.102-2.146-2.108-.919-1.081-1.679-2.331-2.28-3.754-.643-1.522-.965-2.993-.965-4.414 0-1.934.419-3.607 1.26-4.82.664-.967 1.545-1.733 2.647-2.296 1.102-.563 2.296-.852 3.584-.871.702 0 1.623.216 2.767.641 1.142.425 1.879.641 2.209.641.241 0 1.064-.252 2.458-.755 1.317-.466 2.428-.659 3.34-.583 2.467.198 4.318 1.174 5.545 2.932-2.207 1.335-3.295 3.205-3.27 5.602.025 1.869.699 3.423 2.022 4.654.6.57 1.268.998 2.009 1.292-.16.466-.33.912-.507 1.336zM13.106.329c0 1.467-.535 2.839-1.605 4.111-1.291 1.509-2.851 2.383-4.542 2.246-.022-.179-.036-.366-.036-.57 0-1.434.626-2.976 1.735-4.228.554-.638 1.257-1.167 2.111-1.591.852-.419 1.657-.649 2.415-.693.023.242.033.484.033.725z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-[var(--foreground)]">App Store</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">İndir</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Social Media Icons */}
        <div className="flex justify-center space-x-5 mb-6">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--primary)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" /></svg>
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--primary)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.954 4.569a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 9.99 9.99 0 01-3.127 1.195 4.92 4.92 0 00-8.384 4.482C7.691 8.094 4.066 6.13 1.64 3.161a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.061a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.937 4.937 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63a9.936 9.936 0 002.46-2.548l-.047-.02z" /></svg>
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--primary)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
          </a>
        </div>

        <div className="text-center text-[var(--foreground)] opacity-75 text-sm border-t border-[var(--border)] pt-6">
          Bidpazar 2025 © Tüm hakkı saklıdır
        </div>
      </div>
    </footer>
  );
} 