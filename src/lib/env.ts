/**
 * Simple environment variable manager for Next.js
 */
'use client';

import { useState, useEffect } from 'react';

// Environment configuration interface
export interface EnvironmentConfig {
  APP_URL: string;
  BACKEND_API_URL: string;
  API_URL: string;
  SOCKET_URL: string;
  WEBRTC_SERVER: string;
  NODE_ENV: string;
  TURN_SERVER_URL?: string;
  TURN_USERNAME?: string;
  TURN_PASSWORD?: string;
  STUN_SERVER_URL?: string;
}

// Window environment interface
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_BACKEND_API_URL?: string;
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_SOCKET_URL?: string;
      NEXT_PUBLIC_WEBRTC_SERVER?: string;
      NEXT_PUBLIC_TURN_SERVER_URL?: string;
      NEXT_PUBLIC_TURN_USERNAME?: string;
      NEXT_PUBLIC_TURN_PASSWORD?: string;
      NEXT_PUBLIC_STUN_SERVER_URL?: string;
    };
  }
}

// Default values (used as fallbacks)
const defaults: EnvironmentConfig = {
  APP_URL: 'http://localhost:3000',
  BACKEND_API_URL: 'http://localhost:5001',
  API_URL: 'http://localhost:3000/api',
  SOCKET_URL: 'ws://localhost:5001',
  WEBRTC_SERVER: 'http://localhost:5001',
  NODE_ENV: 'development',
  TURN_SERVER_URL: 'turn:localhost:3478',
  TURN_USERNAME: 'bidpazar',
  TURN_PASSWORD: 'bidpazarpass',
  STUN_SERVER_URL: 'stun:localhost:3478'
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
  const hasRuntimeEnv = isBrowser && window.__ENV__ && 
    typeof window.__ENV__.NEXT_PUBLIC_API_URL === 'string' && 
    window.__ENV__.NEXT_PUBLIC_API_URL.length > 0;
  
  if (isBrowser) {
    console.log(`[env] Browser environment detected, window.__ENV__ available: ${!!window.__ENV__}`);
    if (window.__ENV__) {
      console.log('[env] Window.__ENV__ values:', {
        NEXT_PUBLIC_APP_URL: window.__ENV__.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_BACKEND_API_URL: window.__ENV__.NEXT_PUBLIC_BACKEND_API_URL,
        NEXT_PUBLIC_API_URL: window.__ENV__.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_SOCKET_URL: window.__ENV__.NEXT_PUBLIC_SOCKET_URL,
        NEXT_PUBLIC_WEBRTC_SERVER: window.__ENV__.NEXT_PUBLIC_WEBRTC_SERVER
      });
    }
  }
  
  // Construct environment with proper priority
  let configValues = {
    APP_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_APP_URL) || process.env.NEXT_PUBLIC_APP_URL || defaults.APP_URL,
    BACKEND_API_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_BACKEND_API_URL) || process.env.NEXT_PUBLIC_BACKEND_API_URL || defaults.BACKEND_API_URL,
    API_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_API_URL) || process.env.NEXT_PUBLIC_API_URL || defaults.API_URL,
    SOCKET_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_SOCKET_URL) || process.env.NEXT_PUBLIC_SOCKET_URL || defaults.SOCKET_URL,
    WEBRTC_SERVER: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_WEBRTC_SERVER) || process.env.NEXT_PUBLIC_WEBRTC_SERVER || defaults.WEBRTC_SERVER,
    NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
    TURN_SERVER_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_TURN_SERVER_URL) || process.env.NEXT_PUBLIC_TURN_SERVER_URL || defaults.TURN_SERVER_URL,
    TURN_USERNAME: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_TURN_USERNAME) || process.env.NEXT_PUBLIC_TURN_USERNAME || defaults.TURN_USERNAME,
    TURN_PASSWORD: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_TURN_PASSWORD) || process.env.NEXT_PUBLIC_TURN_PASSWORD || defaults.TURN_PASSWORD,
    STUN_SERVER_URL: (hasRuntimeEnv && window.__ENV__?.NEXT_PUBLIC_STUN_SERVER_URL) || process.env.NEXT_PUBLIC_STUN_SERVER_URL || defaults.STUN_SERVER_URL
  };

  // In browser environment, ensure URLs use localhost instead of container names
  if (isBrowser) {
    // Replace Docker container hostnames with localhost for browser compatibility
    // This handles cases where Docker container names (like 'api', 'backend') are used but browsers can't resolve them
    configValues = {
      ...configValues,
      BACKEND_API_URL: configValues.BACKEND_API_URL.replace(/http:\/\/api:/, 'http://localhost:'),
      SOCKET_URL: configValues.SOCKET_URL.replace(/ws:\/\/api:/, 'ws://localhost:')
        .replace(/ws:\/\/backend:/, 'ws://localhost:'),
      WEBRTC_SERVER: configValues.WEBRTC_SERVER.replace(/http:\/\/api:/, 'http://localhost:')
        .replace(/http:\/\/backend:/, 'http://localhost:')
    };

    console.log('[env] Browser-friendly URLs after hostname substitution:', configValues);
  }
  
  return configValues;
};

// Check if hostname suggests production environment
const isProduction = () => {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com';
  }
  return process.env.NODE_ENV === 'production';
};

// Create initial environment store based on server/client context
const getInitialEnvStore = () => {
  // On server side, use process.env or defaults with production awareness
  if (typeof window === 'undefined') {
    // For server-side in production, we need to prefer production URLs
    if (process.env.NODE_ENV === 'production') {
      return {
        APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://bidpazar.com',
        BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://bidpazar.com/backend',
        API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://bidpazar.com/api',
        SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://bidpazar.com/backend',
        WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || 'https://bidpazar.com/backend',
        NODE_ENV: process.env.NODE_ENV || 'production',
        TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || 'turn:bidpazar.com:3478',
        TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || 'bidpazar',
        TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'bidpazarpass',
        STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:bidpazar.com:3478'
      };
    }
    
    // Development uses normal priority
    return {
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || defaults.APP_URL,
      BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL || defaults.BACKEND_API_URL,
      API_URL: process.env.NEXT_PUBLIC_API_URL || defaults.API_URL,
      SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || defaults.SOCKET_URL,
      WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || defaults.WEBRTC_SERVER,
      NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
      TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || defaults.TURN_SERVER_URL,
      TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || defaults.TURN_USERNAME,
      TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || defaults.TURN_PASSWORD,
      STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || defaults.STUN_SERVER_URL
    };
  }
  
  // On client side, use getEnvironmentValues
  return getEnvironmentValues();
};

// Create the environment store
const ENV_STORE = getInitialEnvStore();

// Safe logging that only runs in development or when forced
const logEnvironment = (force = false) => {
  if (process.env.NODE_ENV !== 'production' || force) {
    if (typeof window === 'undefined') {
      console.log('[env] Server-side environment being used:', ENV_STORE);
      console.log('[env] Process.env NEXT_PUBLIC values:', {
        APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL,
        API_URL: process.env.NEXT_PUBLIC_API_URL,
        SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
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