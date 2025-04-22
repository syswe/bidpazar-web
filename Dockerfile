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

# Install dependencies
RUN apk add --no-cache gettext

# Expose the port the app runs on
EXPOSE 3000

# Start with our script
CMD ["/app/start.sh"] 
