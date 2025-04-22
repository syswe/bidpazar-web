# BidPazar Frontend

This repository contains the frontend user interface for the BidPazar application, built with Next.js.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
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
