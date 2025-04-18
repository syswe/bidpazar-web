// This script injects environment variables at runtime
// It's loaded before any other JavaScript in the application
window.__ENV__ = {
  // These values will be replaced at container startup by the Docker CMD script
  NEXT_PUBLIC_API_URL: '${NEXT_PUBLIC_API_URL}',
  NEXT_PUBLIC_SOCKET_URL: '${NEXT_PUBLIC_SOCKET_URL}',
  NEXT_PUBLIC_APP_URL: '${NEXT_PUBLIC_APP_URL}',
  NEXT_PUBLIC_WEBRTC_SERVER: '${NEXT_PUBLIC_WEBRTC_SERVER}'
};

console.log('[env.js] Runtime environment loaded:', window.__ENV__);

// Fix for environment variables if they still have placeholder format
if (window.__ENV__.NEXT_PUBLIC_API_URL.includes('${')) {
  console.warn('[env.js] Environment variables not properly substituted, falling back to defaults');
  
  // Check if we're in production by looking at the hostname
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com');
  
  window.__ENV__ = {
    NEXT_PUBLIC_API_URL: isProduction ? 'http://api.bidpazar.com/api' : 'http://api:5001/api',
    NEXT_PUBLIC_SOCKET_URL: isProduction ? 'wss://api.bidpazar.com/rtc/v1' : 'ws://api:5001/rtc/v1',
    NEXT_PUBLIC_APP_URL: isProduction ? 'https://bidpazar.com' : 'http://web:3000',
    NEXT_PUBLIC_WEBRTC_SERVER: isProduction ? 'wss://api.bidpazar.com/rtc/v1' : 'ws://api:5001/rtc/v1'
  };
  
  console.log('[env.js] Fixed environment variables:', window.__ENV__);
} 