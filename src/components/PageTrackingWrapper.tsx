'use client';

import { usePageTracking } from '../hooks/usePageTracking';

export function PageTrackingWrapper() {
  usePageTracking();
  return null;
}
