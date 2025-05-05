#!/bin/sh
set -e

# Set default values for variables if they're not set
if [ -z "$NEXT_PUBLIC_TURN_SERVER_URL" ]; then
  export NEXT_PUBLIC_TURN_SERVER_URL="turn:45.147.46.183:3478"
fi

if [ -z "$NEXT_PUBLIC_TURN_USERNAME" ]; then
  export NEXT_PUBLIC_TURN_USERNAME="bidpazar"
fi

if [ -z "$NEXT_PUBLIC_TURN_PASSWORD" ]; then
  export NEXT_PUBLIC_TURN_PASSWORD="bidpazarpass"
fi

if [ -z "$NEXT_PUBLIC_STUN_SERVER_URL" ]; then
  export NEXT_PUBLIC_STUN_SERVER_URL="stun:45.147.46.183:3478"
fi

if [ -z "$NEXT_PUBLIC_WS_URL" ]; then
  export NEXT_PUBLIC_WS_URL="/rtc/v1"
fi

# Log environment
echo "Starting with container environment variables"

# Create env.js with container environment variables
cat > ./public/env.js << EOF
// This script provides access to container environment variables in the browser
window.__ENV__ = {
  NEXT_PUBLIC_API_URL: "$NEXT_PUBLIC_API_URL",
  NEXT_PUBLIC_SOCKET_URL: "$NEXT_PUBLIC_SOCKET_URL",
  NEXT_PUBLIC_APP_URL: "$NEXT_PUBLIC_APP_URL", 
  NEXT_PUBLIC_WEBRTC_SERVER: "$NEXT_PUBLIC_WEBRTC_SERVER",
  NEXT_PUBLIC_TURN_SERVER_URL: "$NEXT_PUBLIC_TURN_SERVER_URL",
  NEXT_PUBLIC_TURN_USERNAME: "$NEXT_PUBLIC_TURN_USERNAME",
  NEXT_PUBLIC_TURN_PASSWORD: "$NEXT_PUBLIC_TURN_PASSWORD",
  NEXT_PUBLIC_STUN_SERVER_URL: "$NEXT_PUBLIC_STUN_SERVER_URL",
  NEXT_PUBLIC_WS_URL: "$NEXT_PUBLIC_WS_URL"
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
    NEXT_PUBLIC_SOCKET_URL: isProduction ? '/rtc/v1' : '/rtc/v1',
    NEXT_PUBLIC_APP_URL: isProduction ? 'https://bidpazar.com' : 'http://localhost:3000',
    NEXT_PUBLIC_WEBRTC_SERVER: isProduction ? '/rtc/v1' : '/rtc/v1',
    NEXT_PUBLIC_TURN_SERVER_URL: isProduction ? 'turn:45.147.46.183:3478' : 'turn:localhost:3478',
    NEXT_PUBLIC_TURN_USERNAME: 'bidpazar',
    NEXT_PUBLIC_TURN_PASSWORD: 'bidpazarpass',
    NEXT_PUBLIC_STUN_SERVER_URL: isProduction ? 'stun:45.147.46.183:3478' : 'stun:localhost:3478',
    NEXT_PUBLIC_WS_URL: isProduction ? '/rtc/v1' : '/rtc/v1'
  };
  
  console.log('[env.js] Using fallback values:', window.__ENV__);
}

// Add fallback for WS_URL if necessary (adjust fallback value as needed)
if (typeof window !== 'undefined' && window.__ENV__ && !window.__ENV__.NEXT_PUBLIC_WS_URL) {
  const isProduction = window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com';
  window.__ENV__.NEXT_PUBLIC_WS_URL = isProduction ? '/rtc/v1' : '/rtc/v1';
  console.log('[env.js] Added fallback NEXT_PUBLIC_WS_URL:', window.__ENV__.NEXT_PUBLIC_WS_URL);
}
EOF

# Display the generated file for debugging
echo "Generated env.js:"
cat ./public/env.js

# Create a temporary .env file to ensure server-side environment variables
cat > ./.env << EOF
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_WEBRTC_SERVER=$NEXT_PUBLIC_WEBRTC_SERVER
NEXT_PUBLIC_TURN_SERVER_URL=$NEXT_PUBLIC_TURN_SERVER_URL
NEXT_PUBLIC_TURN_USERNAME=$NEXT_PUBLIC_TURN_USERNAME
NEXT_PUBLIC_TURN_PASSWORD=$NEXT_PUBLIC_TURN_PASSWORD
NEXT_PUBLIC_STUN_SERVER_URL=$NEXT_PUBLIC_STUN_SERVER_URL
NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
EOF

# Check if server.js exists
if [ -f "./server.js" ]; then
  # Start Next.js with environment variables explicitly passed
  exec env \
    NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
    NEXT_PUBLIC_SOCKET_URL="$NEXT_PUBLIC_SOCKET_URL" \
    NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
    NEXT_PUBLIC_WEBRTC_SERVER="$NEXT_PUBLIC_WEBRTC_SERVER" \
    NEXT_PUBLIC_TURN_SERVER_URL="$NEXT_PUBLIC_TURN_SERVER_URL" \
    NEXT_PUBLIC_TURN_USERNAME="$NEXT_PUBLIC_TURN_USERNAME" \
    NEXT_PUBLIC_TURN_PASSWORD="$NEXT_PUBLIC_TURN_PASSWORD" \
    NEXT_PUBLIC_STUN_SERVER_URL="$NEXT_PUBLIC_STUN_SERVER_URL" \
    NEXT_PUBLIC_WS_URL="$NEXT_PUBLIC_WS_URL" \
    node server.js
else
  echo "ERROR: server.js not found. Check the Next.js build configuration."
  echo "Files in current directory:"
  ls -la
  echo "Files in .next directory (if it exists):"
  if [ -d ".next" ]; then
    ls -la .next
  fi
  exit 1
fi 