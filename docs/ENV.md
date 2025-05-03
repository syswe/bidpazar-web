# Environment Variables (BidPazar)

## Overview
This document explains how environment variables are managed in BidPazar, how to avoid conflicts, and how to fit best practices for Next.js 15+ (server/client envs). It also provides a concrete plan for simplifying and cleaning up your .env and related files.

---

## 1. API URL Variables: Purpose & Usage

| Variable                  | Purpose/Usage                                  | Where Used (files)                                   |
|---------------------------|------------------------------------------------|------------------------------------------------------|
| NEXT_PUBLIC_API_URL       | Main API base URL (frontend & backend)         | src/lib/env.ts, src/lib/frontend-auth.ts, src/lib/api.ts, etc. |
| NEXT_PUBLIC_APP_URL       | App base URL (frontend)                        | src/lib/env.ts, src/lib/utils.ts                     |
| NEXT_PUBLIC_BACKEND_API_URL | (Deprecated, use only if backend API is different) | (not needed by default) |
| env.API_URL               | Used for all frontend API calls                | src/lib/frontend-auth.ts, src/lib/api.ts, etc.       |
| env.BACKEND_API_URL       | Used for all backend/server API calls (always same as API_URL) | src/lib/backend-auth.ts, API route handlers, etc.    |
| env.APP_URL               | Used for absolute URLs                         | src/lib/utils.ts                                     |

---

## 2. Best Practices for Next.js 15+ (Server/Client Env Management)

- **Public (Client) Variables:**  Prefix with `NEXT_PUBLIC_`. These are exposed to the browser and available via `process.env.NEXT_PUBLIC_*` and (optionally) via a runtime-injected `window.__ENV__` (as in Docker).
- **Server-only Variables:**  No prefix. Only available on the server (API routes, getServerSideProps, etc).
- **Access in Code:**  Use a central utility (like `src/lib/env.ts`) to read and normalize all envs. Never access `process.env` directly in app code; always use the utility.
- **API URLs:**
  - Use `env.API_URL` for all frontend (browser) API calls.
  - Use `env.BACKEND_API_URL` for all backend/server API calls.
  - Use `env.APP_URL` for absolute URLs (redirects, etc).

---

## 3. Example .env Structure

```env
# Core URLs
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
# If you need a separate backend API endpoint, uncomment and set:
# NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000/api

# Server-only (no NEXT_PUBLIC_) for secrets, DB, etc.
DATABASE_URL=...
JWT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# Real-time, WebRTC, etc.
NEXT_PUBLIC_SOCKET_URL=/rtc/v1
NEXT_PUBLIC_WEBRTC_SERVER=/rtc/v1
NEXT_PUBLIC_WS_URL=/rtc/v1
NEXT_PUBLIC_TURN_SERVER_URL=turn:localhost:3478
NEXT_PUBLIC_TURN_USERNAME=bidpazar
NEXT_PUBLIC_TURN_PASSWORD=bidpazarpass
NEXT_PUBLIC_STUN_SERVER_URL=stun:localhost:3478

| File/Path                                               | Variable(s) Used                | Usage Context                        |
|---------------------------------------------------------|----------------------------------|--------------------------------------|
| `src/lib/env.ts`                                        | All                             | Central environment manager          |
| `src/lib/frontend-auth.ts`                              | `env.API_URL`                   | All frontend auth API calls          |
| `src/lib/api.ts`                                        | `env.API_URL`                   | API helpers, URL construction        |
| `src/lib/backend-auth.ts`                               | `env.BACKEND_API_URL`           | All backend auth API calls           |
| `src/lib/utils.ts`                                      | `env.APP_URL`                   | Absolute URL construction            |
| `src/app/api/*/route.ts` (API route handlers)           | `env.BACKEND_API_URL`           | Server-to-server API calls           |
| `src/app/(debug)/api-debug.tsx`                         | `env.BACKEND_API_URL`           | Debugging backend API                |
| `src/app/(debug)/api-test/page.tsx`                     | `env.API_URL`                   | Debugging frontend API               |
| `test-auth-ts.ts`                                       | `process.env.NEXT_PUBLIC_API_URL` | Test scripts                |
| `next.config.ts`                                        | All                             | Exposes env vars to Next.js          |
| `docker-entrypoint.sh`                                  | All                             | Injects env vars for browser         |

---

## 4. How to Avoid/Resolve Conflicts

- Remove unused or duplicate variables (e.g., if you don't need `NEXT_PUBLIC_BACKEND_API_URL`, remove it everywhere).
- Check for `.env.local`, `.env.docker`, `.env.example`, etc. and ensure they don't contain conflicting or legacy values.
- Standardize all code to use the env utility (`env.API_URL`, `env.BACKEND_API_URL`, `env.APP_URL`).
- Document in ENV.md which variable is for what, and which files use them.

---

## 5. Usage Guidelines & Examples

```ts
// Frontend API call
fetch(`${env.API_URL}/auth/login`, ...);

// Backend API call (server-to-server)
fetch(`${env.BACKEND_API_URL}/auth/validate`, ...);

// Absolute URL
absoluteUrl('/some/path'); // uses env.APP_URL
```

---

## 6. Files Using API Environment Variables

- src/lib/env.ts
- src/lib/frontend-auth.ts
- src/lib/api.ts
- src/lib/backend-auth.ts
- src/lib/utils.ts
- src/app/api/*/route.ts
- src/app/(debug)/api-debug.tsx
- src/app/(debug)/api-test/page.tsx
- test-auth-ts.ts
- next.config.ts
- docker-entrypoint.sh

---

## 7. PLAN: What to Change & Where

### 1. .env and .env.* files
- [ ] Remove `NEXT_PUBLIC_BACKEND_API_URL` if you do not need a separate backend API endpoint.
- [ ] Ensure only one source of truth for each variable (avoid duplicate/conflicting values in `.env`, `.env.local`, `.env.docker`, etc.).
- [ ] Remove any legacy or unused API URL variables.

### 2. Codebase
- [ ] Refactor all API calls to use the env utility (`env.API_URL` for frontend, `env.BACKEND_API_URL` for backend).
- [ ] Remove any direct usage of `process.env.NEXT_PUBLIC_API_URL` or similar in code.
- [ ] Remove or refactor any API route handlers that use legacy/duplicate envs.
- [ ] Ensure all absolute URLs use `env.APP_URL`.

### 3. Docker/next.config.ts
- [ ] Only expose the minimal set of `NEXT_PUBLIC_*` variables needed for the client in `next.config.ts` and `docker-entrypoint.sh`.
- [ ] Ensure `public/env.js` (if used) matches the variables in `.env` and is not introducing conflicts.

### 4. Documentation
- [ ] Keep this ENV.md up to date with any changes to environment variable usage.
- [ ] Add a section to your main README about environment variable management and where to find this doc.

---

## 8. FAQ

**Q: Do I need both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BACKEND_API_URL`?**
A: Only if your backend API endpoint is different from your frontend API endpoint. Otherwise, use just `NEXT_PUBLIC_API_URL`.

**Q: How do I add a new environment variable?**
A: Add it to `.env`, expose it in `next.config.ts` if needed on the client, and add it to `src/lib/env.ts` for normalization.

**Q: How do I debug environment variable issues?**
A: Log the output of your env utility (`env`) on both server and client. Check for duplicate/conflicting values in all .env files.

---
