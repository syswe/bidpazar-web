import { getToken } from "../frontend-auth";
import { logger } from "../logger";

// Add window.__ENV__ interface to fix TypeScript error
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_SOCKET_URL?: string;
    };
  }
}

// Enable client-side debugging in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const existingDebug = localStorage.getItem("debug") || "";
  const newDebugScopes = [];

  if (!existingDebug.includes("socket.io-client:*")) {
    newDebugScopes.push("socket.io-client:*");
  }

  if (newDebugScopes.length > 0) {
    localStorage.setItem(
      "debug",
      [existingDebug, ...newDebugScopes].filter(Boolean).join(",")
    );
    console.log(
      "[Dev Logging] Enabled Socket.IO client debug logs. Current localStorage.debug:",
      localStorage.getItem("debug")
    );
  }
}

// API configuration
export const apiBaseUrl = "/api"; // Use relative path for Next.js API routes

/**
 * Construct API URL from endpoint
 */
const constructApiUrl = (endpoint: string): string => {
  // If endpoint already starts with apiBaseUrl or is a full URL, return as is
  if (endpoint.startsWith(apiBaseUrl) || endpoint.startsWith("http")) {
    return endpoint;
  }

  // Remove any leading slashes from the endpoint
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  // Simply join the base path and the cleaned endpoint
  return `${apiBaseUrl}/${cleanEndpoint}`;
};

/**
 * Fetch options interface
 */
export interface FetchOptions {
  method?: string;
  body?: any;
  headers?: any;
  requireAuth?: boolean;
  returnEmptyOnError?: boolean;
  defaultValue?: any;
  autoRefreshToken?: boolean;
}

/**
 * Generic fetch wrapper with authentication and error handling
 */
export const fetcher = async <T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> => {
  const {
    method = "GET",
    body,
    headers: additionalHeaders = {},
    requireAuth = false,
    returnEmptyOnError = false,
    defaultValue = null,
    autoRefreshToken = true,
  } = options;

  try {
    // Determine the full URL
    const fullUrl = url.startsWith("http") ? url : constructApiUrl(url);

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    // Add auth token if needed
    if (requireAuth) {
      const token = getToken();
      if (!token) {
        console.error(
          "Authentication required but no token available for URL:",
          fullUrl
        );
        throw new Error("Authentication required. Please log in.");
      }
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Log the request for debugging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.debug(`API Request: ${method} ${fullUrl}`);
      if (method !== "GET" && body) {
        console.debug(
          "Request body:",
          typeof body === "string" ? body : JSON.stringify(body)
        );
      }
      console.debug("Request headers:", headers);
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
      credentials: "include", // Include cookies
    };

    // Add body if not GET
    if (method !== "GET" && body) {
      requestOptions.body =
        typeof body === "string" ? body : JSON.stringify(body);
    }

    // Execute fetch
    const response = await fetch(fullUrl, requestOptions);

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    // Parse response
    let data: any;
    if (response.status === 204) {
      // Handle No Content
      data = null;
    } else if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Log the response for debugging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.debug(`API Response: ${response.status} ${response.statusText}`);
      if (isJson) {
        console.debug("Response data:", data);
      }
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage =
        isJson && data.error ? data.error :
        isJson && data.message ? data.message : 
        `API error: ${response.status}`;
      
      console.error(`API Error: ${errorMessage}`, {
        status: response.status,
        data,
      });

      // Handle database unavailable (503) responses for non-auth requests
      if (response.status === 503 && isJson && data.code === "DB_UNAVAILABLE") {
        console.warn("Database unavailable (temporary error)");

        // For routes that should work without authentication, return empty data
        if (!requireAuth && returnEmptyOnError) {
          console.info(
            `Returning empty default data for ${url} due to database unavailability`
          );
          return (Array.isArray(defaultValue) ? [] : defaultValue) as T;
        }
      }

      // Handle authentication errors with token refresh if enabled
      if (response.status === 401 && requireAuth && autoRefreshToken) {
        console.warn("Authentication error - attempting token refresh");

        // Import refreshToken dynamically to avoid circular dependencies
        const { refreshToken } = await import("../frontend-auth");
        const refreshed = await refreshToken();

        if (refreshed) {
          console.log("Token refreshed, retrying request");
          // Retry the request with the new token (but don't auto-refresh again to avoid loops)
          return fetcher<T>(url, {
            ...options,
            autoRefreshToken: false, // Prevent infinite refresh loops
          });
        } else {
          console.error("Token refresh failed");
          throw new Error("Authentication failed. Please log in again.");
        }
      }

      // Throw error with detailed message and response data
      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.response = data; // Include the full response data
      throw error;
    }

    return data as T;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`API request failed: ${errorMessage}`, {
      url,
      options,
      stack: error instanceof Error ? error.stack : "No stack trace",
      type: error instanceof Error ? error.constructor.name : typeof error,
    });

    if (returnEmptyOnError) {
      return defaultValue as T;
    }

    throw error;
  }
};

/**
 * Authenticated fetcher wrapper
 */
export const fetcherAuth = async (url: string, options: RequestInit = {}) => {
  // Get token and add to headers
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Include cookies for auth
  });

  if (!response.ok) {
    const error: any = new Error(
      `API error: ${response.status} ${response.statusText}`
    );
    error.status = response.status;

    // Try to parse error response as JSON, but don't fail if it's not valid JSON
    try {
      error.info = await response.json();
    } catch (jsonError) {
      error.info = { message: "Could not parse error response" };
      error.responseText = await response.text().catch(() => "");
    }

    throw error;
  }

  // For successful responses, safely parse JSON
  try {
    return await response.json();
  } catch (jsonError) {
    console.warn("Response was not valid JSON:", jsonError);
    return {}; // Return empty object instead of failing
  }
};

/**
 * Handle API errors
 */
export const handleApiError = (error: any) => {
  console.error("API error:", error);
  throw error;
}; 