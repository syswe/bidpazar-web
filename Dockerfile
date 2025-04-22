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

# Make public directory and files writable
RUN chmod -R 755 /app/public

# Create a startup script that injects environment variables at runtime
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Log environment' >> /app/start.sh && \
    echo 'echo "Starting with container environment variables"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Inject environment variables into env.js' >> /app/start.sh && \
    echo 'cat > ./public/env.js << EOL' >> /app/start.sh && \
    echo '// This script provides access to container environment variables in the browser' >> /app/start.sh && \
    echo 'window.__ENV__ = {' >> /app/start.sh && \
    echo '  NEXT_PUBLIC_API_URL: "\'"$NEXT_PUBLIC_API_URL"\',"' >> /app/start.sh && \
    echo '  NEXT_PUBLIC_SOCKET_URL: "\'"$NEXT_PUBLIC_SOCKET_URL"\',"' >> /app/start.sh && \
    echo '  NEXT_PUBLIC_APP_URL: "\'"$NEXT_PUBLIC_APP_URL"\',"' >> /app/start.sh && \
    echo '  NEXT_PUBLIC_WEBRTC_SERVER: "\'"$NEXT_PUBLIC_WEBRTC_SERVER"\'"' >> /app/start.sh && \
    echo '};' >> /app/start.sh && \
    echo 'EOL' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start Next.js' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Install dependencies
RUN apk add --no-cache gettext

# Expose the port the app runs on
EXPOSE 3000

# Start with our script
CMD ["/app/start.sh"] 
