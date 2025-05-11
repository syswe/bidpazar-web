import { ConnectionInfo, SessionData } from '../types';

/**
 * Generate a unique session ID
 */
export const generateSessionId = (): string => {
  // Generate a more unique session ID with additional entropy
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const browserFingerprint = `${navigator.userAgent.length}${window.screen.width}${window.screen.height}`;
  return `${timestamp}-${randomPart}-${browserFingerprint}`;
};

/**
 * Store connection info in localStorage
 */
export const storeConnectionInfo = (
  streamId: string,
  userId: string,
  info: ConnectionInfo
): boolean => {
  try {
    localStorage.setItem(
      `webrtc-connection-${streamId}-${userId}`,
      JSON.stringify(info)
    );
    return true;
  } catch (e) {
    // Handle localStorage errors (e.g., private browsing)
    return false;
  }
};

/**
 * Get stored connection info from localStorage
 */
export const getStoredConnectionInfo = (streamId: string, userId: string): ConnectionInfo | null => {
  try {
    const storedData = localStorage.getItem(
      `webrtc-connection-${streamId}-${userId}`
    );
    if (storedData) {
      return JSON.parse(storedData) as ConnectionInfo;
    }
  } catch (e) {
    // Handle parsing errors
  }
  return null;
};

/**
 * Clear stored connection info from localStorage
 */
export const clearConnectionInfo = (streamId: string, userId: string): boolean => {
  try {
    localStorage.removeItem(`webrtc-connection-${streamId}-${userId}`);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Store session info for recovery
 */
export const storeSessionInfo = (streamId: string, userId: string, data: SessionData): boolean => {
  try {
    localStorage.setItem(
      `webrtc-session-${streamId}-${userId}`,
      JSON.stringify(data)
    );
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get stored session info from localStorage
 */
export const getSessionInfo = (streamId: string, userId: string): SessionData | null => {
  try {
    const storedData = localStorage.getItem(
      `webrtc-session-${streamId}-${userId}`
    );
    if (storedData) {
      return JSON.parse(storedData) as SessionData;
    }
  } catch (e) {
    // Handle parsing errors
  }
  return null;
};

/**
 * Clear stored session info from localStorage
 */
export const clearSessionInfo = (streamId: string, userId: string): boolean => {
  try {
    localStorage.removeItem(`webrtc-session-${streamId}-${userId}`);
    return true;
  } catch (e) {
    return false;
  }
}; 