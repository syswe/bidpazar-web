# Environment Variables (BidPazar - Next.js App Router Strategy)

## Overview

This document explains how environment variables are managed in the BidPazar Next.js application, following best practices for the App Router.

We distinguish between:

1.  **Build-time Variables:** Embedded into the client-side JavaScript bundle during `next build`. Primarily for configuration known at build time.
2.  **Runtime Variables (Server):** Available only to the server-side Node.js environment (API Routes, Server Components, Middleware). Read directly from `process.env` set by the deployment environment (e.g., Docker, system env).
3.  **Runtime Variables (Client):** Configuration needed by the browser *after* deployment (e.g., the specific API URL to connect to). These are fetched dynamically from a dedicated API route (`/api/config`).

--- 

## 1. Variable Types & Naming Conventions

- **`NEXT_PUBLIC_` prefix:** Variables prefixed with `NEXT_PUBLIC_` are embedded into the client bundle at build time. They are accessible via `process.env.NEXT_PUBLIC_*` on both server and (initially) client.
  - **Use Case:** Static configuration known at build time, default values, public keys.
  - **Caution:** These values are fixed after the build. They **cannot** be changed at runtime without rebuilding.

- **No prefix:** Variables *without* the `NEXT_PUBLIC_` prefix are server-only.
  - **Use Case:** Secrets (API keys, JWT secrets, database URLs), server-specific configuration.
  - **Never** expose these to the client bundle.

--- 

## 2. Runtime Configuration for the Client

Since `NEXT_PUBLIC_` variables are baked in at build time, we need a way to provide runtime configuration (like the correct production API URL) to the client after deployment.

- **`/api/config` Route:**
  - A dedicated API route (`src/app/api/config/route.ts`) reads the necessary *runtime* environment variables from the server's `process.env`.
  - It only exposes variables safe for the client (typically corresponding to the `NEXT_PUBLIC_` ones, but with their *runtime* values).
  - It returns these values as a JSON object.

- **`RuntimeConfigContext`:**
  - A React context (`src/context/RuntimeConfigContext.tsx`) is used on the client-side.
  - A provider component (`RuntimeConfigProvider`) wraps the application layout.
  - On mount, the provider fetches the configuration from `/api/config`.
  - It makes the fetched runtime configuration available to any client component via the `useRuntimeConfig` hook.

--- 

## 3. Accessing Environment Variables in Code

- **Server-Side Code (API Routes, Server Components, Middleware, `src/lib/auth.ts`):**
  - Access variables directly from `process.env`.
  - Example: `const secret = process.env.JWT_SECRET;`
  - You can *optionally* use `src/lib/env.ts` as a utility, but be aware it reads directly from `process.env` on the server.

