# Refactoring Plan for `src` Directory

This document outlines a plan to refactor the `src` directory of the BidPazar project. The goal is to improve code organization, consistency, maintainability, and developer experience.

## General Principles

- **Adherence to Next.js Conventions**: Follow established patterns for Next.js projects.
- **Consistency**: Maintain uniform naming conventions for files and folders, and consistent code patterns.
- **Separation of Concerns**: Ensure distinct functionalities reside in dedicated modules/directories.
- **Modularity and Reusability**: Design components and modules to be reusable and independent where possible.
- **Clarity**: Make the codebase easier to understand and navigate.

## Phase 1: Directory Structure and File Organization (`src/`)

### 1. `src/hooks/`

- **Issue**: Inconsistency in hook placement. `src/lib/hooks/useMessageSocket.ts` exists.
- **Action**:
  - Move `src/lib/hooks/useMessageSocket.ts` to `src/hooks/useMessageSocket.ts`.
  - Ensure all custom React hooks are located directly within `src/hooks/`. If the number of hooks grows significantly, consider subdirectories within `src/hooks/` based on feature or domain (e.g., `src/hooks/auth/`, `src/hooks/stream/`).
  - Delete the `src/lib/hooks/` directory if it becomes empty.

### 2. `src/lib/`

This directory requires the most attention.

- **Issue**: `src/lib/` is a bit of a "catch-all". It contains API logic, authentication utilities, services, and other helpers.
- **Action**: Reorganize `src/lib/` into more specific subdirectories:

  - **`src/lib/api/`**:

    - **Status**: A new modular API structure seems to be in `src/lib/api/index.ts`.
    - **Action**:
      - Ensure full adoption of this new modular structure across the application.
      - Review `src/app/api/utils/client.ts` and `src/lib/api/client.ts`. Consolidate them into a single, well-defined API client utility, preferably within `src/lib/api/client.ts` or `src/lib/api/utils.ts`.
      - Once the new API structure is fully implemented and verified, safely remove the legacy file: `src/lib/api-legacy.ts`.

  - **`src/lib/auth/`**:

    - **Issue**: Auth files are scattered (`src/lib/auth.ts`, `src/lib/frontend-auth.ts`, `src/lib/backend-auth copy.ts`).
    - **Action**:
      - Create a new directory: `src/lib/auth/`.
      - Move `src/lib/auth.ts` (NextAuth options) to `src/lib/auth/options.ts` or `src/lib/auth/next-auth.config.ts`.
      - Move `src/lib/frontend-auth.ts` to `src/lib/auth/client.ts` (or `frontend.ts`).
      - Rename `src/lib/backend-auth copy.ts` to `src/lib/auth/server.ts` (or `backend.ts`) and move it into `src/lib/auth/`. Remove the "copy" suffix.
      - Consolidate shared types or constants within this directory if applicable.

  - **`src/lib/services/`**:

    - **Issue**: Domain-specific business logic like SMS and device management are in `src/lib/`.
    - **Action**:
      - Create a new directory: `src/lib/services/`.
      - Move `src/lib/device.service.ts` to `src/lib/services/device.service.ts`.
      - Move `src/lib/sms.ts` to `src/lib/services/sms.service.ts`.
      - Consider if other files in `src/lib/` represent distinct services and move them accordingly.

  - **`src/lib/db/`** (or keep `src/lib/prisma.ts`):

    - **Status**: `src/lib/prisma.ts` for Prisma client setup.
    - **Action**: This is generally fine. If more database-related utilities or configurations are added, consider moving `prisma.ts` into `src/lib/db/prisma.ts` and placing other DB-related files in `src/lib/db/`. For now, `src/lib/prisma.ts` can remain if it's the sole DB setup file.

  - **`src/lib/utils/`**:
    - **Status**: `src/lib/utils.ts` for general utility functions and `src/lib/logger.ts` for logging.
    - **Action**:
      - Keep `src/lib/utils.ts` for truly generic utility functions (e.g., `cn`, `formatDate`, `formatCurrency`).
      - Move `src/lib/logger.ts` to `src/lib/utils/logger.ts` for better grouping of utilities.
      - If `src/lib/utils.ts` becomes too large, consider splitting it into more specific utility files within `src/lib/utils/` (e.g., `src/lib/utils/date.ts`, `src/lib/utils/string.ts`).

### 3. `src/components/`

- **Issue**: Potential for disorganization as the number of components grows.
- **Action**:
  - Group components by feature/domain (e.g., `src/components/auth/`, `src/components/stream/`, `src/components/product/`) or by common UI patterns (e.g., `src/components/ui/` for generic UI elements like buttons, inputs, modals).
  - Ensure all components are functional components with clearly defined prop interfaces (as per `.copilot-instructions.md`).

