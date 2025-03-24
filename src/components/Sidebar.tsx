'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Tv, LayoutDashboard } from 'lucide-react';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();

  // Use a stable ID for guest users (with useEffect to prevent hydration mismatch)
  const [guestId, setGuestId] = useState('');
  useEffect(() => {
    // Generate or retrieve a unique identifier for guest users
    let id = localStorage.getItem('guestId');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('guestId', id);
    }
    setGuestId(id);
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

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky left-0 top-0 h-screen z-50 bg-[var(--background)] border-r border-[var(--secondary)]
          transition-all duration-300 flex flex-col overflow-hidden
          ${isExpanded ? 'w-64' : 'w-16'}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-[var(--secondary)] relative">
          <div className={`flex items-center ${isExpanded ? 'w-full' : 'justify-center'}`}>
            {isExpanded ? (
              <Link href="/" className="text-xl font-bold text-[var(--primary)]">Bidpazar</Link>
            ) : (
              <Link href="/" className="text-xl font-bold text-[var(--primary)]">B</Link>
            )}
          </div>

          {/* Close/Open button positioned at top right */}
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 right-3 transform -translate-y-1/2 p-1 rounded-md hover:bg-[var(--secondary)] text-[var(--foreground)]"
            aria-label={isExpanded ? 'Daralt' : 'Genişlet'}
          >
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1 mt-4">
            <li>
              <Link href="/"
                className={`flex items-center px-4 py-2 rounded-lg 
                ${pathname === '/'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted hover:text-muted-foreground'}`}>
                <Home className="h-5 w-5 mr-2" />
                <span className="hidden lg:block">Anasayfa</span>
              </Link>
            </li>
            <li>
              <Link href="/products"
                className={`flex items-center px-4 py-2 rounded-lg 
                ${pathname.startsWith('/products')
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted hover:text-muted-foreground'}`}>
                <ShoppingBag className="h-5 w-5 mr-2" />
                <span className="hidden lg:block">Ürünler</span>
              </Link>
            </li>
            <li>
              <Link href="/live-streams"
                className={`flex items-center px-4 py-2 rounded-lg 
                ${pathname.startsWith('/live-streams')
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted hover:text-muted-foreground'}`}>
                <Tv className="h-5 w-5 mr-2" />
                <span className="hidden lg:block">Canlı Yayınlar</span>
              </Link>
            </li>
            {isAuthenticated && (
              <li>
                <Link href="/dashboard"
                  className={`flex items-center px-4 py-2 rounded-lg 
                  ${pathname.startsWith('/dashboard')
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted hover:text-muted-foreground'}`}>
                  <LayoutDashboard className="h-5 w-5 mr-2" />
                  <span className="hidden lg:block">Panelim</span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* Footer with theme toggle and user info */}
        <div className="p-4 border-t border-[var(--secondary)]">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center p-2 rounded-md hover:bg-[var(--secondary)] text-[var(--foreground)] mb-4"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
            {isExpanded && <span className="ml-3">{theme === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}</span>}
          </button>

          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white">
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
                      {guestId}
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