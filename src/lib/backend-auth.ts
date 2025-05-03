/**
 * Server-side authentication utilities for Next.js API routes
 * These functions are designed to work in a server context (API routes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from './env';

// Use the API_URL from env utility
const BACKEND_API_URL = env.BACKEND_API_URL;

console.log("Server-side auth initialized with backend URL:", BACKEND_API_URL);

// Custom error class for authentication errors
export class AuthError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Extract JWT token from the NextRequest authorization header
 */
export const getTokenFromRequest = (req: NextRequest): string | null => {
  const authorization = req.headers.get('authorization');
  if (!authorization) return null;
  
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Verify that the request has a valid authorization header
 * Returns the token if present, or throws a 401 response
 */
export const requireAuth = (req: NextRequest): string => {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    throw new AuthError('Unauthorized: No token provided');
  }
  
  return token;
};

/**
 * Validate token with the backend API
 */
export const validateTokenWithBackend = async (token: string): Promise<any> => {
  try {
    console.log(`Validating token with backend: ${BACKEND_API_URL}/auth/validate`);
    
    const response = await fetch(`${BACKEND_API_URL}/auth/validate`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
    
    if (!response.ok) {
      let errorMessage = `Token validation failed with status ${response.status}`;
      
      try {
        const errorData = await response.json();
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        // If JSON parsing fails, use the default error message
        console.error('Failed to parse error response:', parseError);
      }
      
      console.error(`Token validation failed: Status ${response.status}, Message: ${errorMessage}`);
      throw new AuthError(errorMessage, response.status);
    }
    
    const userData = await response.json();
    console.log("Token validation successful, received user data");
    return userData;
  } catch (error) {
    console.error("Token validation error:", error);
    if (error instanceof AuthError) {
      throw error;
    }
    
    throw new AuthError(`Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Create an authenticated handler for API routes that require authentication
 * @param handler Function that handles the authenticated request
 */
export const withAuth = (
  handler: (req: NextRequest, token: string, userData?: any) => Promise<NextResponse> | NextResponse
) => {
  return async (req: NextRequest) => {
    try {
      const token = requireAuth(req);
      
      // Validate token with backend
      try {
        const userData = await validateTokenWithBackend(token);
        return await handler(req, token, userData);
      } catch (validationError) {
        console.error('Token validation error:', validationError);
        if (validationError instanceof AuthError) {
          return NextResponse.json(
            { error: validationError.message },
            { status: validationError.statusCode }
          );
        }
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  };
};

/**
 * Utility to forward a request to the backend API with authentication
 * @param req Original NextRequest
 * @param path Backend API path (without base URL)
 * @param options Additional fetch options
 */
export const forwardAuthenticatedRequest = async (
  req: NextRequest,
  path: string,
  backendBaseUrl: string = BACKEND_API_URL,
  options: RequestInit = {}
) => {
  try {
    const token = requireAuth(req);
    
    // Validate token
    try {
      await validateTokenWithBackend(token);
    } catch (validationError) {
      console.error('Token validation failed:', validationError);
      if (validationError instanceof AuthError) {
        return NextResponse.json(
          { error: validationError.message },
          { status: validationError.statusCode }
        );
      }
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Build full URL for backend request
    const url = path.startsWith('/') 
      ? `${backendBaseUrl}${path}` 
      : `${backendBaseUrl}/${path}`;
    
    // Default options with authentication
    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    
    // Merge default options with provided options
    const fetchOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {}),
      },
    };
    
    // Log request (in development)
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Forwarding request to: ${url}`);
      console.debug('Request options:', {
        method: fetchOptions.method || 'GET',
        headers: fetchOptions.headers
      });
    }
    
    // Forward the request to the backend
    const response = await fetch(url, fetchOptions);
    
    // Handle error responses
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorBody: any = '';
      
      if (contentType && contentType.includes('application/json')) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
      
      console.error(`Backend error (${response.status}):`, errorBody);
      
      // Forward the error status
      return NextResponse.json(
        { error: errorBody.message || errorBody || `Backend error: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Return successful response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
        },
      });
    }
  } catch (error) {
    console.error('Error forwarding request:', error);
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}; 