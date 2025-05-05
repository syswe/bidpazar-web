import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Use the Edge-compatible verification function
import { verifyAuthSession } from './lib/auth'; 

// Remove the explicit runtime export to default back to Edge
// export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  // Get the pathname of the request (e.g. /, /protected)
  const path = request.nextUrl.pathname;
  // Revert log message as runtime is now Edge by default
  console.log(`[Middleware] Processing request for path: ${path} (Runtime: Edge)`); 

  // Define public paths that don't require authentication
  const isPublicPath = 
    path === '/login' || 
    path === '/register' || 
    path === '/sign-in' ||  // Keep this for backward compatibility
    path === '/sign-up' ||  // Keep this for backward compatibility
    path === '/' ||  // Allow home page for everyone
    path.startsWith('/products') ||  // Allow product pages for everyone
    path.startsWith('/api/products') ||  // Allow product API routes for everyone
    path.startsWith('/streams') ||  // Allow stream viewing for everyone
    path.startsWith('/api/auth/') || // Allow all auth API routes
    path.startsWith('/live-streams') || // Allow live stream viewing for everyone
    path.startsWith('/api/live-streams') || // Allow live stream API routes for everyone
    path.startsWith('/api/rtc/'); // Allow all RTC API routes for everyone

  console.log(`[Middleware] Is public path: ${isPublicPath}`);

  // Check if it's an admin path that needs special handling
  const isAdminPath = path.startsWith('/admin');
  
  // Get the token from the cookies
  const token = request.cookies.get('token')?.value || '';
  console.log(`[Middleware] Token present: ${!!token}`);

  // Verify the session token using the Edge-compatible function
  const payload = token ? await verifyAuthSession(token) : null;
  const isAuthenticated = !!payload;
  console.log(`[Middleware] Is authenticated (based on token verification): ${isAuthenticated}`);
  
  // Check admin status for admin routes
  const isAdmin = payload?.isAdmin === true;
  
  // Special handling for admin routes
  if (isAdminPath) {
    console.log(`[Middleware] Admin path detected: ${path}, user isAdmin: ${isAdmin}`);
    
    if (!isAuthenticated) {
      console.log(`[Middleware] Admin path - User not authenticated, redirecting to login`);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
    
    if (isAuthenticated && !isAdmin) {
      console.log(`[Middleware] Admin path - User authenticated but not admin, redirecting to dashboard`);
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
    
    // Allow admin user to access admin path
    console.log(`[Middleware] Admin path - User is admin, allowing access`);
    return NextResponse.next();
  }

  // 1. Redirect authenticated users away from login/register pages
  if ((path === '/login' || path === '/register' || path === '/sign-in' || path === '/sign-up') && isAuthenticated) {
    const redirectUrl = new URL('/', request.url);
    console.log(`[Middleware] Redirecting authenticated user from ${path} to ${redirectUrl}`);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Handle protected paths
  if (!isPublicPath && !isAuthenticated) {
    console.log(`[Middleware] Protected path (${path}) and user not authenticated, redirecting to login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    const response = NextResponse.redirect(loginUrl);
    // Clear potentially invalid cookie if present but verification failed
    if (token) { 
      response.cookies.set('token', '', { path: '/', maxAge: 0 });
    }
    return response;
  }

  // Check if this is a WebSocket upgrade request for our socket endpoint public
  if (
    request.method === 'GET' &&
    request.nextUrl.pathname.startsWith('/api/rtc/socket') &&
    (request.headers.get('upgrade') === 'websocket' ||
     request.headers.get('connection')?.includes('Upgrade'))
  ) {
    // Let the WebSocket handler in the route.ts handle the upgrade
    return NextResponse.next();
  }

  // If none of the above conditions met, allow the request to proceed
  console.log(`[Middleware] Request allowed for path: ${path}`);
  return NextResponse.next();
}

// Configure the paths that should be protected
export const config = {
  matcher: [
    // Match all routes except static files and _next internal paths
    '/((?!api/auth/logout|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Explicitly include specific API routes if needed beyond the general exclusion
    '/api/((?!auth/|products/).)*', // Protect all API routes except /api/auth/* and /api/products/*
  ],
}; 