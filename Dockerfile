FROM node:22 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install OS dependencies needed for building native modules
# Use apt-get for Debian-based image
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake python3 \
    && rm -rf /var/lib/apt/lists/*

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

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

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

# Install required packages for the custom server
RUN npm install --no-save socket.io socket.io-client ws 
# Install mediasoup with proper build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip make g++ && \
    npm install --no-save mediasoup mediasoup-client && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Make public directory and files writable (adjust if needed, e.g., for uploads)
# Consider if this is truly necessary or if volumes handle uploads
RUN chmod -R 755 /app/public

# Copy the simplified entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose the ports the app runs on
EXPOSE 3000
EXPOSE 3001
# Expose MediaSoup ports for WebRTC
EXPOSE 40000-40100/udp

# Start with our simplified entrypoint script
CMD ["/app/docker-entrypoint.sh"]
