#!/bin/sh
set -e

# Set default values for variables if they're not set
if [ -z "$TURN_SERVER_URL" ]; then
  export TURN_SERVER_URL="turn:45.147.46.183:3478"
fi

if [ -z "$TURN_USERNAME" ]; then
  export TURN_USERNAME="bidpazar"
fi

if [ -z "$TURN_PASSWORD" ]; then
  export TURN_PASSWORD="bidpazarpass"
fi

if [ -z "$STUN_SERVER_URL" ]; then
  export STUN_SERVER_URL="stun:45.147.46.183:3478"
fi

if [ -z "$WS_URL" ]; then
  export WS_URL="/api/rtc/socket"
fi

# Make NEXT_PUBLIC versions of each variable (for client-side)
export NEXT_PUBLIC_TURN_SERVER_URL="${TURN_SERVER_URL}"
export NEXT_PUBLIC_TURN_USERNAME="${TURN_USERNAME}"
export NEXT_PUBLIC_TURN_PASSWORD="${TURN_PASSWORD}"
export NEXT_PUBLIC_STUN_SERVER_URL="${STUN_SERVER_URL}"
export NEXT_PUBLIC_WS_URL="${WS_URL}"

# Set defaults for production environment
if [ "$NODE_ENV" = "production" ]; then
  # Override any localhost values with production values
  export APP_URL="${APP_URL:-https://bidpazar.com}"
  export API_URL="${API_URL:-https://bidpazar.com/api}"
  export SOCKET_URL="${SOCKET_URL:-wss://bidpazar.com}"
  export WEBRTC_SERVER="${WEBRTC_SERVER:-https://bidpazar.com}"
  export BACKEND_API_URL="${BACKEND_API_URL:-https://bidpazar.com/api}"
  
  # Make NEXT_PUBLIC versions of each variable (for client-side)
  export NEXT_PUBLIC_APP_URL="${APP_URL}"
  export NEXT_PUBLIC_API_URL="${API_URL}"
  export NEXT_PUBLIC_SOCKET_URL="${SOCKET_URL}"
  export NEXT_PUBLIC_WEBRTC_SERVER="${WEBRTC_SERVER}"
  
  # Print all production environment variables
  echo "Production environment variables:"
  echo "APP_URL=$APP_URL"
  echo "API_URL=$API_URL" 
  echo "SOCKET_URL=$SOCKET_URL"
  echo "WEBRTC_SERVER=$WEBRTC_SERVER"
  echo "WS_URL=$WS_URL"
  echo "TURN_SERVER_URL=$TURN_SERVER_URL"
  echo "STUN_SERVER_URL=$STUN_SERVER_URL"
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
    NEXT_PUBLIC_SOCKET_URL: isProduction ? 'wss://bidpazar.com' : 'ws://localhost:3000',
    NEXT_PUBLIC_APP_URL: isProduction ? 'https://bidpazar.com' : 'http://localhost:3000',
    NEXT_PUBLIC_WEBRTC_SERVER: isProduction ? 'https://bidpazar.com' : 'http://localhost:3000',
    NEXT_PUBLIC_TURN_SERVER_URL: isProduction ? 'turn:45.147.46.183:3478' : 'turn:localhost:3478',
    NEXT_PUBLIC_TURN_USERNAME: 'bidpazar',
    NEXT_PUBLIC_TURN_PASSWORD: 'bidpazarpass',
    NEXT_PUBLIC_STUN_SERVER_URL: isProduction ? 'stun:45.147.46.183:3478' : 'stun:localhost:3478',
    NEXT_PUBLIC_WS_URL: isProduction ? '/api/rtc/socket' : '/api/rtc/socket'
  };
  
  console.log('[env.js] Using fallback values:', window.__ENV__);
}

// Add fallback for WS_URL if necessary (adjust fallback value as needed)
if (typeof window !== 'undefined' && window.__ENV__ && !window.__ENV__.NEXT_PUBLIC_WS_URL) {
  const isProduction = window.location.hostname === 'bidpazar.com' || window.location.hostname === 'api.bidpazar.com';
  window.__ENV__.NEXT_PUBLIC_WS_URL = isProduction ? '/api/rtc/socket' : '/api/rtc/socket';
  console.log('[env.js] Added fallback NEXT_PUBLIC_WS_URL:', window.__ENV__.NEXT_PUBLIC_WS_URL);
}
EOF

# Display the generated file for debugging
echo "Generated env.js:"
cat ./public/env.js

# Create a temporary .env file to ensure server-side environment variables
cat > ./.env << EOF
# Server environment variables with priority over NEXT_PUBLIC ones
APP_URL=$APP_URL
API_URL=$API_URL
BACKEND_API_URL=$BACKEND_API_URL
SOCKET_URL=$SOCKET_URL
WEBRTC_SERVER=$WEBRTC_SERVER
WS_URL=$WS_URL
TURN_SERVER_URL=$TURN_SERVER_URL
TURN_USERNAME=$TURN_USERNAME
TURN_PASSWORD=$TURN_PASSWORD
STUN_SERVER_URL=$STUN_SERVER_URL

# Next.js public variables
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
  echo "Starting server with finalized environment variables"
  # Start Next.js with environment variables explicitly passed
  exec env \
    APP_URL="$APP_URL" \
    API_URL="$API_URL" \
    BACKEND_API_URL="$BACKEND_API_URL" \
    SOCKET_URL="$SOCKET_URL" \
    WEBRTC_SERVER="$WEBRTC_SERVER" \
    WS_URL="$WS_URL" \
    TURN_SERVER_URL="$TURN_SERVER_URL" \
    TURN_USERNAME="$TURN_USERNAME" \
    TURN_PASSWORD="$TURN_PASSWORD" \
    STUN_SERVER_URL="$STUN_SERVER_URL" \
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