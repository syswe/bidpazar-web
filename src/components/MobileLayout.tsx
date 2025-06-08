"use client";

import React, { ReactNode, useState, lazy, Suspense } from "react";
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
      {/* Mobile Sidebar */}
      <Suspense fallback={<LoadingFallback />}>
        <MobileSidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
      </Suspense>
      
      {/* Top mobile bar */}
      <Suspense fallback={<LoadingFallback />}>
        <TopMobileBar onMenuClick={handleMenuClick} />
      </Suspense>
      
      {/* Main content with mobile-aware padding */}
      <div className="mobile-layout-content">
        {children}
      </div>
      
      {/* Bottom navigation */}
      <Suspense fallback={<LoadingFallback />}>
        <BottomNavigation />
      </Suspense>

      <style jsx>{`
        .mobile-layout-content {
          width: 100%;
          min-height: 100vh;
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

          /* Safe area support for iOS */
          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .mobile-layout-content {
              padding-bottom: calc(68px + env(safe-area-inset-bottom));
              min-height: calc(100vh - 68px - env(safe-area-inset-bottom));
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