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

# Default build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://api:5001/api
ARG NEXT_PUBLIC_SOCKET_URL=ws://api:5001/rtc/v1
ARG NEXT_PUBLIC_APP_URL=http://web:3000
ARG NEXT_PUBLIC_WEBRTC_SERVER=ws://api:5001/rtc/v1

# Set the environment variables for the build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_WEBRTC_SERVER=${NEXT_PUBLIC_WEBRTC_SERVER}

# Log the build environment
RUN echo "Building with environment:" && \
    echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL" && \
    echo "NEXT_PUBLIC_SOCKET_URL: $NEXT_PUBLIC_SOCKET_URL" && \
    echo "NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL" && \
    echo "NEXT_PUBLIC_WEBRTC_SERVER: $NEXT_PUBLIC_WEBRTC_SERVER"

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

# Create a more robust startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Log environment variables' >> /app/start.sh && \
    echo 'echo "Container environment variables:"' >> /app/start.sh && \
    echo 'echo "NEXT_PUBLIC_API_URL: $NEXT_PUBLIC_API_URL"' >> /app/start.sh && \
    echo 'echo "NEXT_PUBLIC_SOCKET_URL: $NEXT_PUBLIC_SOCKET_URL"' >> /app/start.sh && \
    echo 'echo "NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL"' >> /app/start.sh && \
    echo 'echo "NEXT_PUBLIC_WEBRTC_SERVER: $NEXT_PUBLIC_WEBRTC_SERVER"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Create runtime environment file' >> /app/start.sh && \
    echo 'cat > ./runtime.env << EOL' >> /app/start.sh && \
    echo 'NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL' >> /app/start.sh && \
    echo 'NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL' >> /app/start.sh && \
    echo 'NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL' >> /app/start.sh && \
    echo 'NEXT_PUBLIC_WEBRTC_SERVER=$NEXT_PUBLIC_WEBRTC_SERVER' >> /app/start.sh && \
    echo 'EOL' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Update env.js with runtime values' >> /app/start.sh && \
    echo 'envsubst < ./public/env.js.template > ./public/env.js' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Log the final env.js content' >> /app/start.sh && \
    echo 'echo "Content of env.js after substitution:"' >> /app/start.sh && \
    echo 'cat ./public/env.js' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Export runtime environment' >> /app/start.sh && \
    echo 'export $(cat ./runtime.env | xargs)' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start Next.js' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Create env.js.template
RUN mv ./public/env.js ./public/env.js.template

# Make sure check-env.js file is present and not templated
RUN if [ ! -f ./public/check-env.js ]; then echo "ERROR: check-env.js is missing" && exit 1; fi

# Install envsubst
RUN apk add --no-cache gettext

# Expose the port the app runs on
EXPOSE 3000

# Start with our script
CMD ["/app/start.sh"] 
