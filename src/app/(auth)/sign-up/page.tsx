"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  register,
  login,
  verifyCode,
  resendVerificationCode,
  setAuth,
} from "@/lib/frontend-auth";
import { useAuth } from "@/components/AuthProvider";

export default function SignUpRedirect() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-[var(--foreground)]">Yükleniyor...</p>
          </div>
        </div>
      }
    >
      <SignUpRedirectContent />
    </Suspense>
  );
}

function SignUpRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    // Use a timer to delay the redirect to avoid conflicts with next.config.js redirects
    const timer = setTimeout(() => {
      // Preserve any query parameters when redirecting
      if (redirect) {
        router.replace(`/register?redirect=${encodeURIComponent(redirect)}`);
      } else {
        router.replace("/register");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [router, redirect]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-[var(--foreground)]">Yönlendiriliyorsunuz...</p>
        <p className="text-[var(--muted-foreground)] mt-4">
          Otomatik yönlendirme olmadıysa,{" "}
          <button
            onClick={() => router.push("/register")}
            className="text-[var(--primary)] hover:underline"
          >
            buraya tıklayın
          </button>
          .
        </p>
      </div>
    </div>
  );
}
