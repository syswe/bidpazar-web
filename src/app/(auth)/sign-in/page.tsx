"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Loading component to show while suspense is loading
function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
      <div className="text-center">
        <p className="text-[var(--foreground)]">Yükleniyor...</p>
      </div>
    </div>
  );
}

// Component that uses searchParams
function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get any URL parameters
    const callbackUrl = searchParams.get("callbackUrl");
    const redirectParam = searchParams.get("redirect");

    // Build the target URL with the correct path
    let targetUrl = "/login";
    const params = new URLSearchParams();

    if (callbackUrl) {
      params.set("callbackUrl", callbackUrl);
    }

    if (redirectParam) {
      params.set("redirect", redirectParam);
    }

    const queryString = params.toString();
    if (queryString) {
      targetUrl += `?${queryString}`;
    }

    // Use timer to give the redirect from next.config.js a chance to work
    const timer = setTimeout(() => {
      router.replace(targetUrl);
    }, 500);

    return () => clearTimeout(timer);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
      <div className="text-center">
        <p className="text-[var(--foreground)]">Yönlendiriliyorsunuz...</p>
        <p className="text-[var(--muted-foreground)] mt-4">
          Otomatik yönlendirme olmadıysa,{" "}
          <button
            onClick={() => router.push("/login")}
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

// Main component with Suspense boundary
export default function SignInRedirect() {
  return (
    <Suspense fallback={<Loading />}>
      <SignInContent />
    </Suspense>
  );
}
