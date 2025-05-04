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

  // Get the token from the cookies
  const token = request.cookies.get('token')?.value || '';
  console.log(`[Middleware] Token present: ${!!token}`);

  // Verify the session token using the Edge-compatible function
  const payload = token ? await verifyAuthSession(token) : null;
  const isAuthenticated = !!payload;
  console.log(`[Middleware] Is authenticated (based on token verification): ${isAuthenticated}`);

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