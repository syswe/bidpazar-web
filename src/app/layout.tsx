import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import { AuthProvider } from "../components/AuthProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BidPazar",
  description: "Canlı Yayın Müzayede Platformu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <div className="flex h-full min-h-screen">
              <Sidebar />
              <main className="flex-1 overflow-y-auto w-full">
                {children}
              </main>
            </div>
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
