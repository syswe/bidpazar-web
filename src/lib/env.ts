/**
 * Simple environment variable manager for Next.js
 */
'use client';

import { useState, useEffect } from 'react';

// Environment configuration interface
interface EnvironmentConfig {
  API_URL: string;
  SOCKET_URL: string;
  APP_URL: string;
  WEBRTC_SERVER: string;
}

// Window environment interface
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_SOCKET_URL?: string;
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_WEBRTC_SERVER?: string;
    };
  }
}

// Default values (used as fallbacks)
const defaults: EnvironmentConfig = {
  API_URL: 'http://localhost:5001/api',
  SOCKET_URL: 'ws://localhost:5001/rtc/v1',
  APP_URL: 'http://localhost:3000',
  WEBRTC_SERVER: 'ws://localhost:5001/rtc/v1'
};

/**
 * Get environment values from runtime sources with proper priority:
 * 1. Window.__ENV__ (runtime injection from Docker/container)
 * 2. Process.env (from Next.js)
 * 3. Default fallback values
 */
const getEnvironmentValues = (): EnvironmentConfig => {
  // Check if we're in the browser
  const isBrowser = typeof window !== 'undefined';
  
  // Check if window.__ENV__ has been injected
  const hasRuntimeEnv = isBrowser && window.__ENV__ && !!window.__ENV__.NEXT_PUBLIC_API_URL;
  
  if (isBrowser) {
    console.log(`[env] Browser environment detected, window.__ENV__ available: ${!!window.__ENV__}`);
    if (window.__ENV__) {
      console.log('[env] Window.__ENV__ values:', {
        NEXT_PUBLIC_API_URL: window.__ENV__.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_SOCKET_URL: window.__ENV__.NEXT_PUBLIC_SOCKET_URL,
        NEXT_PUBLIC_APP_URL: window.__ENV__.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_WEBRTC_SERVER: window.__ENV__.NEXT_PUBLIC_WEBRTC_SERVER
      });
    }
  }
  
  // Construct environment with proper priority
  return {
    API_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_API_URL) || process.env.NEXT_PUBLIC_API_URL || defaults.API_URL,
    SOCKET_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_SOCKET_URL) || process.env.NEXT_PUBLIC_SOCKET_URL || defaults.SOCKET_URL,
    APP_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_APP_URL) || process.env.NEXT_PUBLIC_APP_URL || defaults.APP_URL,
    WEBRTC_SERVER: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_WEBRTC_SERVER) || process.env.NEXT_PUBLIC_WEBRTC_SERVER || defaults.WEBRTC_SERVER
  };
};

// Create the environment store
const ENV_STORE = getEnvironmentValues();

// Safe logging that only runs in development or when forced
const logEnvironment = (force = false) => {
  if (process.env.NODE_ENV !== 'production' || force) {
    if (typeof window === 'undefined') {
      console.log('[env] Server-side environment being used:', ENV_STORE);
      console.log('[env] Process.env NEXT_PUBLIC values:', {
        API_URL: process.env.NEXT_PUBLIC_API_URL,
        SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
        APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER
      });
    } else {
      console.log('[env] Client-side environment config:', ENV_STORE);
      console.log('[env] Window.__ENV__:', window.__ENV__);
    }
  }
};

// Always log in production to debug issues
logEnvironment(true);

// Export environment for direct use
export const env = ENV_STORE;

// React hook for accessing environment in components
export function useEnv() {
  const [config, setConfig] = useState(ENV_STORE);
  
  useEffect(() => {
    // Update config when window.__ENV__ changes
    const updateConfig = () => {
      const newConfig = getEnvironmentValues();
      setConfig(newConfig);
    };

    // Initial update
    updateConfig();

    // Setup an interval to check for changes (useful for development)
    if (process.env.NODE_ENV !== 'production') {
      const interval = setInterval(updateConfig, 1000);
      return () => clearInterval(interval);
    }
  }, []);
  
  return config;
}

export default env; 