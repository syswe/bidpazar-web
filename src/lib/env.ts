/**
 * Environment variable manager for Next.js
 */

// Environment configuration interface
export interface EnvironmentConfig {
  APP_URL: string;
  API_URL: string;
  BACKEND_API_URL: string;
  SOCKET_URL: string;
  WEBRTC_SERVER: string;
  NODE_ENV: string;
  TURN_SERVER_URL?: string;
  TURN_USERNAME?: string;
  TURN_PASSWORD?: string;
  STUN_SERVER_URL?: string;
}

// Default values for local development
const defaults: EnvironmentConfig = {
  APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3000/api',
  BACKEND_API_URL: 'http://localhost:3000/api',
  SOCKET_URL: 'ws://localhost:3000',
  WEBRTC_SERVER: 'http://localhost:3000',
  NODE_ENV: 'development',
  TURN_SERVER_URL: 'turn:localhost:3478',
  TURN_USERNAME: 'bidpazar',
  TURN_PASSWORD: 'bidpazarpass',
  STUN_SERVER_URL: 'stun:localhost:3478'
};

/**
 * Get environment values with proper priority
 */
const getEnvironmentValues = (): EnvironmentConfig => {
  // Check if we're in the browser
  const isBrowser = typeof window !== 'undefined';
  
  // Server-side in production
  if (!isBrowser && process.env.NODE_ENV === 'production') {
    return {
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://bidpazar.com',
      API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://bidpazar.com/api',
      BACKEND_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://bidpazar.com/api',
      SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://bidpazar.com',
      WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || 'https://bidpazar.com',
      NODE_ENV: 'production',
      TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || 'turn:45.147.46.183:3478',
      TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || 'bidpazar',
      TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'bidpazarpass',
      STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:45.147.46.183:3478'
    };
  }
  
  // Server-side in development
  if (!isBrowser) {
    return {
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || defaults.APP_URL,
      API_URL: process.env.NEXT_PUBLIC_API_URL || defaults.API_URL,
      BACKEND_API_URL: process.env.NEXT_PUBLIC_API_URL || defaults.BACKEND_API_URL,
      SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || defaults.SOCKET_URL,
      WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || defaults.WEBRTC_SERVER,
      NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
      TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || defaults.TURN_SERVER_URL,
      TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || defaults.TURN_USERNAME,
      TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || defaults.TURN_PASSWORD,
      STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || defaults.STUN_SERVER_URL
    };
  }
  
  // Client-side production check
  const isProductionHostname = window.location.hostname === 'bidpazar.com' || 
    window.location.hostname === 'www.bidpazar.com';
  
  // Client-side in production
  if (isProductionHostname || process.env.NODE_ENV === 'production') {
    return {
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://bidpazar.com',
      API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://bidpazar.com/api',
      BACKEND_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://bidpazar.com/api',
      SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://bidpazar.com',
      WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || 'https://bidpazar.com',
      NODE_ENV: 'production',
      TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || 'turn:45.147.46.183:3478',
      TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || 'bidpazar',
      TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'bidpazarpass',
      STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:45.147.46.183:3478'
    };
  }
  
  // Client-side in development
  return {
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || defaults.APP_URL,
    API_URL: process.env.NEXT_PUBLIC_API_URL || defaults.API_URL,
    BACKEND_API_URL: process.env.NEXT_PUBLIC_API_URL || defaults.BACKEND_API_URL,
    SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || defaults.SOCKET_URL,
    WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || defaults.WEBRTC_SERVER,
    NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
    TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || defaults.TURN_SERVER_URL,
    TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || defaults.TURN_USERNAME,
    TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || defaults.TURN_PASSWORD,
    STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || defaults.STUN_SERVER_URL
  };
};

// Create the environment store
const ENV_STORE = getEnvironmentValues();

// Log environment in both development and production
const logEnvironment = () => {
  if (typeof window === 'undefined') {
    console.log('[env] Server-side environment being used:', ENV_STORE);
    console.log('[env] Process.env NEXT_PUBLIC values:', {
      APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      API_URL: process.env.NEXT_PUBLIC_API_URL,
      SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
      WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER
    });
  } else {
    console.log('[env] Client-side environment config:', ENV_STORE);
  }
};

// Always log environment
logEnvironment();

// Export environment for direct use
export const env = ENV_STORE;
export default env; 