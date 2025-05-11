import { logInfo } from './logging';

/**
 * Get ICE servers configuration based on runtime config and connection type
 */
export const getIceServers = (config: any | null, isLoopback: boolean = false): RTCIceServer[] => {
  // For loopback connections, simplify ICE configuration
  if (isLoopback) {
    logInfo("Using simplified ICE configuration for loopback connection");
    return [
      { urls: "stun:stun.l.google.com:19302" }
    ];
  }

  // Default fallback ICE servers
  const defaultIceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];

  // If no config is provided, return fallback servers
  if (!config) {
    return defaultIceServers;
  }

  // Extract ICE servers from config
  const iceServers: RTCIceServer[] = [];

  // Add STUN server if configured
  if (config.stunServerUrl) {
    iceServers.push({ urls: config.stunServerUrl });
  }

  // Add TURN server if configured
  if (config.turnServerUrl && config.turnUsername && config.turnPassword) {
    iceServers.push({
      urls: config.turnServerUrl,
      username: config.turnUsername,
      credential: config.turnPassword,
    });
  }

  // If no ICE servers were configured, use fallback
  if (iceServers.length === 0) {
    return defaultIceServers;
  }

  return iceServers;
};

/**
 * Get optimized ICE servers for the current connection type
 */
export const getOptimizedIceServers = (
  runtimeConfig: any, 
  isConfigLoading: boolean,
  isLoopback: boolean
): RTCIceServer[] => {
  // If it's a loopback connection, use minimal configuration
  if (isLoopback) {
    logInfo("Using optimized ICE configuration for loopback connection");
    return [
      // For localhost testing, sometimes a minimal config works better
      { urls: 'stun:stun.l.google.com:19302' }
    ];
  }

  // Otherwise, fetch standard ICE servers from the existing helper function
  if (!isConfigLoading && runtimeConfig) {
    return getIceServers(runtimeConfig);
  }
  
  // Fallback to basic STUN server if no config available
  return [{ urls: 'stun:stun.l.google.com:19302' }];
};

/**
 * Get optimized RTCPeerConnection configuration
 */
export const getOptimizedPeerConfiguration = (
  runtimeConfig: any,
  isConfigLoading: boolean,
  isLoopback: boolean
): RTCConfiguration => {
  const base: RTCConfiguration = {
    iceServers: getOptimizedIceServers(runtimeConfig, isConfigLoading, isLoopback),
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  // Special settings for loopback connections
  if (isLoopback) {
    return {
      ...base,
      // These settings can help with localhost connections
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
    };
  }

  return base;
};

/**
 * Check if an address is a loopback address
 */
export const isLoopbackAddress = (address?: string): boolean => {
  if (!address) return false;

  // Remove IPv6 brackets if present
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.substring(1, address.length - 1);
  }

  return (
    address === "localhost" ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "0.0.0.0" ||
    address === "::" ||
    // Also check for full IPv6 localhost
    address === "0:0:0:0:0:0:0:1"
  );
};

/**
 * Check if a URL is a loopback URL
 */
export const isLoopbackUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return isLoopbackAddress(parsedUrl.hostname);
  } catch (e) {
    return false; // Invalid URL
  }
}; 