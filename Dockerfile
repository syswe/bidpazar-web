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

# Build the Next.js application - skip ESLint checks
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build -- --no-lint

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Make public directory and files writable
RUN chmod -R 755 /app/public

# Add a placeholder env.js that will be overwritten at runtime
RUN echo '// Placeholder - will be replaced at runtime' > ./public/env.js

# Create a simpler startup script that uses envsubst
COPY docker-entrypoint.sh /app/start.sh
RUN chmod +x /app/start.sh

# Install dependencies - gettext is needed for envsubst in start.sh
RUN apt-get update && apt-get install -y --no-install-recommends gettext \
    && rm -rf /var/lib/apt/lists/*

# Expose the port the app runs on
EXPOSE 3000

# Start with our script
CMD ["/app/start.sh"] 
