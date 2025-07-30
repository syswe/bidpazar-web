FROM --platform=linux/amd64 node:22 AS base

# Set up basic dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-dev python3-pip python3-setuptools python3-wheel \
    build-essential pkg-config \
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

# Use npm install instead of npm ci to handle dependency conflicts
RUN npm install --omit=dev --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy package files and install ALL dependencies (including dev dependencies) for build
COPY package*.json ./
RUN npm install --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Livekit
ENV NEXT_PUBLIC_LIVEKIT_URL=wss://live.bidpazar.com
ENV NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
ENV NEXT_PUBLIC_TURN_SERVER_URL=turn:207.180.247.20:3478
ENV NEXT_PUBLIC_TURN_USERNAME=bidpazar_dev
ENV NEXT_PUBLIC_TURN_PASSWORD=coturn_dev_secret
ENV NEXT_PUBLIC_WEBRTC_SERVER=https://bidpazar.com 
# Set up NEXT_PUBLIC environment variables
ENV NEXT_PUBLIC_APP_URL="https://bidpazar.com"
ENV NEXT_PUBLIC_API_URL="https://bidpazar.com/api"
ENV NEXT_PUBLIC_SOCKET_URL="wss://bidpazar.com"
ENV NEXT_PUBLIC_WS_URL="/socket.io"


# Build next.js app with standalone output
RUN npm run build

# Create bundle for logger
RUN mkdir -p ./dist && \
    npx esbuild ./src/lib/logger.ts --bundle --platform=node --outfile=./dist/logger.js

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Make sure the server binds to all interfaces, not just localhost
ENV HOST="0.0.0.0"
ENV HOSTNAME="0.0.0.0"

# Copy necessary files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy Prisma schema files for database operations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Make sure server.js is in the image
COPY --from=builder /app/server.js ./

# Copy source files
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist

# Copy essential node_modules for runtime dependencies
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/module-alias ./node_modules/module-alias
COPY --from=builder /app/node_modules/react ./node_modules/react
COPY --from=builder /app/node_modules/react-dom ./node_modules/react-dom
COPY --from=builder /app/node_modules/next ./node_modules/next

# Install production dependencies in runner stage
RUN npm install --omit=dev --ignore-scripts --force

# Install additional runtime dependencies for socket.io
RUN npm install --no-save socket.io socket.io-client ws cors

# Regenerate Prisma client in production environment
RUN npx prisma generate

# Make public directory and files writable (adjust if needed, e.g., for uploads)
RUN chmod -R 755 /app/public

# Default environment values - these will be overridden by docker-compose
ENV APP_URL="http://localhost:3000"
ENV API_URL="http://localhost:3000/api"
ENV BACKEND_API_URL="http://localhost:3000/api"
ENV SOCKET_URL="ws://localhost:3001"
ENV WS_URL="/socket.io/"
ENV PORT="3000"
ENV PORT_SOCKET="3001"


# Expose the ports the app runs on
EXPOSE 3000
EXPOSE 3001

# Start the Next.js server directly
CMD ["node", "server.js"]
