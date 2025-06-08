import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Use the Edge-compatible verification function
import { verifyAuthSession } from "./lib/auth";

// Remove the explicit runtime export to default back to Edge
// export const runtime = 'nodejs';

const DEBUG_MIDDLEWARE = process.env.DEBUG_NOTIFICATIONS === 'true';

// Simplified WebSocket/Socket.IO detection
function isWebSocketRequest(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  const upgradeHeader = request.headers.get("upgrade");
  
  // Direct WebSocket upgrade request
  if (upgradeHeader?.toLowerCase() === "websocket") {
    return true;
  }
  
  // Socket.IO paths with query parameters
  if (path.startsWith("/socket.io/") || path === "/socket.io") {
    return request.nextUrl.searchParams.has("EIO") ||
           request.nextUrl.searchParams.has("transport") ||
           request.nextUrl.searchParams.has("sid");
  }
  
  return false;
}

// Public path patterns - organized by category
const PUBLIC_PATHS = {
  // Static and system paths
  static: [
    "/", "/_next/", "/favicon", "/public/"
  ],
  
  // Authentication pages
  auth: [
    "/sign-in", "/sign-up", "/login", "/register",
    "/auth/login", "/auth/signup", "/auth/reset-password"
  ],
  
  // Public pages
  pages: [
    "/about", "/contact", "/cookies", "/faq", "/kvkk", 
    "/privacy", "/shipping-returns", "/terms", "/user-agreement", 
    "/packages", "/live-streams", "/products"
  ],
  
  // API endpoints that should be public
  api: [
    "/api/auth/", "/api/products", "/api/categories", "/api/config",
    "/api/live-streams", "/api/stories", "/api/health", "/api/public/",
    "/api/product-auctions"
  ],
  
  // Dynamic public paths (need special handling)
  dynamic: [
    { pattern: /^\/auth\/(?:reset-password|verify)\//, public: true },
    { pattern: /^\/live-streams\//, public: true },
    { pattern: /^\/live-auctions-hls\//, public: true },
    { pattern: /^\/download/, public: true },
    { pattern: /^\/api\/live-streams\/[^/]+$/, public: true }, // Stream details
    { pattern: /^\/api\/live-streams\/.*\/(?:public|viewers|active-bid|active-listing|listings|messages)/, public: true },
    { pattern: /^\/api\/messages\/streams\//, public: true }
  ]
};

// Check if request is for static assets
function isStaticAsset(path: string): boolean {
  return /\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/i.test(path);
}

function isPublicPath(path: string): boolean {
  // Check static assets first
  if (isStaticAsset(path)) {
    return true;
  }

  // Check static paths
  for (const staticPath of PUBLIC_PATHS.static) {
    if (path === staticPath || path.startsWith(staticPath)) return true;
  }
  
  // Check auth paths
  for (const authPath of PUBLIC_PATHS.auth) {
    if (path === authPath || path.startsWith(authPath)) return true;
  }
  
  // Check public pages
  for (const pagePath of PUBLIC_PATHS.pages) {
    if (path === pagePath || path.startsWith(pagePath)) return true;
  }
  
  // Check API paths
  for (const apiPath of PUBLIC_PATHS.api) {
    if (path === apiPath || path.startsWith(apiPath)) return true;
  }
  
  // Check dynamic patterns
  for (const { pattern, public: isPublic } of PUBLIC_PATHS.dynamic) {
    if (isPublic && pattern.test(path)) return true;
  }
  
  return false;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  if (DEBUG_MIDDLEWARE) {
    console.log(`[Middleware] Processing: ${path}`);
  }

  // Skip WebSocket and Socket.IO requests
  if (isWebSocketRequest(request)) {
    if (DEBUG_MIDDLEWARE) {
      console.log(`[Middleware] Skipping WebSocket/Socket.IO: ${path}`);
    }
    return NextResponse.next();
  }

  // Allow public paths
  if (isPublicPath(path)) {
    if (DEBUG_MIDDLEWARE) {
      console.log(`[Middleware] Public path allowed: ${path}`);
    }
    return NextResponse.next();
  }

  // Verify authentication for protected paths
  try {
    const sessionToken = 
      request.cookies.get("authToken")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!sessionToken) {
      if (DEBUG_MIDDLEWARE) {
        console.log(`[Middleware] No token, redirecting to login`);
      }
      return redirectToLogin(request);
    }

    const payload = await verifyAuthSession(sessionToken);
    
    if (!payload?.userId) {
      if (DEBUG_MIDDLEWARE) {
        console.log(`[Middleware] Invalid session, redirecting to login`);
      }
      return redirectToLogin(request);
    }

    if (DEBUG_MIDDLEWARE) {
      console.log(`[Middleware] Valid session for user: ${payload.userId}`);
    }
    
    return NextResponse.next();
  } catch (error) {
    if (DEBUG_MIDDLEWARE) {
      console.error("[Middleware] Auth error:", error);
    }
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("callbackUrl", encodeURI(request.url));
  return NextResponse.redirect(url);
}

// Fixed matcher configuration - no capturing groups allowed
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot)).*)',
  ],
};
