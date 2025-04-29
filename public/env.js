// This script provides access to container environment variables in the browser
window.__ENV__ = {
  NEXT_PUBLIC_API_URL: 'https://bidpazar.com/api',
  NEXT_PUBLIC_SOCKET_URL: 'wss://bidpazar.com/backend',
  NEXT_PUBLIC_APP_URL: 'https://bidpazar.com',
  NEXT_PUBLIC_WEBRTC_SERVER: 'https://bidpazar.com/backend',
  NEXT_BACKEND_API_URL: 'https://bidpazar.com/backend',
  NEXT_PUBLIC_BACKEND_API_URL: 'https://bidpazar.com/backend',
  NEXT_PUBLIC_TURN_SERVER_URL: 'turn:45.147.46.183:3478',
  NEXT_PUBLIC_TURN_USERNAME: 'bidpazar',
  NEXT_PUBLIC_TURN_PASSWORD: 'bidpazarpass',
  NEXT_PUBLIC_STUN_SERVER_URL: 'stun:45.147.46.183:3478'
};

console.log('[env.js] Container environment variables loaded');

// Only use fallback if environment variables are missing
if (!window.__ENV__.NEXT_PUBLIC_API_URL || window.__ENV__.NEXT_PUBLIC_API_URL === '') {
  console.warn('[env.js] Environment variables missing or empty, using fallbacks');
  
  // Check if we're in production by looking at the hostname
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com');
  
  window.__ENV__ = {
    NEXT_PUBLIC_API_URL: isProduction ? 'https://bidpazar.com/api' : 'http://localhost:3000/api',
    NEXT_PUBLIC_SOCKET_URL: isProduction ? 'wss://bidpazar.com/backend' : 'ws://localhost:5001',
    NEXT_PUBLIC_APP_URL: isProduction ? 'https://bidpazar.com' : 'http://localhost:3000',
    NEXT_PUBLIC_WEBRTC_SERVER: isProduction ? 'wss://bidpazar.com/backend' : 'ws://localhost:5001',
    NEXT_PUBLIC_BACKEND_API_URL: isProduction ? 'https://bidpazar.com/backend' : 'http://localhost:5001',
    NEXT_BACKEND_API_URL: isProduction ? 'https://bidpazar.com/backend' : 'http://localhost:5001',
    NEXT_PUBLIC_TURN_SERVER_URL: isProduction ? 'turn:45.147.46.183:3478' : 'turn:localhost:3478',
    NEXT_PUBLIC_TURN_USERNAME: 'bidpazar',
    NEXT_PUBLIC_TURN_PASSWORD: 'bidpazarpass',
    NEXT_PUBLIC_STUN_SERVER_URL: isProduction ? 'stun:45.147.46.183:3478' : 'stun:localhost:3478'
  };
  
  console.log('[env.js] Using fallback values:', window.__ENV__);
} else {
  console.log('[env.js] Using container environment variables:', window.__ENV__);
} 