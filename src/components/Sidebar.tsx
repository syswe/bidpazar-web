"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { usePathname } from "next/navigation";
import {
  Home,
  ShoppingBag,
  Tv,
  LayoutDashboard,
  Menu,
  ChevronLeft,
  MoonStar,
  Sun,
  MessageCircle,
  Package,
  Bell,
  ShieldAlert,
  Users,
  Layers,
} from "lucide-react";

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();
  const [notificationCount, setNotificationCount] = useState(0);

  // Desktop-only resize logic
  useEffect(() => {
    const handleResize = () => {
      // Only apply to large screens (sidebar is hidden on mobile/tablet anyway)
      if (window.innerWidth >= 1024) {
        setIsExpanded(window.innerWidth >= 1024);
      }
    };

    // Set initial state for large screens
    if (window.innerWidth >= 1024) {
      setIsExpanded(true);
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Clean up
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch notifications if user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();

      // Set up polling for notifications every 30 seconds
      const intervalId = setInterval(fetchNotifications, 30000);

      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, user]);

  const fetchNotifications = async () => {
    try {
      // Get token from localStorage with safer parsing
      let token = "";
      const authData = localStorage.getItem("auth");
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed.token || "";
        } catch (e) {
          console.error("Failed to parse auth data:", e);
        }
      }

      const response = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>

      {/* Sidebar - Hidden on mobile/tablet, visible on large screens */}
      <aside
        className={`
          hidden lg:sticky left-0 top-0 h-screen z-50 
          bg-[var(--background)] border-r border-[var(--border)]
          transition-all duration-300 ease-in-out lg:flex flex-col
          overflow-hidden premium-shadow
          ${
            isExpanded
              ? "lg:w-64"
              : "lg:w-16"
          }
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-4 border-b border-[var(--border)] relative">
          <div
            className={`flex items-center ${
              isExpanded ? "w-full" : "justify-center"
            }`}
          >
            {isExpanded ? (
              <Link href="/" className="text-xl font-bold text-[var(--accent)]">
                <span className="bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--primary)]">
                  Bidpazar
                </span>
              </Link>
            ) : (
              <Link href="/" className="text-xl font-bold text-[var(--accent)]">
                <span className="bg-clip-text">B</span>
              </Link>
            )}
          </div>

          {/* Desktop-only toggle button */}
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 right-3 transform -translate-y-1/2 p-1.5 rounded-md hover:bg-[var(--secondary)] text-[var(--foreground)] transition-all"
            aria-label={isExpanded ? "Daralt" : "Genişlet"}
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
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
          <ul className="space-y-2 mt-4">
            <li>
              <Link
                href="/"
                className={`flex items-center ${
                  isExpanded ? "px-4" : "px-0 justify-center"
                } py-2.5 rounded-lg transition-all
                ${
                  pathname === "/"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                }`}
              >
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
              <Link
                href="/products"
                className={`flex items-center ${
                  isExpanded ? "px-4" : "px-0 justify-center"
                } py-2.5 rounded-lg transition-all
                ${
                  pathname.startsWith("/products")
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                }`}
              >
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
              <Link
                href="/live-streams"
                className={`flex items-center ${
                  isExpanded ? "px-4" : "px-0 justify-center"
                } py-2.5 rounded-lg transition-all
                ${
                  pathname.startsWith("/live-streams")
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                }`}
              >
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
              <Link
                href="/packages"
                className={`flex items-center ${
                  isExpanded ? "px-4" : "px-0 justify-center"
                } py-2.5 rounded-lg transition-all
                ${
                  pathname.startsWith("/packages")
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                }`}
              >
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
                  <Link
                    href="/dashboard"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname.startsWith("/dashboard") &&
                      !pathname.startsWith("/dashboard/messages") &&
                      !pathname.startsWith("/dashboard/notifications")
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
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
                  <Link
                    href="/dashboard/messages"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname.startsWith("/dashboard/messages")
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
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
                <li>
                  <Link
                    href="/dashboard/notifications"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all relative
                    ${
                      pathname.startsWith("/dashboard/notifications")
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <Bell className="h-5 w-5 mr-3" />
                        <span>Bildirimler</span>
                        {notificationCount > 0 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-[var(--accent)] text-white text-xs font-medium">
                            {notificationCount > 99 ? "99+" : notificationCount}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="relative">
                        <Bell className="h-5 w-5" />
                        {notificationCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[var(--accent)] text-white text-xs font-medium">
                            {notificationCount > 9 ? "9+" : notificationCount}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              </>
            )}

            {/* Admin Section - Only visible for admin users */}
            {isAuthenticated && user?.isAdmin && (
              <>
                <li className="pt-4 pb-2">
                  {isExpanded && (
                    <div className="px-4 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                      Admin Paneli
                    </div>
                  )}
                  {!isExpanded && (
                    <div className="border-t border-[var(--border)] my-2"></div>
                  )}
                </li>

                <li>
                  <Link
                    href="/admin"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname === "/admin"
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <ShieldAlert className="h-5 w-5 mr-3" />
                        <span>Admin Paneli</span>
                      </>
                    ) : (
                      <ShieldAlert className="h-5 w-5" />
                    )}
                  </Link>
                </li>

                <li>
                  <Link
                    href="/admin/users"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname === "/admin/users"
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <Users className="h-5 w-5 mr-3" />
                        <span>Kullanıcılar</span>
                      </>
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </Link>
                </li>

                <li>
                  <Link
                    href="/admin/products"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname === "/admin/products"
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <Package className="h-5 w-5 mr-3" />
                        <span>Ürünler</span>
                      </>
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </Link>
                </li>

                <li>
                  <Link
                    href="/admin/categories"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname === "/admin/categories"
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <Layers className="h-5 w-5 mr-3" />
                        <span>Kategoriler</span>
                      </>
                    ) : (
                      <Layers className="h-5 w-5" />
                    )}
                  </Link>
                </li>

                <li>
                  <Link
                    href="/admin/streams"
                    className={`flex items-center ${
                      isExpanded ? "px-4" : "px-0 justify-center"
                    } py-2.5 rounded-lg transition-all
                    ${
                      pathname === "/admin/streams"
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]"
                    }`}
                  >
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
              </>
            )}
          </ul>
        </div>

        {/* Footer with theme toggle and user info */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--secondary-background)] backdrop-blur-sm">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center p-2 rounded-md hover:bg-[var(--secondary)] text-[var(--foreground)] mb-4 transition-all"
            aria-label={
              theme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
          >
            {isExpanded ? (
              <>
                {theme === "light" ? (
                  <MoonStar className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
                <span className="ml-3">
                  {theme === "light" ? "Karanlık Mod" : "Aydınlık Mod"}
                </span>
              </>
            ) : (
              <div className="w-full flex justify-center">
                {theme === "light" ? (
                  <MoonStar className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </div>
            )}
          </button>

          {isAuthenticated && user ? (
            <div
              className={`${
                isExpanded ? "p-3" : "p-2"
              } rounded-lg bg-gradient-to-r from-[var(--accent)]/10 to-[var(--primary)]/10 border border-[var(--border)] shadow-sm`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] flex items-center justify-center text-white text-sm font-medium shadow-md">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {user.name || user.username}
                    </p>
                    <div className="flex mt-1 space-x-3">
                      <Link
                        href="/dashboard"
                        className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
                      >
                        Profil
                      </Link>
                      <button
                        onClick={logout}
                        className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
                      >
                        Çıkış
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`${
                isExpanded ? "p-3" : "p-2"
              } rounded-lg bg-gradient-to-r from-[var(--accent)]/10 to-[var(--primary)]/10 border border-[var(--border)] shadow-sm`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] flex items-center justify-center text-white text-sm font-medium shadow-md">
                    G
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Misafir
                    </p>
                    <div className="flex mt-1 space-x-3">
                      <Link
                        href="/login"
                        className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
                      >
                        Giriş
                      </Link>
                      <Link
                        href="/register"
                        className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
                      >
                        Kayıt
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