- **Client-Side Code (Client Components):**
  - **For Runtime Configuration:** Use the `useRuntimeConfig` hook:
    ```tsx
    'use client';
    import { useRuntimeConfig } from '@/context/RuntimeConfigContext';

    function MyComponent() {
      const { config, isLoading } = useRuntimeConfig();

      if (isLoading) return <p>Loading config...</p>;
      if (!config) return <p>Error loading config.</p>;

      // Use runtime values
      console.log('Runtime API URL:', config.apiUrl);
      console.log('Runtime Socket URL:', config.socketUrl);

      // ... component logic using config.apiUrl etc.
    }
    ```
  - **For Build-Time Configuration (Rarely Needed Directly):** If you absolutely need the value embedded at build time (and understand it won't change), you can access `process.env.NEXT_PUBLIC_*`. However, prefer using the runtime config for consistency.
  - **Utilities (`src/lib/api.ts`, `src/lib/frontend-auth.ts`):** These utilities now use relative paths (e.g., `/api/auth/login`) for API calls, assuming the API is served from the same origin as the frontend. They do not directly depend on runtime environment variables.

--- 

## 4. Example `.env` Structure (for Local Development)

```env
# .env

# Core Configuration (NEXT_PUBLIC_ used for build-time defaults/fallbacks)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
PORT=3000
NODE_ENV=development

# Runtime Server Variables (will override NEXT_PUBLIC_ on server)
# These are the values picked up by /api/config and docker-entrypoint.sh
API_URL=http://localhost:3000/api
APP_URL=http://localhost:3000
# If backend API differs (uncommon now), set BACKEND_API_URL here

# Database (Server-only)
DATABASE_URL="postgresql://user:password@localhost:5432/bidpazar?schema=public"

# Authentication (Server-only)
JWT_SECRET="your-secret-key"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Real-time Communication (NEXT_PUBLIC_ used for build-time defaults)
NEXT_PUBLIC_SOCKET_URL=ws://localhost:3000 
NEXT_PUBLIC_WEBRTC_SERVER=http://localhost:3000
NEXT_PUBLIC_WS_URL=/api/rtc/socket 
SOCKET_LOG_LEVEL=debug

# Runtime Server Variables for RTC
SOCKET_URL=ws://localhost:3000
WEBRTC_SERVER=http://localhost:3000
WS_URL=/api/rtc/socket

# WebRTC NAT Traversal (NEXT_PUBLIC_ used for build-time defaults)
NEXT_PUBLIC_TURN_SERVER_URL=turn:192.168.1.5:3478
NEXT_PUBLIC_TURN_USERNAME=bidpazar
NEXT_PUBLIC_TURN_PASSWORD=bidpazarpass
NEXT_PUBLIC_STUN_SERVER_URL=stun:192.168.1.5:3478

# Runtime Server Variables for TURN/STUN
TURN_SERVER_URL=turn:192.168.1.5:3478
TURN_USERNAME=bidpazar
TURN_PASSWORD=bidpazarpass
STUN_SERVER_URL=stun:192.168.1.5:3478

# MediaSoup (WebRTC - Server-only)
MEDIASOUP_ANNOUNCED_IP=192.168.1.5
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100
MEDIASOUP_WORKERS=1

# SMS (Server-only)
SMS_USERNAME="your-sms-username"
SMS_PASSWORD="your-sms-password"
SMS_ORIGIN="BIDPAZAR"
SMS_API_URL="https://api.smsprovider.com/send"
SEND_MESSAGE="mock"
```

**Production (`.env.docker` or similar):**
Replace `localhost` values with production URLs (e.g., `https://bidpazar.com/api`, `wss://bidpazar.com`, production TURN/STUN IPs). Ensure *both* the `API_URL` and `NEXT_PUBLIC_API_URL` (and similar pairs) are set to the production values, as the server reads the non-prefixed one at runtime, and the build might use the `NEXT_PUBLIC_` one as a fallback.

--- 

## 5. Docker Configuration (`docker-entrypoint.sh`)

- The `docker-entrypoint.sh` script now primarily sets default values for environment variables if they are not passed into the container.
- It ensures *both* server (`API_URL`) and potential build-time (`NEXT_PUBLIC_API_URL`) variables reflect the runtime environment (e.g., setting production URLs if `NODE_ENV=production`).
- It **no longer** creates `env.js` or injects anything into the client-side code directly.
- It simply starts the Next.js server (`node server.js`), which then reads `process.env`.

--- 

## 6. Files Involved & Responsibilities

| File/Path                           | Responsibility                                                              | Runtime Env Access          | Build Env Access            |
|-------------------------------------|-----------------------------------------------------------------------------|-----------------------------|-----------------------------|
| `.env` / `.env.docker`              | Source of truth for environment variables                                   | Yes (Server via `process.env`) | Yes (Build via `process.env`) |
| `docker-entrypoint.sh`              | Set default runtime env vars in container; Start server                     | Yes (`process.env`)         | No                          |
| `Dockerfile`                        | Build the application; Set build-time env vars (`NODE_ENV`, etc.)           | No                          | Yes (`process.env`)         |
| `next.config.ts`                    | Next.js build configuration                                                 | No                          | Yes (`process.env`)         |
| `src/lib/env.ts`                    | Utility to read `process.env` (mostly useful server/build side now)       | Yes (Server `process.env`)  | Yes (Client `process.env`)  |
| `src/app/api/config/route.ts`     | **API route to expose safe runtime config to client**                       | Yes (Server `process.env`)  | No                          |
| `src/context/RuntimeConfigContext.tsx` | **Client context to fetch & provide runtime config from `/api/config`**     | Yes (Client, via Fetch)     | No                          |
| Client Components (`*.tsx`)       | Use `useRuntimeConfig()` hook for runtime values                          | Yes (Via Context)           | Yes (`process.env` - build) |
| Server Components / API Routes    | Access `process.env` directly for server-only vars                          | Yes (`process.env`)         | No                          |
| `src/lib/api.ts`                    | API fetch utilities (uses relative paths)                                   | N/A                         | N/A                         |
| `src/lib/frontend-auth.ts`          | Client auth utilities (uses relative paths)                               | N/A                         | N/A                         |
| `src/lib/auth.ts`                   | Server-side auth logic (token verification)                                 | Yes (`process.env`)         | No                          |
| `src/middleware.ts`                 | Edge middleware (token verification)                                        | Yes (`process.env`)         | No                          |

--- 

## 7. Migration & Cleanup (Previously Done)

- [x] Simplified `docker-entrypoint.sh` (removed `env.js`, `.env.production`, `env-config.js` creation).
- [x] Simplified `Dockerfile` (removed `dotenv`, `gettext`, placeholder `env.js`).
- [x] Removed `<Script src="/env.js">` from `src/app/layout.tsx`.
- [x] Refactored `src/lib/env.ts` (removed defaults, simplified access).
- [x] Created `/api/config/route.ts`.
- [x] Created `src/context/RuntimeConfigContext.tsx`.
- [x] Wrapped layout with `RuntimeConfigProvider`.
- [x] Refactored `src/lib/frontend-auth.ts` to use relative paths.
- [ ] **TODO:** Audit client components previously using `import { env }` to ensure they now use `useRuntimeConfig()` for runtime values.
- [ ] **TODO:** Review and clean up any duplicate/conflicting variables across all `.env.*` files (`.env`, `.env.local`, `.env.docker`, etc.).

--- 

## 8. FAQ

**Q: Why fetch config on the client instead of using `NEXT_PUBLIC_`?**
A: `NEXT_PUBLIC_` variables are fixed at build time. Fetching allows the same Docker image/build artifact to be deployed to different environments (staging, production) and connect to the correct backend URLs without rebuilding.

**Q: Is `/api/config` secure?**
A: Yes, provided it only exposes non-sensitive, public configuration values (like API URLs, public keys) and your application uses HTTPS.

**Q: How do I add a new runtime client variable?**
A: 1. Define it in your `.env` / deployment environment. 2. Add it to the `ClientConfig` interface in `/api/config/route.ts`. 3. Read `process.env` and return it in the `GET` handler of `/api/config/route.ts`. 4. Add it to the `RuntimeConfig` interface in `RuntimeConfigContext.tsx`. Client components can now access it via `useRuntimeConfig()`. 

**Q: What about server-only variables?**
A: Define them without the `NEXT_PUBLIC_` prefix in your `.env` / deployment environment. Access them directly via `process.env` in your server-side code (API routes, Server Components, etc.).

---
