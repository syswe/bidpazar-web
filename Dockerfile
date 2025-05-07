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

# Build next.js app with standalone output
RUN npm run build

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

# Copy all node_modules required for ts-node to work correctly
COPY --from=builder /app/node_modules/module-alias ./node_modules/module-alias
COPY --from=builder /app/node_modules/ts-node ./node_modules/ts-node
COPY --from=builder /app/node_modules/@types ./node_modules/@types
COPY --from=builder /app/node_modules/make-error ./node_modules/make-error
COPY --from=builder /app/node_modules/arg ./node_modules/arg
COPY --from=builder /app/node_modules/v8-compile-cache-lib ./node_modules/v8-compile-cache-lib
COPY --from=builder /app/node_modules/yn ./node_modules/yn
COPY --from=builder /app/node_modules/diff ./node_modules/diff
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder /app/node_modules/create-require ./node_modules/create-require
COPY --from=builder /app/node_modules/acorn ./node_modules/acorn
COPY --from=builder /app/node_modules/acorn-walk ./node_modules/acorn-walk

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
