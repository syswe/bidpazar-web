# Project Structure Overview

This document outlines the directory structure and key components of the BidPazar application, now a unified full-stack Next.js 15 application. A mobile application is planned for future development.

## Full-Stack Application (Next.js 15 + TypeScript)

The application provides both frontend and backend functionality in a single Next.js 15 codebase, including API routes, real-time features, and database access.

```
/                       # Project root
├── .next/              # Next.js build cache and output
├── node_modules/       # Project dependencies
├── public/             # Static assets served directly (images, fonts, robots.txt, uploads/)
│   └── uploads/        # Local storage for user-uploaded files
├── prisma/             # Prisma ORM schema, migrations, and client generation
│   ├── schema.prisma   # Main database schema definition
│   ├── test-schema.prisma # Test database schema
│   └── migrations/     # Prisma migration files
├── src/                # Main source code directory
│   ├── app/            # Next.js App Router: pages, layouts, API routes, route groups
│   │   ├── api/        # API route handlers (REST endpoints, WebSocket, WebRTC, etc.)
│   │   │   ├── auth/           # Authentication endpoints (register, login, logout, verify, etc.)
│   │   │   ├── users/          # User management endpoints
│   │   │   ├── products/       # Product management endpoints
│   │   │   ├── categories/     # Category management endpoints
│   │   │   ├── devices/        # Device management endpoints
│   │   │   ├── messages/       # Messaging endpoints
│   │   │   ├── rtc/            # Real-time communication (WebSocket, MediaSoup, etc.)
│   │   │   ├── live-streams/   # Live stream management endpoints
│   │   │   └── ...             # Additional API endpoints
│   │   ├── (auth)/     # Route group for authentication pages (login, register, etc.)
│   │   ├── (dashboard)/# Route group for user/admin dashboards
│   │   ├── (streams)/  # Route group for live streams
│   │   ├── (products)/ # Route group for product pages
│   │   ├── (admin)/    # Route group for admin pages
│   │   ├── (static)/   # Route group for static/informational pages
│   │   ├── layout.tsx  # Root application layout
│   │   └── page.tsx    # Root application page
│   ├── components/     # Reusable React components (UI elements, forms, layouts, etc.)
│   │   └── ui/         # Shared UI primitives and design system components
│   ├── hooks/          # Custom React hooks (e.g., useAuth, useSimplePeer)
│   ├── lib/            # Shared libraries, utilities, API clients, Prisma, auth, SMS, etc.
│   ├── services/       # Business logic, streaming, and service modules
│   ├── tests/          # Unit, integration, and E2E tests (setup, mocks, utils, etc.)
│   ├── types/          # Custom TypeScript type definitions and interfaces
│   └── middleware.ts   # Next.js middleware for route protection, CORS, etc.
├── .env                # Main environment variables
├── .env.local          # Local environment overrides
├── .gitignore          # Specifies intentionally untracked files that Git should ignore
├── Dockerfile          # Instructions for building the Docker image
├── docker-compose.yaml # Docker Compose configuration for multi-container setups (e.g., app + db)
├── jest.config.js      # Configuration for the Jest testing framework
├── next.config.ts      # Next.js configuration file
├── package.json        # Node.js project manifest (dependencies, scripts, metadata)
├── package-lock.json   # Records exact versions of dependencies
├── postcss.config.js   # PostCSS configuration (used by Tailwind CSS)
├── tailwind.config.js  # Tailwind CSS theme and plugin configuration
├── tsconfig.json       # TypeScript compiler options
└── README.md           # Detailed project documentation
```

## Mobile (Future)

A mobile application (likely React Native with Expo) is planned. Its structure will focus on:

- Screens corresponding to application features.
- Navigation using Expo Router.
- Secure token storage (`SecureStore`).
- Shared hooks (`useAuth`) and providers (`AuthProvider`) for state management, similar to the web frontend.
- Reusable components specific to the mobile platform.
