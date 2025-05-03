import { NextRequest, NextResponse } from 'next/server';
import { withAuth, forwardAuthenticatedRequest } from "@/lib/backend-auth";
import { env } from "@/lib/env";

/**
 * GET handler for user products
 * Uses the withAuth utility to ensure authentication
 */
export const GET = withAuth(async (req: NextRequest, token: string, userData: any) => {
  const urlPath = req.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received. Authenticated user:`, userData?.username || 'Unknown');
  // Get backend base URL from environment
  const backendBaseUrl = env.BACKEND_API_URL;
  const backendPath = '/api/products/user'; // Ensure this matches the backend route
  console.log(`[API][${urlPath}] Forwarding authenticated request to backend: ${backendBaseUrl}${backendPath}`);
  
  // Use our utility to forward the request to the backend
  // Ensure the utility logs internally or add more logging here if needed
  return forwardAuthenticatedRequest(
    req,
    backendPath, // Use the correct path including /api if needed by backend
    backendBaseUrl
    // Add options if necessary, e.g., { method: 'GET' }
  );
}); 