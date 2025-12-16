'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout, user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
        ? 'bg-white dark:bg-[var(--background)] shadow-md py-2'
        : 'bg-transparent py-4'
        }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-[var(--primary)] flex items-center">
            <span className="w-8 h-8 bg-[var(--primary)] rounded-full flex items-center justify-center mr-2">
              <span className="text-white text-sm">BP</span>
            </span>
            Bidpazar
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/products"
              className="text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Ürünler
            </Link>
            <Link
              href="/categories"
              className="text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Kategoriler
            </Link>
            <Link
              href="/auctions"
              className="text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Açık Artırmalar
            </Link>
            <Link
              href="/about"
              className="text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Hakkımızda
            </Link>

            {isAuthenticated ? (
              <div className="relative group">
                <button
                  className="flex items-center text-[var(--foreground)] hover:text-[var(--primary)]"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <span className="mr-1">{user?.username || 'Hesap'}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  className={`absolute right-0 mt-2 w-48 bg-white dark:bg-[var(--background)] rounded-md shadow-lg py-1 z-10 ${isMenuOpen ? 'block' : 'hidden'
                    } group-hover:block`}
                >
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  >
                    Panel
                  </Link>
                  <Link
                    href="/dashboard/messages"
                    className="block px-4 py-2 text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  >
                    Mesajlar
                  </Link>
                  <Link
                    href="/products/create"
                    className="block px-4 py-2 text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  >
                    İlan Oluştur
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  >
                    Profil
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  >
                    Çıkış Yap
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/sign-in"
                  className="px-4 py-2 rounded-md text-[var(--foreground)] hover:bg-[var(--secondary)]"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)]"
                >
                  Kayıt Ol
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4">
            <Link
              href="/products"
              className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Ürünler
            </Link>
            <Link
              href="/categories"
              className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Kategoriler
            </Link>
            <Link
              href="/auctions"
              className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Açık Artırmalar
            </Link>
            <Link
              href="/about"
              className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
            >
              Hakkımızda
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  Panel
                </Link>
                <Link
                  href="/dashboard/messages"
                  className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  Mesajlar
                </Link>
                <Link
                  href="/products/create"
                  className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  İlan Oluştur
                </Link>
                <Link
                  href="/profile"
                  className="block py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  Profil
                </Link>
                <button
                  onClick={logout}
                  className="block w-full text-left py-2 text-[var(--foreground)] hover:text-[var(--primary)]"
                >
                  Çıkış Yap
                </button>
              </>
            ) : (
              <div className="mt-4 flex flex-col space-y-2">
                <Link
                  href="/sign-in"
                  className="block py-2 text-center rounded-md bg-[var(--secondary)] text-[var(--foreground)]"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/sign-up"
                  className="block py-2 text-center bg-[var(--primary)] text-white rounded-md"
                >
                  Kayıt Ol
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
} 