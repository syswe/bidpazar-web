"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { validateToken } from "@/lib/frontend-auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, refreshAuthState } = useAuth();
  const router = useRouter();
  const redirectingRef = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (isLoading || isLoggedIn || redirectingRef.current) return;

      redirectingRef.current = true;
      try {
        // Server-validate directly to avoid stale context checks
        const user = await validateToken(true);
        if (user) {
          // Hydrate context in background and allow rendering
          await refreshAuthState();
          redirectingRef.current = false;
          return;
        }
        // Not authenticated → redirect once
        const redirect = '/sign-in?redirect=' + encodeURIComponent(window.location.pathname);
        router.replace(redirect);
      } catch (error) {
        console.error("Authentication check failed:", error);
        const redirect = '/sign-in?redirect=' + encodeURIComponent(window.location.pathname);
        router.replace(redirect);
      }
    };

    void checkAuth();
  }, [isLoggedIn, isLoading, router, refreshAuthState]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="inline-block w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[var(--foreground)] font-medium">Yükleniyor...</p>
      </div>
    );
  }

  return isLoggedIn ? <>{children}</> : null;
} 
