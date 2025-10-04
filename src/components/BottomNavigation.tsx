"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ShoppingBag, Tv, User } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import useSwipeGesture from "@/hooks/useSwipeGesture";

const BottomNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1024);
      setIsDesktop(width >= 1024);
    };

    // Initial check
    checkScreenSize();

    // Add event listener
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Effect to check and listen for guest mode status from the WebView host
  useEffect(() => {
    const checkGuestMode = () => {
      const guestMode = localStorage.getItem('isGuestMode') === 'true';
      if (isGuest !== guestMode) {
        setIsGuest(guestMode);
      }
    };

    const handleAuthStateChange = (event: Event) => {
      const guestMode = (event as CustomEvent).detail?.isGuestMode;
      if (guestMode !== undefined && isGuest !== guestMode) {
        setIsGuest(guestMode);
      }
    };

    checkGuestMode(); // Initial check

    // Listen for custom events dispatched from the React Native WebView
    window.addEventListener('authStateChanged', handleAuthStateChange);
    // Use the 'storage' event as a fallback
    window.addEventListener('storage', checkGuestMode);

    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange);
      window.removeEventListener('storage', checkGuestMode);
    };
  }, [isGuest]);

  // Reset navigation loading state when pathname changes
  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const triggerHaptic = useCallback(() => {
    try {
      // React Native WebView haptic feedback
      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({
          type: 'haptic',
          style: 'light'
        }));
      }
      // Web Vibration API fallback
      else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (error) {
      // Silently fail - not all devices support haptic feedback
    }
  }, []);

  const handleNavigation = useCallback(
    (
      href: string,
      e:
        | React.MouseEvent<HTMLAnchorElement>
        | React.KeyboardEvent<HTMLAnchorElement>
    ) => {
      // If already on the page, prevent default and do nothing
      if (pathname === href) {
        e.preventDefault();
        return;
      }

      // Indicate navigation + haptic, let <Link> handle route change
      setNavigatingTo(href);
      triggerHaptic();
    },
    [pathname, triggerHaptic]
  );

  const navItems = useMemo(() => {
    const allItems = [
      {
        icon: Home,
        label: "Ana Sayfa",
        href: "/",
        isActive: pathname === "/",
      },
      {
        icon: ShoppingBag,
        label: "Ürünler",
        href: "/products",
        isActive: pathname.startsWith("/products"),
      },
      {
        icon: Tv,
        label: "Yayınlar",
        href: "/live-streams",
        isActive: pathname.startsWith("/live-streams"),
      },
      {
        icon: User,
        label: "Hesabım",
        href: "/dashboard",
        isActive: pathname.startsWith("/dashboard"),
      },
    ];

    // If in guest mode, filter out the "Hesabım" (Account) link
    if (isGuest) {
      return allItems.filter(item => item.href !== '/dashboard');
    }

    return allItems;
  }, [pathname, isGuest]);

  // Swipe navigation
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = navItems.findIndex(item => item.isActive);
    const nextIndex = (currentIndex + 1) % navItems.length;
    const nextItem = navItems[nextIndex];
    if (nextItem) {
      setNavigatingTo(nextItem.href);
      triggerHaptic();
      router.push(nextItem.href);
    }
  }, [navItems, router, triggerHaptic]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = navItems.findIndex(item => item.isActive);
    const prevIndex = (currentIndex - 1 + navItems.length) % navItems.length;
    const prevItem = navItems[prevIndex];
    if (prevItem) {
      setNavigatingTo(prevItem.href);
      triggerHaptic();
      router.push(prevItem.href);
    }
  }, [navItems, router, triggerHaptic]);

  const swipeRef = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 80, // Require longer swipe for navigation
  });

  const navStyle: React.CSSProperties = useMemo(() => ({
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '68px',
    background: 'var(--background)',
    borderTop: '1px solid var(--border)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    zIndex: 1000,
    boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.08)',
    display: isDesktop ? 'none' : 'block', // Hide on desktop (≥1024px)
  }), [isDesktop]);

  const containerStyle: React.CSSProperties = useMemo(() => ({
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: isTablet ? '0 24px' : '0 8px',
    maxWidth: isTablet ? '600px' : '480px',
    margin: '0 auto',
  }), [isTablet]);

  const getItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isTablet ? '60px' : '44px',
    minHeight: isTablet ? '60px' : '44px',
    padding: isTablet ? '8px 12px' : '6px 8px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: isActive ? 'var(--accent)' : 'var(--foreground)',
    opacity: isActive ? 1 : 0.7,
    transition: 'all 200ms ease-in-out',
    position: 'relative',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    transform: isActive ? 'scale(1.05)' : 'scale(1)',
    outline: 'none',
  });

  const getFocusStyle = (): React.CSSProperties => ({
    outline: '2px solid var(--accent)',
    outlineOffset: '2px',
    borderRadius: '12px',
  });

  const iconContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '2px',
  };

  const dotStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '8px',
    height: '8px',
    background: 'var(--accent)',
    borderRadius: '50%',
    border: '2px solid var(--background)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: isTablet ? '11px' : '10px',
    fontWeight: 500,
    lineHeight: 1,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };

  // Don't render on desktop
  if (isDesktop) return null;

  return (
    <nav
      ref={swipeRef}
      style={navStyle}
      role="navigation"
      aria-label="Ana navigasyon"
    >
      <div style={containerStyle}>
        {navItems.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={getItemStyle(item.isActive)}
              aria-label={item.label}
              aria-current={item.isActive ? 'page' : undefined}
              tabIndex={0}
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                handleNavigation(item.href, e)
              }
              onFocus={(e: React.FocusEvent<HTMLAnchorElement>) => {
                Object.assign((e.target as HTMLElement).style, getFocusStyle());
              }}
              onBlur={(e: React.FocusEvent<HTMLAnchorElement>) => {
                (e.target as HTMLElement).style.outline = 'none';
                (e.target as HTMLElement).style.outlineOffset = '';
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLAnchorElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNavigation(item.href, e);
                }
                // Arrow key navigation
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  const direction = e.key === 'ArrowLeft' ? -1 : 1;
                  const nextIndex = (index + direction + navItems.length) % navItems.length;
                  const nextElement = e.currentTarget.parentElement?.children[nextIndex] as HTMLElement;
                  nextElement?.focus();
                }
              }}
            >
              <div style={iconContainerStyle}>
                {navigatingTo === item.href ? (
                  <LoadingSpinner size={24} />
                ) : (
                  <>
                    <IconComponent size={24} />
                    {item.isActive && <div style={dotStyle} />}
                  </>
                )}
              </div>
              <span style={labelStyle}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation; 
