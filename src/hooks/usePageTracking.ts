'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useGoogleAnalytics } from '../components/GoogleTagManager';

export function usePageTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { trackPageView } = useGoogleAnalytics();

  useEffect(() => {
    // Track page view when pathname or search params change
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    trackPageView(url);
  }, [pathname, searchParams, trackPageView]);

  return null;
}
