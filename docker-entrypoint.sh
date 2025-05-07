#!/bin/sh
set -e

# --- Set default values if variables are not provided by Docker/Compose ---
export APP_URL="${APP_URL:-http://localhost:3000}"
export API_URL="${API_URL:-http://localhost:3000/api}"
export BACKEND_API_URL="${BACKEND_API_URL:-http://localhost:3000/api}"
export SOCKET_URL="${SOCKET_URL:-ws://localhost:3001}"
export WEBRTC_SERVER="${WEBRTC_SERVER:-http://localhost:3001}"
export WS_URL="${WS_URL:-/socket.io/}"
export PORT="${PORT:-3000}"
export PORT_SOCKET="${PORT_SOCKET:-3001}"
export TURN_SERVER_URL="${TURN_SERVER_URL:-turn:localhost:3478}"
export TURN_USERNAME="${TURN_USERNAME:-bidpazar}"
export TURN_PASSWORD="${TURN_PASSWORD:-bidpazarpass}"
export STUN_SERVER_URL="${STUN_SERVER_URL:-stun:localhost:3478}"

# Set defaults specific to production environment if NODE_ENV is production
if [ "$NODE_ENV" = "production" ]; then
  export APP_URL="${APP_URL:-https://bidpazar.com}"
  export API_URL="${API_URL:-https://bidpazar.com/api}"
  export SOCKET_URL="${SOCKET_URL:-wss://socket.bidpazar.com}"
  export WEBRTC_SERVER="${WEBRTC_SERVER:-https://socket.bidpazar.com}"
  export BACKEND_API_URL="${BACKEND_API_URL:-https://bidpazar.com/api}"
  export TURN_SERVER_URL="${TURN_SERVER_URL:-turn:45.147.46.183:3478}"
  export STUN_SERVER_URL="${STUN_SERVER_URL:-stun:45.147.46.183:3478}"
  export WS_URL="${WS_URL:-/socket.io/}"
fi

# --- Ensure NEXT_PUBLIC_ versions exist for client build-time access (if needed) ---
# Note: For runtime client config, we'll use an API route, but these
# might be useful for initial values or components not needing runtime updates.
export NEXT_PUBLIC_APP_URL="${APP_URL}"
export NEXT_PUBLIC_API_URL="${API_URL}"
export NEXT_PUBLIC_SOCKET_URL="${SOCKET_URL}"
export NEXT_PUBLIC_WEBRTC_SERVER="${WEBRTC_SERVER}"
export NEXT_PUBLIC_WS_URL="${WS_URL}"
export NEXT_PUBLIC_TURN_SERVER_URL="${TURN_SERVER_URL}"
export NEXT_PUBLIC_TURN_USERNAME="${TURN_USERNAME}"
export NEXT_PUBLIC_TURN_PASSWORD="${TURN_PASSWORD}"
export NEXT_PUBLIC_STUN_SERVER_URL="${STUN_SERVER_URL}"

# Log the final environment variables the server will use
echo "--- Starting Next.js with effective environment variables ---"
env | grep -E '^(APP_URL|API_URL|BACKEND_API_URL|SOCKET_URL|WEBRTC_SERVER|WS_URL|TURN_|STUN_|NODE_ENV|NEXT_PUBLIC_|DATABASE_URL|JWT_SECRET|NEXTAUTH_|PORT|SMS_|MEDIASOUP_)' | sort
echo "-------------------------------------------------------------"

# Check if server.js exists
if [ ! -f "./server.js" ]; then
  echo "ERROR: server.js not found. Check the Next.js build ('standalone' output)."
  echo "Files in current directory:"
  ls -la
  exit 1
fi

# Execute the Next.js server
# No need to pass env vars via 'env' command, Node.js inherits them automatically
echo "Starting custom server with WebSocket support on ports ${PORT} and ${PORT_SOCKET}..."
exec node server.js 