'use client';

import { useEffect } from 'react';
import Script from 'next/script';

interface GoogleTagManagerProps {
  gtmId: string;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function GoogleTagManager({ gtmId }: GoogleTagManagerProps) {
  useEffect(() => {
    // Initialize dataLayer if it doesn't exist
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      
      // Initialize gtag function
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      
      // Set initial dataLayer
      window.gtag('js', new Date());
      window.gtag('config', gtmId.replace('GTM-', 'G-'), {
        page_title: document.title,
        page_location: window.location.href,
      });
    }
  }, [gtmId]);

  if (!gtmId || gtmId === 'GTM-XXXXXXX') {
    return null;
  }

  return (
    <>
      {/* Google Tag Manager */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `,
        }}
      />
      
      {/* Google Tag Manager (noscript) */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  );
}

// Hook for tracking custom events
export function useGoogleAnalytics() {
  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  };

  const trackPageView = (url: string, title?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.replace('GTM-', 'G-'), {
        page_path: url,
        page_title: title || document.title,
      });
    }
  };

  const trackCustomDimension = (dimensionIndex: number, value: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.replace('GTM-', 'G-'), {
        [`custom_dimension${dimensionIndex}`]: value,
      });
    }
  };

  return {
    trackEvent,
    trackPageView,
    trackCustomDimension,
  };
}

// Utility functions for common tracking scenarios
export const analytics = {
  // Track user registration
  trackRegistration: (method: string, userId?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'sign_up', {
        method: method,
        user_id: userId,
      });
    }
  },

  // Track user login
  trackLogin: (method: string, userId?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'login', {
        method: method,
        user_id: userId,
      });
    }
  },

  // Track product view
  trackProductView: (productId: string, productName: string, category?: string, price?: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_item', {
        currency: 'TRY',
        value: price,
        items: [{
          item_id: productId,
          item_name: productName,
          item_category: category,
          price: price,
        }],
      });
    }
  },

  // Track add to cart
  trackAddToCart: (productId: string, productName: string, price: number, quantity: number = 1) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: 'TRY',
        value: price * quantity,
        items: [{
          item_id: productId,
          item_name: productName,
          price: price,
          quantity: quantity,
        }],
      });
    }
  },

  // Track purchase
  trackPurchase: (transactionId: string, value: number, items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
    category?: string;
  }>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'purchase', {
        transaction_id: transactionId,
        value: value,
        currency: 'TRY',
        items: items,
      });
    }
  },

  // Track live stream view
  trackLiveStreamView: (streamId: string, streamTitle: string, duration?: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'video_start', {
        video_id: streamId,
        video_title: streamTitle,
        video_duration: duration,
      });
    }
  },

  // Track bid placement
  trackBidPlacement: (listingId: string, productName: string, bidAmount: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'custom_event', {
        event_category: 'Bidding',
        event_label: 'Bid Placed',
        custom_parameters: {
          listing_id: listingId,
          product_name: productName,
          bid_amount: bidAmount,
          currency: 'TRY',
        },
      });
    }
  },

  // Track search
  trackSearch: (searchTerm: string, resultsCount?: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'search', {
        search_term: searchTerm,
        search_results: resultsCount,
      });
    }
  },
};
