'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Tv, LayoutDashboard, Menu, ChevronLeft, MoonStar, Sun, MessageCircle, Package } from 'lucide-react';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();

  // Close sidebar on mobile by default
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsExpanded(false);
    }
  }, []);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden ${isExpanded ? 'block' : 'hidden'}`}
        onClick={toggleSidebar}
      />

      {/* Mobile menu toggle button - only visible when sidebar is collapsed on mobile */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 left-4 z-50 p-2 rounded-full bg-[var(--accent)] text-white shadow-lg md:hidden ${isExpanded ? 'hidden' : 'flex'} items-center justify-center`}
        aria-label="Open Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky left-0 top-0 h-screen z-50 bg-[var(--background)] border-r border-[var(--border)]
          transition-all duration-300 flex flex-col overflow-hidden premium-shadow
          ${isExpanded ? 'w-64' : 'md:w-16 -translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-[var(--border)] relative">
          <div className={`flex items-center ${isExpanded ? 'w-full' : 'justify-center'}`}>
            {isExpanded ? (
              <Link href="/" className="text-xl font-bold text-[var(--accent)]">
                <span className="bg-clip-text">Bidpazar</span>
              </Link>
            ) : (
              <Link href="/" className="text-xl font-bold text-[var(--accent)]">
                <span className="bg-clip-text">B</span>
              </Link>
            )}
          </div>

          {/* Close/Open button positioned at top right */}
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 right-3 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-[var(--secondary)] text-[var(--foreground)] transition-all"
            aria-label={isExpanded ? 'Daralt' : 'Genişlet'}
          >
            {isExpanded ? (
              <div className="flex items-center">
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </div>
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          <ul className="space-y-2 mt-6">
            <li>
              <Link href="/"
                className={`flex items-center ${isExpanded ? 'px-4' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all
                ${pathname === '/'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]'}`}>
                {isExpanded ? (
                  <>
                    <Home className="h-5 w-5 mr-3" />
                    <span>Anasayfa</span>
                  </>
                ) : (
                  <Home className="h-5 w-5" />
                )}
              </Link>
            </li>
            <li>
              <Link href="/products"
                className={`flex items-center ${isExpanded ? 'px-4' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all
                ${pathname.startsWith('/products')
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]'}`}>
                {isExpanded ? (
                  <>
                    <ShoppingBag className="h-5 w-5 mr-3" />
                    <span>Ürünler</span>
                  </>
                ) : (
                  <ShoppingBag className="h-5 w-5" />
                )}
              </Link>
            </li>
            <li>
              <Link href="/live-streams"
                className={`flex items-center ${isExpanded ? 'px-4' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all
                ${pathname.startsWith('/live-streams')
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]'}`}>
                {isExpanded ? (
                  <>
                    <Tv className="h-5 w-5 mr-3" />
                    <span>Canlı Yayınlar</span>
                  </>
                ) : (
                  <Tv className="h-5 w-5" />
                )}
              </Link>
            </li>
            <li>
              <Link href="/packages"
                className={`flex items-center ${isExpanded ? 'px-4' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all
                ${pathname.startsWith('/packages')
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]'}`}>
                {isExpanded ? (
                  <>
                    <Package className="h-5 w-5 mr-3" />
                    <span>Paketler</span>
                  </>
                ) : (
                  <Package className="h-5 w-5" />
                )}
              </Link>
            </li>
            {isAuthenticated && (
              <>
                <li>
                  <Link href="/dashboard"
                    className={`flex items-center ${isExpanded ? 'px-4' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all
                    ${pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/messages')
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]'}`}>
                    {isExpanded ? (
                      <>
                        <LayoutDashboard className="h-5 w-5 mr-3" />
                        <span>Panelim</span>
                      </>
                    ) : (
                      <LayoutDashboard className="h-5 w-5" />
                    )}
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/messages"
                    className={`flex items-center ${isExpanded ? 'px-4' : 'px-0 justify-center'} py-2.5 rounded-lg transition-all
                    ${pathname.startsWith('/dashboard/messages')
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]'}`}>
                    {isExpanded ? (
                      <>
                        <MessageCircle className="h-5 w-5 mr-3" />
                        <span>Mesajlar</span>
                      </>
                    ) : (
                      <MessageCircle className="h-5 w-5" />
                    )}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Footer with theme toggle and user info */}
        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center p-2 rounded-md hover:bg-[var(--secondary)] text-[var(--foreground)] mb-4 transition-all"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {isExpanded ? (
              <>
                {theme === 'light' ? (
                  <MoonStar className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
                <span className="ml-3">{theme === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}</span>
              </>
            ) : (
              <div className="w-full flex justify-center">
                {theme === 'light' ? (
                  <MoonStar className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </div>
            )}
          </button>

          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full premium-gradient flex items-center justify-center text-[var(--accent-foreground)] font-medium">
                {isAuthenticated && user ? user.username.charAt(0).toUpperCase() : 'G'}
              </div>
            </div>
            {isExpanded && (
              <div className="ml-3">
                {isAuthenticated && user ? (
                  <>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {user.name || user.username}
                    </p>
                    <div className="flex mt-1 space-x-2">
                      <Link href="/dashboard" className="text-xs text-[var(--primary)]">Profil</Link>
                      <button onClick={logout} className="text-xs text-[var(--accent)]">Çıkış Yap</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Misafir
                    </p>
                    <div className="flex mt-1 space-x-2">
                      <Link href="/sign-in" className="text-xs text-[var(--primary)]">Giriş Yap</Link>
                      <Link href="/sign-up" className="text-xs text-[var(--accent)]">Kayıt Ol</Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 