import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Use the Edge-compatible verification function
import { verifyAuthSession } from "./lib/auth";

// Remove the explicit runtime export to default back to Edge
// export const runtime = 'nodejs';

// Improved WebSocket detection function
function detectWebSocketRequest(request: NextRequest): boolean {
  // Check the Upgrade header
  const upgradeHeader = request.headers.get("upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    return true;
  }

  // Check if it's a Socket.IO path for either WebSockets or polling
  const path = request.nextUrl.pathname;

  // Look for socket.io paths
  if (
    path.startsWith("/socket.io/") ||
    path === "/socket.io" ||
    path.includes("/socket.io")
  ) {
    // Further check query parameters to confirm it's Socket.IO traffic
    const isSocketIo =
      request.nextUrl.searchParams.has("EIO") ||
      request.nextUrl.searchParams.has("transport") ||
      request.nextUrl.searchParams.has("sid");

    if (isSocketIo) {
      return true;
    }
  }

  // Check for other common WebSocket paths
  if (
    path.startsWith("/ws") ||
    path.startsWith("/wss") ||
    path.includes("/ws/")
  ) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /protected)
  const path = request.nextUrl.pathname;
  // Revert log message as runtime is now Edge by default
  console.log(
    `[Middleware] Processing request for path: ${path} (Runtime: Edge)`
  );

  // Define public paths that don't require authentication
  const isPublicPath =
    path === "/" ||
    path === "/sign-in" ||
    path === "/sign-up" ||
    path === "/auth/login" ||
    path === "/auth/signup" ||
    path === "/login" ||
    path === "/register" ||
    path === "/auth/reset-password" ||
    path === "/products" ||
    path.startsWith("/auth/reset-password/") ||
    path.startsWith("/auth/verify/") ||
    path.startsWith("/api/auth/") || // ALL auth API routes are public
    path === "/api/products" || // Allow public access to products
    path === "/api/config" || // Allow public access to config
    path === "/api/live-streams" || // Allow public access to live streams list
    path === "/api/stories" || // Allow public access to stories (GET only)
    path.startsWith("/api/health") || // Health checks should be public
    path.startsWith("/api/messages/") || // Allow authenticated messaging API access
    path.startsWith("/public/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.includes("/images/") ||
    path.includes(".png") ||
    path.includes(".jpg") ||
    path.includes(".svg") ||
    path.includes(".ico") ||
    path.startsWith("/api/public/") ||
    // Static pages
    path === "/about" ||
    path === "/contact" ||
    path === "/cookies" ||
    path === "/faq" ||
    path === "/kvkk" ||
    path === "/privacy" ||
    path === "/shipping-returns" ||
    path === "/terms" ||
    path === "/user-agreement" ||
    path === "/packages" ||
    path.startsWith("/download") ||
    // Allow anonymous access to live-streams pages and their data
    path === "/live-streams" || // Allow access to main live streams page
    path.startsWith("/live-streams/") ||
    // Allow anonymous access to live-auctions-hls pages and API
    path.startsWith("/live-auctions-hls/") ||
    // Allow public access to HLS stream data and files
    path.startsWith("/api/live-streams/hls/") ||
    // Allow public access to stream-related API endpoints
    (path.startsWith("/api/live-streams/") &&
      // Matches /api/live-streams/{id} - for stream details GET request
      (path.match(/^\/api\/live-streams\/[^/]+$/) !== null ||
        path.endsWith("/public") ||
        path.includes("/public/") ||
        path.includes("/viewers") || // Allow viewers endpoint
        path.includes("/active-bid") ||
        path.includes("/active-listing") ||
        path.includes("/listings") || // Allow listings endpoints
        path.includes("/messages"))) ||
    // Allow public access to product auctions API
    path.startsWith("/api/product-auctions") ||
    // Allow public access to messages (read-only) API for live streams
    path.startsWith("/api/messages/streams/");

  // Enhanced check for WebSocket and Socket.IO requests
  // Excluded from middleware processing to prevent connection issues
  const isSocketPath =
    path === "/socket.io" ||
    path.startsWith("/socket.io/") ||
    path.includes("/socket.io") ||
    path.startsWith("/api/socket") ||
    path.startsWith("/sockets/") ||
    path.includes("/__nextjs_original-stack-frame") ||
    path.includes("/ws") ||
    path.includes("/favicon.ico") ||
    path.startsWith("/_next/");

  // Comprehensive WebSocket detection
  const isWebSocketRequest = detectWebSocketRequest(request);

  // Special handling for socket.io polling requests which may not have WS headers
  const isSocketIOPolling =
    path.startsWith("/socket.io/") &&
    (request.nextUrl.searchParams.has("EIO") ||
      request.nextUrl.searchParams.get("transport") === "polling");

  // Log socket requests for debugging
  if (isSocketPath || isWebSocketRequest || isSocketIOPolling) {
    console.log(
      `[Middleware] Skipping middleware for Socket/WebSocket path: ${path}`
    );
    console.log(
      `[Middleware] Headers: Upgrade=${request.headers.get(
        "upgrade"
      )}, Connection=${request.headers.get("connection")}, Query=${
        request.nextUrl.search
      }`
    );
    return NextResponse.next();
  }

  // For public paths, allow access
  if (isPublicPath) {
    console.log(`[Middleware] Public path: ${path}, allowing access`);
    return NextResponse.next();
  }

  // For non-public paths, verify auth session
  try {
    // Get token from cookies or Authorization header
    const sessionToken =
      request.cookies.get("authToken")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "") ||
      "";

    if (!sessionToken) {
      console.log(`[Middleware] No auth token found, redirecting to login`);
      // Update to redirect to /login directly
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", encodeURI(request.url));
      return NextResponse.redirect(url);
    }

    const payload = await verifyAuthSession(sessionToken);

    if (!payload || !payload.userId) {
      console.log(`[Middleware] Invalid auth session, redirecting to login`);
      // Update to redirect to /login directly
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", encodeURI(request.url));
      return NextResponse.redirect(url);
    }

    // Valid session, do something with user if needed
    console.log(
      `[Middleware] Valid auth session for user ID: ${payload.userId}, allowing access to: ${path}`
    );
    return NextResponse.next();
  } catch (error) {
    console.error("[Middleware] Error verifying auth session:", error);
    // Update to redirect to /login directly
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

// Use a more comprehensive config for the matcher to handle all the complex cases
export const config = {
  matcher: [
    /*
     * Match all request paths except those starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - socket.io paths (WebSocket)
     * - API routes that handle their own auth
     */
    {
      source:
        "/((?!_next/static|_next/image|socket\\.io|__nextjs_original-stack-frame|favicon\\.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico)|api/socket|sockets|ws).*)",
      missing: [
        { type: "header", key: "upgrade", value: "websocket" },
        { type: "header", key: "connection", value: "upgrade" },
        { type: "query", key: "EIO" },
        { type: "query", key: "transport" },
        { type: "query", key: "sid" },
        { type: "query", key: "streamId" },
      ],
    },
  ],
};
