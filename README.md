# BidPazar Web Core

This repository contains the frontend user interface for the BidPazar application, built with Next.js.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Refactoring Progress](#refactoring-progress)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
- [Key Features & Concepts](#key-features--concepts)
- [Styling](#styling)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scripts](#scripts)

## Technology Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** (Specify if using Zustand, Redux, Context API, etc.)
- **Data Fetching:** (Specify if using SWR, React Query, fetch API, etc.)
- **Testing:** Jest (based on `jest.config.js`)

## Project Structure

```
frontend/
├── .next/                # Next.js build output
├── node_modules/         # Node.js dependencies
├── public/               # Static assets (images, fonts, etc.)
├── src/                  # Source code
│   ├── app/              # Next.js App Router pages and layouts
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions, API clients, etc.
│   ├── tests/            # Unit and integration tests
│   └── types/            # TypeScript type definitions
├── .env.local.example    # Example local environment variables file
├── .gitignore            # Git ignore rules
├── Dockerfile            # Docker build instructions
├── jest.config.js        # Jest testing configuration
├── next.config.ts        # Next.js configuration
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Exact dependency versions
├── postcss.config.js     # PostCSS configuration (for Tailwind)
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Refactoring Progress

### Completed Refactoring
- ✅ WebRTCStreamManager component - Successfully refactored from a monolithic component into smaller, maintainable modules with proper separation of concerns

### In Progress
- 🔄 LiveStreamPage (`src/app/(streams)/live-streams/[id]/page.tsx`) - Currently being refactored from ~2000 lines to a target of 200 lines by extracting components and logic

### LiveStreamPage Refactoring Plan

The LiveStreamPage component is being refactored to reduce its size from ~2000 lines to a target of 200 lines maximum. Here's the detailed plan:

1. **Extract CSS to Separate Files:**
   - ✅ Move `verticalStreamStyles` to `styles/stream.css` or use CSS modules
   - ✅ Move `broadcastControlStyles` and other style blocks to separate files

2. **Create Type Definition Files:**
   - ✅ Move interfaces to `types/stream.ts`:
     - `LiveStreamDetails` interface
     - `LogItem` interface
     - `ActiveBid` interface
     - Connection state types

3. **Extract Utilities & Hooks:**
   - ✅ Create `hooks/useStreamConnection.ts` - Manage connection state and WebRTC
   - ✅ Create `hooks/useStreamDetails.ts` - Handle fetching stream details
   - ✅ Create `hooks/useStreamActions.ts` - Handle likes, sharing, etc.
   - ✅ Create `lib/loopback.ts` - For loopback detection functions
   - ✅ Create `lib/formatters.ts` - For date formatting and other utility functions
   - ✅ Create `hooks/useStreamLogger.ts` - For logging functionality

4. **Extract Components:**
   - ✅ Create `components/StreamErrorView.tsx` - Error display component
   - ✅ Create `components/StreamLoadingView.tsx` - Loading state component
   - ✅ Create `components/StreamHeader.tsx` - Stream title and details
   - ✅ Create `components/StreamControls.tsx` - Main control buttons (already exists)
   - ✅ Create `components/StreamFooter.tsx` - Footer with action buttons
   - ✅ Create `components/DiagnosticsPanel.tsx` - Expand the diagnostics into a separate component
   - ✅ Create `components/MediaControls.tsx` - Camera/microphone controls for streamers
   - ✅ Create `components/ConnectionStatus.tsx` - Connection state indicator

5. **Separate Business Logic:**
   - ✅ Create `lib/stream-service.ts` - API calls and stream management functions:
     - Start/end stream functionality
     - Product management functions
     - Bidding functionality

6. **Reduce Main Component Complexity:**
   - ✅ Simplify render logic using extracted components
   - ✅ Use composition instead of conditional rendering
   - ✅ Integrate extracted hooks for state management

7. **Implementation Order:**
   1. Extract types and utilities first
   2. Create service layer
   3. Build individual components
   4. Refactor main page to use new components
   5. Test and validate functionality
   6. Remove old code once functionality is confirmed

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm (v7 or higher) or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

### Environment Variables

1.  Copy the example environment file:
    ```bash
    cp .env.local.example .env.local
    ```
2.  Update the `.env.local` file with necessary environment variables, such as the backend API URL:
    ```
    NEXT_PUBLIC_API_URL=http://localhost:8000/api # Example
    NEXT_BACKEND_API_URL=http://localhost:5001    # Example: URL for backend-internal calls
    ```
    *(Refer to `.env.local.example` for required variables)*

### Running the Application

-   **Development Mode:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

-   **Production Build:**
    ```bash
    npm run build
    ```

-   **Start Production Server:**
    ```bash
    npm start
    ```

-   **Run Custom Socket.IO Server (for WebRTC streaming):**
    ```bash
    # First build the Next.js app
    npm run build
    # Then run the custom server
    npm run dev:socket
    ```
    This starts a custom server that supports persistent WebSocket connections for live streaming.
    
    The custom server runs:
    - A regular Next.js HTTP server on port 3000
    - A dedicated Socket.IO server on port 3001 for WebSocket connections
    
    For production environments:
    ```bash
    NODE_ENV=production npm run start:socket
    ```
    
    To test the Socket.IO connection:
    ```bash
    # In a new terminal window after starting the server
    npm run socket:test
    ```
    
    Note: The custom server handles both HTTP requests (like a regular Next.js server) and WebSocket connections for real-time streaming.

## Key Features & Concepts

- **App Router:** Uses the Next.js App Router for routing and layouts (`src/app/`).
- **Server Components & Client Components:** Leverages Next.js features for rendering.
- **(Add specific features like Authentication flow, Product display, User profiles, etc.)**

## Styling

- **Tailwind CSS:** Utility-first CSS framework used for styling.
- **Configuration:** `tailwind.config.js`, `postcss.config.js`
- **Global Styles:** Likely defined in `src/app/globals.css` or within layouts.

## Testing

-   **Framework:** Jest
-   **Configuration:** `jest.config.js`
-   **Run tests:**
    ```bash
    npm test
    ```
    *(See `README-TESTING.md` for more detailed testing information)*

## Deployment

- **Vercel:** Recommended platform for deploying Next.js applications.
- **Docker:** A `Dockerfile` is provided for containerized deployments.
    ```bash
    # Build the image
    docker build -t bidpazar-frontend .
    # Run the container (example)
    docker run -p 3000:3000 bidpazar-frontend
    ```
    *(Adjust port mapping and environment variables as needed)*

## Scripts

Commonly used scripts defined in `package.json`:

-   `npm run dev`: Start the development server.
-   `npm run build`: Create a production build.
-   `npm start`: Start the production server.
-   `npm test`: Run tests using Jest.
-   `npm run lint`: Lint the codebase (if configured).
-   `npm run format`: Format the codebase using Prettier (if configured).

*(Check `package.json` for the full list and specific commands)*