### 4. `src/app/`

- **Issue**: API routes and page structures can become complex.
- **Action**:
  - Review the organization of API routes. Ensure consistent naming and request/response handling.
  - Group related pages or routes under logical subdirectories if not already done.
  - Ensure server-side logic within API routes is concise and delegates complex business logic to services in `src/lib/services/` or other appropriate modules.

### 5. `src/types/`

- **Issue**: Can become a dumping ground for all types.
- **Action**:
  - Organize shared type definitions by domain or feature (e.g., `src/types/auth.ts`, `src/types/stream.ts`).
  - For types specific to a single component or module, define them locally within that file or in a co-located `.types.ts` file.

## Phase 2: Code-Level Refactoring

### 1. Logging

- **Issue**: Extensive use of `console.log` for debugging across many files (e.g., API routes, `src/lib/api/client.ts`, `src/lib/api/messages.ts`, etc.).
- **Action**:
  - Replace all instances of `console.log` (and `console.error`, `console.warn`, etc.) with the centralized logger from `src/lib/utils/logger.ts` (once moved).
  - Utilize different log levels (`error`, `warn`, `info`, `debug`) appropriately.
  - Implement conditional logging based on an environment variable (e.g., `DEBUG_MODE` or `LOG_LEVEL`) as suggested in `.copilot-instructions.md`. For example, only log `debug` messages if `process.env.LOG_LEVEL === 'debug'`.

### 2. Environment Variables

- **Action**:
  - Perform a codebase audit to ensure strict adherence to `NEXT_PUBLIC_` prefix for client-side accessible environment variables.
  - Verify that no custom `env.ts` wrapper is used, and `process.env` is accessed directly.
  - Ensure sensitive keys (`DATABASE_URL`, `JWT_SECRET`, etc.) are never prefixed with `NEXT_PUBLIC_`.

### 3. Authentication Logic

- **Action**:
  - After reorganizing auth files into `src/lib/auth/`, review and refactor the logic for clarity and consistency.
  - Ensure JWT handling with the `jose` library is robust and secure.
  - Verify that the dual storage strategy (localStorage + HTTP cookies) and token refresh mechanisms are implemented correctly and align with the description in `.copilot-instructions.md`.

### 4. Global Variables

- **Issue**: `global.socketIO` in `server.js` to share the Socket.IO instance.
- **Action**:
  - While this pattern can work, investigate if Next.js or Socket.IO offer more modern or type-safe ways to access the Socket.IO instance within API routes. This might involve creating a singleton module or using a context if applicable within the Next.js request lifecycle for API routes. This is a lower priority but good for long-term maintainability.

### 5. Error Handling

- **Action**:
  - Standardize error handling across the application, especially for API calls (both client-side fetching and server-side API routes).
  - Use custom error classes (like `AuthError` in `backend-auth copy.ts`) where appropriate.
  - Ensure user-facing errors are informative but do not expose sensitive details.

### 6. API Client Usage

- **Action**:
  - Once the API client in `src/lib/api/` is finalized, ensure all parts of the application (components, hooks, pages) use this new client for making API requests.
  - Remove any old API fetching mechanisms.

## Phase 3: Cleanup and Verification

### 1. Remove Redundant Files

- **Action**:
  - Delete `src/lib/api-legacy.ts` after full migration.
  - Delete `src/lib/backend-auth copy.ts` after its content is merged into `src/lib/auth/server.ts`.
  - Delete `src/lib/hooks/` if it becomes empty.

### 2. Update Imports

- **Action**: After moving files and restructuring directories, meticulously update all import paths across the codebase. Use absolute paths (e.g., `@/lib/...` or `~/lib/...` if path aliases are configured in `tsconfig.json`) for better maintainability.

### 3. Testing

- **Action**:
  - Review and update existing unit tests and integration tests to reflect the refactored code.
  - Add new tests for any logic that was significantly changed or previously untested.
  - Pay special attention to testing authentication flows, API interactions, and critical business logic.

### 4. Documentation

- **Action**:
  - Update any relevant internal documentation (READMEs within subdirectories, JSDoc comments, etc.) to reflect the new structure and changes.
  - Ensure `.copilot-instructions.md` is still accurate or update it if any core architectural decisions change.

## API Client Consolidation: `src/lib/api/` as Single Source of Truth

