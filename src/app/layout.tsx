import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileLayout from "../components/MobileLayout";
import { AuthProvider } from "../components/AuthProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "sonner";
import { GoogleTagManager } from "../components/GoogleTagManager";
import { PageTrackingWrapper } from "@/components/PageTrackingWrapper";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    template: '%s | BidPazar',
    default: 'BidPazar - Canlı Yayın Müzayede Platformu',
  },
  description: "Benzersiz ürünleri keşfedin, teklif verin ve canlı müzayedelere katılın. BidPazar, Türkiye'nin en yenilikçi canlı yayın müzayede platformu.",
  keywords: ["müzayede", "açık artırma", "antika", "koleksiyon", "canlı yayın", "online müzayede"],
  authors: [{ name: "BidPazar" }],
  creator: "BidPazar",
  publisher: "BidPazar",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID;

  return (
    <html lang="tr" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* Google Tag Manager */}
        {gtmId && <GoogleTagManager gtmId={gtmId} />}

        <ThemeProvider>
          <AuthProvider>
            {/* Page Tracking Hook */}
            <Suspense fallback={null}>
              <PageTrackingWrapper />
            </Suspense>

            <div className="flex h-full min-h-screen bg-[var(--background)]">
              <Sidebar />
              <main className="flex-1 overflow-y-auto w-full">
                <MobileLayout>
                  {children}
                </MobileLayout>
              </main>
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
