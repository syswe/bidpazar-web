// This script provides access to environment variables in browsers
// It now relies on Next.js's handling of .env files
window.__ENV__ = {
  // These values will now come from Next.js's process.env
  NEXT_PUBLIC_API_URL: '',
  NEXT_PUBLIC_SOCKET_URL: '',
  NEXT_PUBLIC_APP_URL: '',
  NEXT_PUBLIC_WEBRTC_SERVER: ''
};

console.log('[env.js] Environment configuration initialized');

// Check if we're in production by looking at the hostname
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com');

// Let Next.js handle environment variables directly through .env files
// This env.js now just provides a fallback mechanism if needed
if (!window.__ENV__.NEXT_PUBLIC_API_URL) {
  console.warn('[env.js] Using fallback environment values');
  
  window.__ENV__ = {
    NEXT_PUBLIC_API_URL: isProduction ? 'https://bidpazar.com/api' : 'http://localhost:5001/api',
    NEXT_PUBLIC_SOCKET_URL: isProduction ? 'wss://bidpazar.com/api' : 'ws://localhost:5001/rtc/v1',
    NEXT_PUBLIC_APP_URL: isProduction ? 'https://bidpazar.com' : 'http://localhost:3000',
    NEXT_PUBLIC_WEBRTC_SERVER: isProduction ? 'wss://bidpazar.com/api' : 'ws://localhost:5001/rtc/v1'
  };
  
  console.log('[env.js] Fallback environment values:', window.__ENV__);
} 