**Goal**: Consolidate all client-side API fetching logic into the `src/lib/api/` directory, making it the single source of truth for API client functions. Deprecate and remove the redundant API client structure currently in `src/app/api/` (specifically files like `src/app/api/stories/client.ts`, `src/app/api/live-streams/client.ts`, and the utility `src/app/api/utils/client.ts`).

**Rationale**:

- The `src/lib/api/` directory is already designated as the new modular API client home (see `src/lib/api/README.md`).
- Utilities within `src/lib/api/` (e.g., `client.ts#fetcher`, `frontend-auth.ts#getToken`) are more robust and feature-complete.
- `src/app/api/` should primarily house Next.js App Router _route handlers_ (server-side code, typically `route.ts` files), not client-side API consumption logic.
- Reduces redundancy, improves consistency, and simplifies maintenance.

**Refactoring Steps**:

1.  **Standardize API Client Utilities**:

    - **Confirm**: `src/lib/api/client.ts` (providing `fetcher`) and `src/lib/frontend-auth.ts` (providing `getToken`, `getAuth`, etc.) are the standard utilities.
    - **Action (Crucial Prerequisite)**: Modify the `fetcher` function in `src/lib/api/client.ts` to correctly handle `FormData` requests. This involves:
      - Ensuring `FormData` bodies are not processed with `JSON.stringify()`.
      - Ensuring the `Content-Type` header is not automatically set to `application/json` when the body is `FormData` (the browser should set the correct multipart header).
    - **Action**: Delete `src/app/api/utils/client.ts`. Its functionality (`apiFetcher`, `getAuthToken`) is superseded by the utilities in `src/lib/api/client.ts` and `src/lib/frontend-auth.ts`.

2.  **Consolidate `stories` API Client**:

    - **Action**: Create a new file: `src/lib/api/stories.ts`.
    - **Action**: Migrate all functions (`getStories`, `uploadStoryImage`, `createStory`, `deleteStory`, `viewStory`) from `src/app/api/stories/client.ts` to the new `src/lib/api/stories.ts`.
      - Adapt these functions to use `fetcher` from `src/lib/api/client.ts` and `getToken` from `src/lib/frontend-auth.ts`.
      - The `uploadStoryImage` function, which uses `FormData`, will require the `fetcher` to be `FormData`-aware (as per step 1.2). If `fetcher` cannot be immediately adapted, `uploadStoryImage` can temporarily use `fetch` directly, but still utilize `apiBaseUrl` from `src/lib/api/client.ts` and `getToken` from `src/lib/frontend-auth.ts`.
    - **Action**: Add `export * as stories from "./stories";` to `src/lib/api/index.ts`.
    - **Action**: Delete `src/app/api/stories/client.ts`.

3.  **Consolidate `live-streams` API Client**:

    - The file `src/lib/api/livestreams.ts` already exists and is fairly comprehensive.
    - **Action**: Review `src/app/api/live-streams/client.ts`. Identify any unique functions (e.g., `getLiveStreamsForHomepage`) or different implementations and merge them into `src/lib/api/livestreams.ts`.
    - **Action**: Ensure all functions in `src/lib/api/livestreams.ts` consistently use the standard `fetcher` from `src/lib/api/client.ts` and rely on its `requireAuth` mechanism.
    - **Action**: Delete `src/app/api/live-streams/client.ts`.

4.  **Refactor/Remove `src/app/api/client.ts`**:

    - This file currently re-exports from the `src/app/api/.../client.ts` structure.
    - **Action**: After the above migrations and deletions, this file will be pointing to non-existent modules or redundant utilities. It should be deleted. Consumers will import directly from `@/lib/api`.

5.  **Update Application-wide Imports**:

    - **Action**: Conduct a global search for imports from ` "@/app/api/client"` and specific paths like ` "@/app/api/stories/client"`, ` "@/app/api/live-streams/client"`.
    - **Action**: Update these imports to point to the consolidated modules in `@/lib/api`. For example, `import { getProducts, getStories } from "@/app/api/client";` would become `import { getProducts, getStories } from "@/lib/api";` (or `import { products, stories } from '@/lib/api';`).

6.  **Cleanup and Verification**:
    - **Action**: Verify that directories within `src/app/api/` (e.g., `src/app/api/stories/`, `src/app/api/live-streams/`) now exclusively contain server-side Next.js App Router route handlers (typically `route.ts` files), if such handlers exist for these paths. No client-side logic should remain in these `src/app/api/` subdirectories.
    - **Action**: Run linters, type checkers (e.g., `tsc --noEmit`), and thoroughly test the application, especially features relying on the refactored API calls, to ensure everything functions as expected.
