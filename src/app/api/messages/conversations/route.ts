import { NextRequest } from 'next/server';
import { withAuth, forwardAuthenticatedRequest } from "@/lib/backend-auth";
import { env } from "@/lib/env";
import { logger } from '@/lib/logger'; // Import logger

/**
 * GET handler for user conversations
 * Uses the withAuth utility to ensure authentication
 */
export const GET = withAuth(async (req: NextRequest, token: string, userData: any) => {
  const url = req.nextUrl.pathname;
  logger.info(`[API][${url}] GET request received for conversations. Authenticated user:`, userData?.username || 'Unknown');
  
  // Get backend base URL from environment
  const backendBaseUrl = env.BACKEND_API_URL;
  const backendPath = '/api/messages/conversations';
  
  logger.info(`[API][${url}] Forwarding authenticated request to backend: ${backendBaseUrl}${backendPath}`);
  
  try {
    // Use our utility to forward the request to the backend
    const response = await forwardAuthenticatedRequest(
      req,
      backendPath,
      backendBaseUrl
    );
    
    // Log the response status
    logger.info(`[API][${url}] Backend response status: ${response.status}`);
    
    // Check if the response is valid
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[API][${url}] Backend returned error (${response.status}):`, errorText);
      return response;
    }
    
    // Clone response to read body
    const clonedResponse = response.clone();
    try {
      const data = await clonedResponse.json();
      logger.info(`[API][${url}] Backend returned valid data: ${Array.isArray(data) ? `Array with ${data.length} items` : 'Non-array data'}`);
    } catch (error) {
      logger.error(`[API][${url}] Could not parse response as JSON:`, error);
    }
    
    return response;
  } catch (error) {
    logger.error(`[API][${url}] Error in conversations API:`, error);
    throw error;
  }
}); 