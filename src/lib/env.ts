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
  WS_URL: string;
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
  WS_URL: '/api/rtc/socket',
  NODE_ENV: 'development',
  TURN_SERVER_URL: 'turn:localhost:3478',
  TURN_USERNAME: 'bidpazar',
  TURN_PASSWORD: 'bidpazarpass',
  STUN_SERVER_URL: 'stun:localhost:3478'
};

// Production values as fallbacks
const productionDefaults: EnvironmentConfig = {
  APP_URL: 'https://bidpazar.com',
  API_URL: 'https://bidpazar.com/api',
  BACKEND_API_URL: 'https://bidpazar.com/api',
  SOCKET_URL: 'wss://bidpazar.com',
  WEBRTC_SERVER: 'https://bidpazar.com',
  WS_URL: '/api/rtc/socket',
  NODE_ENV: 'production',
  TURN_SERVER_URL: 'turn:45.147.46.183:3478',
  TURN_USERNAME: 'bidpazar',
  TURN_PASSWORD: 'bidpazarpass',
  STUN_SERVER_URL: 'stun:45.147.46.183:3478'
};

/**
 * Helper to get environment variable with priority
 * First looks for regular variable, then NEXT_PUBLIC_ prefixed, then falls back to default
 */
function getEnvVar(name: string, defaultValue: string, isProduction: boolean = false): string {
  return (
    process.env[name] || 
    process.env[`NEXT_PUBLIC_${name}`] || 
    (isProduction ? productionDefaults[name as keyof EnvironmentConfig] || defaultValue : defaultValue)
  );
}

/**
 * Get environment values with proper priority
 */
const getEnvironmentValues = (): EnvironmentConfig => {
  // Check if we're in the browser
  const isBrowser = typeof window !== 'undefined';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Server-side environment handling
  if (!isBrowser) {
    return {
      APP_URL: getEnvVar('APP_URL', defaults.APP_URL, isProduction),
      API_URL: getEnvVar('API_URL', defaults.API_URL, isProduction),
      BACKEND_API_URL: getEnvVar('BACKEND_API_URL', defaults.BACKEND_API_URL, isProduction),
      SOCKET_URL: getEnvVar('SOCKET_URL', defaults.SOCKET_URL, isProduction),
      WEBRTC_SERVER: getEnvVar('WEBRTC_SERVER', defaults.WEBRTC_SERVER, isProduction),
      WS_URL: getEnvVar('WS_URL', defaults.WS_URL, isProduction),
      NODE_ENV: process.env.NODE_ENV || defaults.NODE_ENV,
      TURN_SERVER_URL: getEnvVar('TURN_SERVER_URL', defaults.TURN_SERVER_URL || '', isProduction),
      TURN_USERNAME: getEnvVar('TURN_USERNAME', defaults.TURN_USERNAME || '', isProduction),
      TURN_PASSWORD: getEnvVar('TURN_PASSWORD', defaults.TURN_PASSWORD || '', isProduction),
      STUN_SERVER_URL: getEnvVar('STUN_SERVER_URL', defaults.STUN_SERVER_URL || '', isProduction)
    };
  }
  
  // Client-side production check
  const isProductionHostname = typeof window !== 'undefined' && 
    (window.location.hostname === 'bidpazar.com' || window.location.hostname === 'www.bidpazar.com');
  const clientIsProduction = isProductionHostname || isProduction;
  
  // Look for browser-injected environment variables first
  const browserEnv = typeof window !== 'undefined' && (window as any).__ENV__;
  
  if (browserEnv) {
    return {
      APP_URL: browserEnv.NEXT_PUBLIC_APP_URL || (clientIsProduction ? productionDefaults.APP_URL : defaults.APP_URL),
      API_URL: browserEnv.NEXT_PUBLIC_API_URL || (clientIsProduction ? productionDefaults.API_URL : defaults.API_URL),
      BACKEND_API_URL: browserEnv.NEXT_PUBLIC_API_URL || (clientIsProduction ? productionDefaults.BACKEND_API_URL : defaults.BACKEND_API_URL),
      SOCKET_URL: browserEnv.NEXT_PUBLIC_SOCKET_URL || (clientIsProduction ? productionDefaults.SOCKET_URL : defaults.SOCKET_URL),
      WEBRTC_SERVER: browserEnv.NEXT_PUBLIC_WEBRTC_SERVER || (clientIsProduction ? productionDefaults.WEBRTC_SERVER : defaults.WEBRTC_SERVER),
      WS_URL: browserEnv.NEXT_PUBLIC_WS_URL || (clientIsProduction ? productionDefaults.WS_URL : defaults.WS_URL),
      NODE_ENV: clientIsProduction ? 'production' : 'development',
      TURN_SERVER_URL: browserEnv.NEXT_PUBLIC_TURN_SERVER_URL || (clientIsProduction ? productionDefaults.TURN_SERVER_URL : defaults.TURN_SERVER_URL),
      TURN_USERNAME: browserEnv.NEXT_PUBLIC_TURN_USERNAME || (clientIsProduction ? productionDefaults.TURN_USERNAME : defaults.TURN_USERNAME),
      TURN_PASSWORD: browserEnv.NEXT_PUBLIC_TURN_PASSWORD || (clientIsProduction ? productionDefaults.TURN_PASSWORD : defaults.TURN_PASSWORD),
      STUN_SERVER_URL: browserEnv.NEXT_PUBLIC_STUN_SERVER_URL || (clientIsProduction ? productionDefaults.STUN_SERVER_URL : defaults.STUN_SERVER_URL)
    };
  }
  
  // Client-side fallback to process.env
  return {
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || (clientIsProduction ? productionDefaults.APP_URL : defaults.APP_URL),
    API_URL: process.env.NEXT_PUBLIC_API_URL || (clientIsProduction ? productionDefaults.API_URL : defaults.API_URL),
    BACKEND_API_URL: process.env.NEXT_PUBLIC_API_URL || (clientIsProduction ? productionDefaults.BACKEND_API_URL : defaults.BACKEND_API_URL),
    SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || (clientIsProduction ? productionDefaults.SOCKET_URL : defaults.SOCKET_URL),
    WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || (clientIsProduction ? productionDefaults.WEBRTC_SERVER : defaults.WEBRTC_SERVER),
    WS_URL: process.env.NEXT_PUBLIC_WS_URL || (clientIsProduction ? productionDefaults.WS_URL : defaults.WS_URL),
    NODE_ENV: clientIsProduction ? 'production' : 'development',
    TURN_SERVER_URL: process.env.NEXT_PUBLIC_TURN_SERVER_URL || (clientIsProduction ? productionDefaults.TURN_SERVER_URL : defaults.TURN_SERVER_URL),
    TURN_USERNAME: process.env.NEXT_PUBLIC_TURN_USERNAME || (clientIsProduction ? productionDefaults.TURN_USERNAME : defaults.TURN_USERNAME),
    TURN_PASSWORD: process.env.NEXT_PUBLIC_TURN_PASSWORD || (clientIsProduction ? productionDefaults.TURN_PASSWORD : defaults.TURN_PASSWORD),
    STUN_SERVER_URL: process.env.NEXT_PUBLIC_STUN_SERVER_URL || (clientIsProduction ? productionDefaults.STUN_SERVER_URL : defaults.STUN_SERVER_URL)
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
      WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER,
      WS_URL: process.env.NEXT_PUBLIC_WS_URL
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