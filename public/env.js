// This script provides access to container environment variables in the browser
window.__ENV__ = {
  NEXT_PUBLIC_API_URL: '',
  NEXT_PUBLIC_SOCKET_URL: '',
  NEXT_PUBLIC_APP_URL: '',
  NEXT_PUBLIC_WEBRTC_SERVER: ''
};

console.log('[env.js] Container environment variables loaded');

// Only use fallback if environment variables are missing
if (!window.__ENV__.NEXT_PUBLIC_API_URL) {
  console.warn('[env.js] Environment variables missing, using fallbacks');
  
  // Check if we're in production by looking at the hostname
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com');
  
  window.__ENV__ = {
    NEXT_PUBLIC_API_URL: isProduction ? 'https://bidpazar.com/api' : 'http://localhost:5001/api',
    NEXT_PUBLIC_SOCKET_URL: isProduction ? 'wss://bidpazar.com/api' : 'ws://localhost:5001/rtc/v1',
    NEXT_PUBLIC_APP_URL: isProduction ? 'https://bidpazar.com' : 'http://localhost:3000',
    NEXT_PUBLIC_WEBRTC_SERVER: isProduction ? 'wss://bidpazar.com/api' : 'ws://localhost:5001/rtc/v1'
  };
  
  console.log('[env.js] Using fallback values:', window.__ENV__);
} 