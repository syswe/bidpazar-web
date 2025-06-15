"use client";

import React, { ReactNode, useState, lazy, Suspense } from "react";
import { usePathname } from "next/navigation";
import LoadingSpinner from "./LoadingSpinner";

// Lazy load mobile components for better performance
const BottomNavigation = lazy(() => import("./BottomNavigation"));
const TopMobileBar = lazy(() => import("./TopMobileBar"));
const MobileSidebar = lazy(() => import("./MobileSidebar"));

interface MobileLayoutProps {
  children: ReactNode;
}

const MobileLayout = ({ children }: MobileLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Check if current page is a live stream page
  const isStreamPage = pathname?.includes('/live-streams/') && pathname !== '/live-streams';

  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  const LoadingFallback = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      height: '40px'
    }}>
      <LoadingSpinner size={16} />
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar - Hidden on stream pages */}
      {!isStreamPage && (
        <Suspense fallback={<LoadingFallback />}>
          <MobileSidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
        </Suspense>
      )}
      
      {/* Top mobile bar - Hidden on stream pages */}
      {!isStreamPage && (
        <Suspense fallback={<LoadingFallback />}>
          <TopMobileBar onMenuClick={handleMenuClick} />
        </Suspense>
      )}
      
      {/* Main content with mobile-aware padding */}
      <div className={`mobile-layout-content ${isStreamPage ? 'stream-page' : ''}`}>
        {children}
      </div>
      
      {/* Bottom navigation - Hidden on stream pages */}
      {!isStreamPage && (
        <Suspense fallback={<LoadingFallback />}>
          <BottomNavigation />
        </Suspense>
      )}

      <style jsx>{`
        .mobile-layout-content {
          width: 100%;
          min-height: 100vh;
        }

        /* Stream page specific styles - full screen */
        .mobile-layout-content.stream-page {
          padding: 0 !important;
          min-height: 100vh !important;
          height: 100vh !important;
          overflow: hidden !important;
        }

        /* Mobile layout adjustments */
        @media (max-width: 767px) {
          .mobile-layout-content {
            /* Add padding for bottom navigation */
            padding-bottom: 68px;
            /* No top padding needed since top bar is relative now */
            /* Ensure content fills remaining space */
            min-height: calc(100vh - 56px - 68px);
          }

          /* Stream page overrides mobile padding */
          .mobile-layout-content.stream-page {
            padding-bottom: 0 !important;
            min-height: 100vh !important;
          }
        }

        /* Tablet layout adjustments */
        @media (min-width: 768px) and (max-width: 1023px) {
          .mobile-layout-content {
            /* Add padding for bottom navigation */
            padding-bottom: 68px;
            /* Tablet gets slightly more padding for better UX */
            padding-left: 16px;
            padding-right: 16px;
            /* Account for larger top bar on tablet */
            min-height: calc(100vh - 64px - 68px);
          }

          /* Stream page overrides tablet padding */
          .mobile-layout-content.stream-page {
            padding: 0 !important;
            min-height: 100vh !important;
          }

          /* Safe area support for iOS */
          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .mobile-layout-content {
              padding-bottom: calc(68px + env(safe-area-inset-bottom));
              min-height: calc(100vh - 68px - env(safe-area-inset-bottom));
            }

            .mobile-layout-content.stream-page {
              padding-bottom: env(safe-area-inset-bottom) !important;
            }
          }
        }

        /* Large screens (Desktop) - no mobile components */
        @media (min-width: 1024px) {
          .mobile-layout-content {
            /* Reset mobile-specific styles */
            padding-bottom: 0;
            padding-left: 0;
            padding-right: 0;
            min-height: 100vh;
          }
        }
      `}</style>
    </>
  );
};

export default MobileLayout; 