import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Use the Edge-compatible verification function
import { verifyAuthSession } from "./lib/auth";

// Remove the explicit runtime export to default back to Edge
// export const runtime = 'nodejs';

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
    path.startsWith("/auth/reset-password/") ||
    path.startsWith("/auth/verify/") ||
    path.startsWith("/api/auth/") || // ALL auth API routes are public
    path === "/api/products" || // Allow public access to products
    path === "/api/config" || // Allow public access to config
    path === "/api/live-streams" || // Allow public access to live streams list
    path.startsWith("/api/health") || // Health checks should be public
    path.startsWith("/public/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.includes("/images/") ||
    path.includes(".png") ||
    path.includes(".jpg") ||
    path.includes(".svg") ||
    path.includes(".ico") ||
    path.startsWith("/api/public/") ||
    (path.startsWith("/api/live-streams/") &&
      (path.endsWith("/public") || path.includes("/public/")));

  // Special check for WebSocket and Socket.IO requests
  // Excluded from middleware processing to prevent connection issues
  const isSocketPath =
    path.includes("/socket.io") ||
    path.startsWith("/api/socket") ||
    path.startsWith("/sockets/") ||
    path.includes("/__nextjs_original-stack-frame") ||
    path.includes("/ws") ||
    path.includes("/favicon.ico") ||
    path.startsWith("/_next/");

  // Enhanced WebSocket detection
  const isWebSocketRequest =
    request.headers.get("upgrade")?.toLowerCase() === "websocket" ||
    request.headers.get("connection")?.toLowerCase().includes("upgrade") ||
    // Include EIO parameter which is used by Socket.IO
    request.nextUrl.searchParams.has("EIO") ||
    // Socket.IO polling transport should also bypass middleware
    (request.nextUrl.pathname.includes("/socket.io") &&
      (request.nextUrl.searchParams.has("transport") ||
        request.nextUrl.searchParams.has("sid")));

  // Log socket requests for debugging
  if (isSocketPath || isWebSocketRequest) {
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
        "/((?!_next/static|_next/image|socket\\.io|__nextjs_original-stack-frame|favicon\\.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico)|api/socket|sockets).*)",
      missing: [
        { type: "header", key: "upgrade", value: "websocket" },
        { type: "query", key: "EIO" },
      ],
    },
  ],
};
