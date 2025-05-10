FROM --platform=linux/amd64 node:22 AS base

# Set up Python properly in the base image
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-dev python3-pip python3-setuptools python3-wheel \
    build-essential cmake make g++ pkg-config libssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv \
    && . /opt/venv/bin/activate \
    && pip3 install --upgrade pip invoke

# Add venv to PATH
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install development dependencies first (including ts-node)
RUN npm install --no-save ts-node typescript @types/node

# Install Node.js dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=4096

# Build next.js app with standalone output
RUN npm run build

# Directly include the original TypeScript files and compile them at runtime with a full bundle
# This avoids complex module resolution issues
RUN npm install --no-save esbuild && \
    mkdir -p ./dist && \
    npx esbuild ./src/lib/socket/socketHandler.ts --bundle --platform=node --outfile=./dist/socketHandler.js && \
    npx esbuild ./src/lib/logger.ts --bundle --platform=node --outfile=./dist/logger.js

# Create a simple build script for TypeScript files
RUN echo '{ "compilerOptions": { "target": "es2020", "module": "commonjs", "moduleResolution": "node", "esModuleInterop": true, "outDir": "./dist", "strict": false, "baseUrl": ".", "paths": { "@/*": ["src/*"] } }, "include": ["src/lib/socket/socketHandler.ts", "src/lib/logger.ts"] }' > tsconfig.server.json

# Manually compile TypeScript files with a controlled environment
RUN npx tsc -p tsconfig.server.json || true

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
# Make sure the server binds to all interfaces, not just localhost
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0

# Copy necessary files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy Prisma schema files for database operations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Make sure server.js is in the image
COPY --from=builder /app/server.js ./

# Copy source and compiled JS files
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist

# Copy module-alias package which is required by server.js
COPY --from=builder /app/node_modules/module-alias ./node_modules/module-alias

# Install all required development dependencies
RUN npm install --no-save ts-node typescript @types/node socket.io socket.io-client ws

# Copy MediaSoup from the builder stage after it's been built
COPY --from=builder /app/node_modules/mediasoup ./node_modules/mediasoup

# Make public directory and files writable (adjust if needed, e.g., for uploads)
RUN chmod -R 755 /app/public

# Set up environment variables for BidPazar application
ENV APP_URL="http://localhost:3000"
ENV API_URL="http://localhost:3000/api"
ENV BACKEND_API_URL="http://localhost:3000/api"
ENV SOCKET_URL="ws://localhost:3001"
ENV WEBRTC_SERVER="http://localhost:3001"
ENV WS_URL="/socket.io/"
ENV PORT="3000"
ENV PORT_SOCKET="3001"
ENV TURN_SERVER_URL="turn:localhost:3478"
ENV TURN_USERNAME="bidpazar"
ENV TURN_PASSWORD="bidpazarpass"
ENV STUN_SERVER_URL="stun:localhost:3478"

# Set up NEXT_PUBLIC environment variables
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_API_URL="http://localhost:3000/api"
ENV NEXT_PUBLIC_SOCKET_URL="ws://localhost:3001"
ENV NEXT_PUBLIC_WEBRTC_SERVER="http://localhost:3001"
ENV NEXT_PUBLIC_WS_URL="/socket.io/"
ENV NEXT_PUBLIC_TURN_SERVER_URL="turn:localhost:3478"
ENV NEXT_PUBLIC_TURN_USERNAME="bidpazar"
ENV NEXT_PUBLIC_TURN_PASSWORD="bidpazarpass"
ENV NEXT_PUBLIC_STUN_SERVER_URL="stun:localhost:3478"

# Expose the ports the app runs on
EXPOSE 3000
EXPOSE 3001
# Expose MediaSoup ports for WebRTC
EXPOSE 40000-40100/udp

# Start the Next.js server directly
CMD ["node", "server.js"]
