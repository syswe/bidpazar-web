/**
 * Centralized WebRTC configuration
 * This ensures consistent settings across client and server components
 */

// Dynamic configuration based on environment
const isDev = process.env.NODE_ENV === 'development';
const serverHostname = isDev ? 'localhost' : process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'bidpazar.com';
const serverPort = isDev ? '3000' : '';

// WebRTC server configuration
export const webrtcConfig = {
  // Socket.IO connection settings
  socketIo: {
    url: isDev ? `http://${serverHostname}${serverPort ? `:${serverPort}` : ''}` : 
             `https://${serverHostname}`,
    path: '/api/rtc/socket',
    // Connection parameters
    options: {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    }
  },
  
  // STUN/TURN server settings
  iceServers: [
    {
      urls: `stun:${serverHostname}:3478`
    },
    {
      urls: `turn:${serverHostname}:3478`,
      username: 'bidpazar',
      credential: 'bidpazarpass'
    }
  ],
  
  // MediaSoup configuration
  mediasoup: {
    // Add MediaSoup-specific configuration here
  }
};

// Helper function to get ICE servers in browser environment
export const getIceServers = () => {
  if (typeof window === 'undefined') {
    return webrtcConfig.iceServers;
  }
  
  // In browser, override with current hostname if in development
  const currentHost = window.location.hostname;
  const iceServers = [...webrtcConfig.iceServers];
  
  if (isDev) {
    iceServers[0].urls = `stun:${currentHost}:3478`;
    if (typeof iceServers[1] === 'object') {
      iceServers[1].urls = `turn:${currentHost}:3478`;
    }
  }
  
  return iceServers;
};

// Helper function to get Socket.IO connection URL
export const getSocketUrl = () => {
  if (typeof window === 'undefined') {
    return webrtcConfig.socketIo.url;
  }
  
  // In browser, use current origin in development
  if (isDev) {
    return window.location.origin;
  }
  
  return webrtcConfig.socketIo.url;
};

// Export default configuration
export default webrtcConfig; 