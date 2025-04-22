FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application - skip ESLint checks
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Remove hardcoded environment variables, Next.js will read from .env files directly

RUN npm run build -- --no-lint

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy necessary files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Make sure .env file gets copied if it exists
COPY --from=builder /app/.env* ./

# Make public directory and files writable
RUN chmod -R 755 /app/public

# Create a simpler startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Log environment' >> /app/start.sh && \
    echo 'echo "Starting with environment configuration from .env files"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start Next.js' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# No need for env.js.template anymore
# RUN mv ./public/env.js ./public/env.js.template

# Install dependencies
RUN apk add --no-cache gettext

# Expose the port the app runs on
EXPOSE 3000

# Start with our script
CMD ["/app/start.sh"] 
