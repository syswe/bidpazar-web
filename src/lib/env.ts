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

// Helper function to safely get environment variables
// Prefers non-prefixed, then NEXT_PUBLIC_ prefixed, then empty string
function getEnvVar(name: keyof EnvironmentConfig): string {
  return process.env[name] ?? process.env[`NEXT_PUBLIC_${name}`] ?? '';
}

// Helper for specifically getting NEXT_PUBLIC_ variables (for client build-time)
function getNextPublicEnvVar(name: keyof EnvironmentConfig): string {
  // Construct the potential NEXT_PUBLIC_ key name dynamically
  const nextPublicKey = `NEXT_PUBLIC_${name}` as keyof NodeJS.ProcessEnv;
  return process.env[nextPublicKey] ?? '';
}

/**
 * Get environment values based on the execution context (server/client)
 */
const getEnvironmentValues = (): EnvironmentConfig => {
  const isBrowser = typeof window !== 'undefined';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Server-side or build-time
  if (!isBrowser) {
    return {
      APP_URL: getEnvVar('APP_URL'),
      API_URL: getEnvVar('API_URL'),
      BACKEND_API_URL: getEnvVar('BACKEND_API_URL'), // Read server-side specific var
      SOCKET_URL: getEnvVar('SOCKET_URL'),
      WEBRTC_SERVER: getEnvVar('WEBRTC_SERVER'),
      WS_URL: getEnvVar('WS_URL'),
      NODE_ENV: nodeEnv,
      TURN_SERVER_URL: getEnvVar('TURN_SERVER_URL'),
      TURN_USERNAME: getEnvVar('TURN_USERNAME'),
      TURN_PASSWORD: getEnvVar('TURN_PASSWORD'),
      STUN_SERVER_URL: getEnvVar('STUN_SERVER_URL'),
    };
  }

  // --- Client-side --- 
  // Initially, we only have access to build-time NEXT_PUBLIC_ variables.
  // Runtime values will be fetched via API and potentially stored in context.
  // For now, this returns the build-time values.
  return {
    APP_URL: getNextPublicEnvVar('APP_URL'),
    API_URL: getNextPublicEnvVar('API_URL'),
    BACKEND_API_URL: getNextPublicEnvVar('API_URL'), // Client usually uses the same API URL
    SOCKET_URL: getNextPublicEnvVar('SOCKET_URL'),
    WEBRTC_SERVER: getNextPublicEnvVar('WEBRTC_SERVER'),
    WS_URL: getNextPublicEnvVar('WS_URL'),
    NODE_ENV: nodeEnv, // Note: process.env.NODE_ENV is available client-side
    TURN_SERVER_URL: getNextPublicEnvVar('TURN_SERVER_URL'),
    TURN_USERNAME: getNextPublicEnvVar('TURN_USERNAME'),
    TURN_PASSWORD: getNextPublicEnvVar('TURN_PASSWORD'),
    STUN_SERVER_URL: getNextPublicEnvVar('STUN_SERVER_URL'),
  };
};

// Create the environment store
const ENV_STORE = getEnvironmentValues();

// Log environment details (consider reducing logging in production)
const logEnvironment = () => {
  if (typeof window === 'undefined') {
    console.log('[env] Server/Build Environment Initialized:', ENV_STORE);
  } else {
    console.log('[env] Client Environment Initialized (Build-time values):', ENV_STORE);
    // Later, we can log the runtime values once fetched
  }
};

logEnvironment();

// Export environment for direct use
// IMPORTANT: Client-side users might need runtime values fetched via API/context
export const env = ENV_STORE;
export default env; 