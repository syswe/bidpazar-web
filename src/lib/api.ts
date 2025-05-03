import { getToken } from "./frontend-auth";
import { env } from './env';

// Add window.__ENV__ interface to fix TypeScript error
declare global {
  interface Window {
    __ENV__?: {
      NEXT_PUBLIC_API_URL?: string;
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_SOCKET_URL?: string;
      NEXT_PUBLIC_WEBRTC_SERVER?: string;
    };
  }
}

// Log API URL for clarity
console.log("--- Environment Variables ---");
console.log(`env.API_URL: ${env.API_URL}`);
console.log(`env.SOCKET_URL: ${env.SOCKET_URL}`);
console.log("-----------------------------");

// URL constants - clearly named for their intended use
export const apiBaseUrl = env.API_URL;         // For Next.js API routes

// Log API URL configuration for debugging purposes
console.log("API configuration:");
console.log(`NEXT_PUBLIC_API_URL env: ${process.env.NEXT_PUBLIC_API_URL}`);
console.log(`window.__ENV__?.NEXT_PUBLIC_API_URL: ${typeof window !== 'undefined' ? window.__ENV__?.NEXT_PUBLIC_API_URL : 'N/A (server)'}`);
console.log(`Using API_URL: ${apiBaseUrl}`);
console.log(`Environment mode: ${process.env.NODE_ENV}`);

// Helper function to ensure proper URL construction for Next.js API routes
const constructApiUrl = (endpoint: string): string => {
  // Remove any leading slashes from the endpoint
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  // Get the base URL without the trailing slash
  const baseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  
  // If endpoint already starts with 'api/', we need to prevent duplication
  let finalUrl = '';
  if (cleanEndpoint.startsWith('api/')) {
    // Extract the part after 'api/'
    const endpointWithoutApi = cleanEndpoint.substring(4);
    
    // Check if baseUrl already ends with '/api'
    if (baseUrl.endsWith('/api')) {
      finalUrl = `${baseUrl}/${endpointWithoutApi}`; 
    } else {
      finalUrl = `${baseUrl}/api/${endpointWithoutApi}`;
    }
  } else {
    // Normal case - endpoint doesn't include 'api/'
    // Check if baseUrl already includes '/api'
    if (baseUrl.endsWith('/api')) {
      finalUrl = `${baseUrl}/${cleanEndpoint}`;
    } else {
      finalUrl = `${baseUrl}/api/${cleanEndpoint}`;
    }
  }
  
  // Log for debugging
  console.debug(`[API] Constructed URL: ${finalUrl} from endpoint: ${endpoint}`);
  
  return finalUrl;
};

// Test URL construction
const testUrl = constructApiUrl('products');
console.log(`Test URL construction for 'products': ${testUrl}`);
const testUrl2 = constructApiUrl('api/products');
console.log(`Test URL construction for 'api/products': ${testUrl2}`);

// Tip tanımlamaları
export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMedia {
  id: string;
  url: string;
  type: string; // "image" veya "video"
  productId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  userId: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    name?: string;
  };
  category?: Category;
  images?: ProductMedia[];
}

// Kullanıcı tipi
export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  phoneNumber?: string;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

// LiveStream related types
export interface LiveStream {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  viewerCount: number;
  startTime?: string;
  endTime?: string;
  userId: string;
  user?: User;
  listings?: AuctionListing[];
  chatMessages?: ChatMessage[];
  _count?: {
    listings: number;
    viewers: number;
    chatMessages?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuctionListing {
  id: string;
  productId: string;
  liveStreamId: string;
  startPrice: number;
  status: "PENDING" | "ACTIVE" | "COUNTDOWN" | "COMPLETED" | "CANCELLED";
  countdownTime: number;
  countdownStart?: string;
  countdownEnd?: string;
  winningBidId?: string;
  product?: Product;
  liveStream?: LiveStream;
  bids?: Bid[];
  winningBid?: Bid;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  id: string;
  amount: number;
  listingId: string;
  userId: string;
  isWinning: boolean;
  isBackup: boolean;
  backupForId?: string;
  user?: {
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  userId: string;
  liveStreamId: string;
  user?: {
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Generic fetch wrapper with authentication and error handling (Simplified)
 * Handles relative paths (assumed to be Next.js API routes) and absolute URLs.
 */
export const fetcher = async <T>(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: any;
    requireAuth?: boolean;
    returnEmptyOnError?: boolean;
    defaultValue?: T;
    autoRefreshToken?: boolean;
  } = {},
  overrideUrl: boolean | string = false
): Promise<T> => {
  const {
    method = "GET",
    body,
    headers: additionalHeaders = {},
    requireAuth = false,
    returnEmptyOnError = false,
    defaultValue = null,
    autoRefreshToken = true, // By default, try to refresh token on 401
  } = options;

  try {
    // Determine the full URL
    let fullUrl: string;
    if (overrideUrl && typeof overrideUrl === "string") {
      fullUrl = overrideUrl;
    } else if (url.startsWith("http")) {
      fullUrl = url; // Absolute URL
    } else {
      // Assume relative URL is for Next.js API
      fullUrl = constructApiUrl(url);
    }

    // Get token if authentication is required
    let token = null;
    if (requireAuth) {
      token = getToken();
      if (!token) {
        console.error("Authentication required but no token available");
        throw new Error("Authentication required. Please log in.");
      }
    }

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    // Add auth token if available
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Log the request for debugging (only in development)
    if (process.env.NODE_ENV === "development") {
      console.debug(`API Request: ${method} ${fullUrl}`);
      if (method !== "GET" && body) {
        console.debug("Request body:", typeof body === "string" ? body : JSON.stringify(body));
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
    if (isJson) {
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
      const errorMessage = isJson && data.message ? data.message : `API error: ${response.status}`;
      console.error(`API Error: ${errorMessage}`, { status: response.status, data });
      
      // Handle authentication errors with token refresh if enabled
      if (response.status === 401 && requireAuth && autoRefreshToken) {
        console.warn("Authentication error - attempting token refresh");
        
        // Import refreshToken dynamically to avoid circular dependencies
        const { refreshToken } = await import('./frontend-auth');
        const refreshed = await refreshToken();
        
        if (refreshed) {
          console.log("Token refreshed, retrying request");
          // Retry the request with the new token (but don't auto-refresh again to avoid loops)
          return fetcher<T>(url, {
            ...options,
            autoRefreshToken: false, // Prevent infinite refresh loops
          }, overrideUrl);
        } else {
          console.error("Token refresh failed");
          throw new Error("Authentication failed. Please log in again.");
        }
      }
      
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`API request failed: ${errorMessage}`, { 
      url, 
      options,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    if (returnEmptyOnError) {
      return defaultValue as T;
    }
    
    throw error;
  }
};

// Kategori işlemleri
export const getCategories = async (): Promise<Category[]> => {
  return fetcher<Category[]>(`categories`, {
    returnEmptyOnError: true,
    defaultValue: []
  });
};

export const getCategoryById = async (id: string): Promise<Category> => {
  return fetcher<Category>(`categories/${id}`);
};

export const createCategory = async (data: {
  name: string;
  description?: string;
}): Promise<Category> => {
  return fetcher<Category>("categories", {
    method: "POST",
    body: JSON.stringify(data),
    requireAuth: true,
  });
};

export const updateCategory = async (
  id: string,
  data: {
    name?: string;
    description?: string;
  }
): Promise<Category> => {
  return fetcher<Category>(`categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteCategory = async (id: string): Promise<void> => {
  return fetcher<void>(`categories/${id}`, {
    method: "DELETE",
  });
};

// Ürün işlemleri
export const getProducts = async (): Promise<Product[]> => {
  // Use the correct API path (apiBaseUrl) to prevent double 'api' in the URL
  // Also add returnEmptyOnError and specify a defaultValue for robustness
  return fetcher<Product[]>('products', {
    returnEmptyOnError: true,
    defaultValue: []
  }, `${apiBaseUrl}/products`); // Pass explicit URL to avoid path construction issues
};

export const getProductById = async (id: string): Promise<Product> => {
  return fetcher<Product>(`products/${id}`);
};

export const getProductsByCategory = async (categoryId: string): Promise<Product[]> => {
  return fetcher<Product[]>(`products/category/${categoryId}`, {
    returnEmptyOnError: true,
    defaultValue: []
  });
};

export const getUserProducts = async (): Promise<Product[]> => {
  return fetcher<Product[]>(`products/user`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: []
  });
};

export const createProduct = async (data: {
  title: string;
  description: string;
  price: number;
  categoryId: string;
}): Promise<Product> => {
  return fetcher<Product>("products", {
    method: "POST",
    body: data,
    requireAuth: true,
  });
};

export const updateProduct = async (
  id: string,
  data: {
    title?: string;
    description?: string;
    price?: number;
    categoryId?: string;
  }
): Promise<Product> => {
  return fetcher<Product>(`products/${id}`, {
    method: "PUT",
    body: data,
    requireAuth: true,
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  return fetcher<void>(`products/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
};

export const addProductMedia = async (
  id: string,
  data: { url: string; type: string }
): Promise<ProductMedia> => {
  return fetcher<ProductMedia>(`products/${id}/media`, {
    method: "POST",
    body: data,
    requireAuth: true,
  });
};

// Admin işlemleri
export const getAllUsers = async (): Promise<User[]> => {
  return fetcher<User[]>(`users`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: []
  });
};

export const getUserById = async (id: string): Promise<User> => {
  return fetcher<User>(`users/${id}`, { requireAuth: true });
};

export const updateUser = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    username?: string;
    phoneNumber?: string;
    isVerified?: boolean;
    isAdmin?: boolean;
  }
): Promise<User> => {
  return fetcher<User>(`users/${id}`, {
    method: "PUT",
    body: data,
    requireAuth: true,
  });
};

export const deleteUser = async (id: string): Promise<void> => {
  return fetcher<void>(`users/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
};

export const makeAdmin = async (id: string): Promise<User> => {
  return fetcher<User>(`users/${id}/make-admin`, {
    method: "POST",
    requireAuth: true,
  });
};

export const removeAdmin = async (id: string): Promise<User> => {
  return fetcher<User>(`users/${id}/remove-admin`, {
    method: "POST",
    requireAuth: true,
  });
};

// File upload functions
export const uploadProductImages = async (
  id: string,
  files: File[]
): Promise<ProductMedia[]> => {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append("images", file);
  });

  const response = await fetch(
    `${apiBaseUrl}/products/${id}/upload/images`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to upload images");
  }

  return data.media;
};

export const uploadProductVideos = async (
  id: string,
  files: File[]
): Promise<ProductMedia[]> => {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append("videos", file);
  });

  const response = await fetch(
    `${apiBaseUrl}/products/${id}/upload/videos`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to upload videos");
  }

  return data.media;
};

// LiveStream API functions
export const getLiveStreams = async (): Promise<LiveStream[]> => {
  return fetcher<LiveStream[]>(`live-streams`, {
    returnEmptyOnError: true,
    defaultValue: []
  });
};

export const getLiveStreamById = async (id: string): Promise<LiveStream> => {
  return fetcher<LiveStream>(`live-streams/${id}`);
};

export const getUserLiveStreams = async (): Promise<LiveStream[]> => {
  return fetcher<LiveStream[]>(`live-streams/user/streams`, { requireAuth: true });
};

export const createLiveStream = async (
  data: {
    title: string;
    description?: string;
    thumbnailUrl?: string;
    startTime?: string;
  },
  token?: string
): Promise<LiveStream> => {
  const authToken = token || getToken();
  if (!authToken) {
    throw new Error('No authentication token available');
  }
  return fetcher(`live-streams`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    requireAuth: true,
  });
};

export const startLiveStream = async (
  id: string,
  token: string
): Promise<LiveStream> => {
  const response = await fetch(`${apiBaseUrl}/live-streams/${id}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to start live stream");
  }

  return response.json();
};

export const endLiveStream = async (
  id: string,
  token: string
): Promise<LiveStream> => {
  try {
    if (!token) {
      throw new Error("Token is required to end a live stream");
    }

    // Always try to update stream status in the API server
    return fetcher<LiveStream>(`${apiBaseUrl}/live-streams/${id}/end`, {
      method: "POST",
      headers: { // fetcher adds Authorization header automatically
        "Content-Type": "application/json",
      },
      requireAuth: true // Ensure token is included by fetcher
    });
  } catch (error) {
    console.error("Error ending stream:", error);
    throw error;
  }
};

export const deleteLiveStream = async (id: string): Promise<void> => {
  try {
    console.log(`Attempting to delete stream with ID: ${id}`);

    // Use the fetcher helper with the apiBaseUrl
    await fetcher<void>(`${apiBaseUrl}/live-streams/${id}`, {
      method: "DELETE",
      requireAuth: true // fetcher handles the token
    });

    console.log("Stream deleted successfully");

  } catch (error) {
    console.error("Error deleting live stream:", error);
    throw error; // Re-throw the error for the caller to handle
  }
};

export const addListingToLiveStream = async (
  liveStreamId: string,
  data: {
    productId: string;
    startPrice: number;
    countdownTime?: number;
  },
  token: string
): Promise<AuctionListing> => {
  return fetcher<AuctionListing>(
    `${apiBaseUrl}/live-streams/${liveStreamId}/listings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization is handled by fetcher
      },
      body: data,
      requireAuth: true // Ensure token is added by fetcher
    }
  );
};

export const getStreamVideo = async (streamId: string): Promise<{
  message: string;
  streamId: string;
  status: string;
  wsEndpoint: string;
}> => {
  return fetcher<{ message: string; streamId: string; status: string; wsEndpoint: string; }>(
    `${apiBaseUrl}/stream/${streamId}/video`,
    {
      method: 'GET',
      requireAuth: true
    }
  );
};

// Message and Conversation interfaces
export interface Conversation {
  id: string;
  updatedAt: string;
  createdAt: string;
  latestMessage?: Message;
  participants: {
    id: string;
    username: string;
    name?: string;
  }[];
  _count?: {
    messages: number;
  };
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    username: string;
    name?: string;
  };
}

export interface Notification {
  id: string;
  content: string;
  type: 'MESSAGE' | 'BID_WON' | 'BID_OUTBID' | 'SYSTEM';
  isRead: boolean;
  relatedId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Message API functions
export const getUserConversations = async (): Promise<Conversation[]> => {
  return fetcher<Conversation[]>(`messages/conversations`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: []
  });
};

export const getConversationMessages = async (
  conversationId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ messages: Message[]; totalCount: number }> => {
  return fetcher<{ messages: Message[]; totalCount: number }>(
    `messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    { requireAuth: true }
  );
};

export const getOrCreateConversation = async (
  otherUserId: string
): Promise<Conversation> => {
  return fetcher<Conversation>(`messages/conversations/${otherUserId}`, { requireAuth: true });
};

export const getConversationDetails = async (
  conversationId: string
): Promise<Conversation> => {
  return fetcher<Conversation>(`messages/conversations/details/${conversationId}`);
};

export const sendMessage = async (
  conversationId: string,
  content: string,
  receiverId: string
): Promise<Message> => {
  return fetcher<Message>('messages/messages', {
    method: 'POST',
    body: { conversationId, content, receiverId },
    requireAuth: true
  });
};

export const findUserByUsername = async (
  username: string
): Promise<User | null> => {
  return fetcher<User | null>(`users/byUsername/${username}`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: null
  });
};

// Notification API functions
export const getUserNotifications = async (): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> => {
  return fetcher<{ notifications: Notification[]; unreadCount: number; }>(`notifications`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: { notifications: [], unreadCount: 0 }
  });
};

export const markNotificationsAsRead = async (): Promise<{ success: boolean }> => {
  return fetcher<{ success: boolean }>(`notifications/read`, {
    method: 'POST',
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: { success: false }
  });
};

// Health API functions
export const healthCheck = async (): Promise<{ status: string }> => {
  return fetcher<{ status: string }>('health', {}, true);
};

export const detailedHealthCheck = async (): Promise<{
  status: string;
  database: string;
  uptime: number;
  memory: object;
  env: string;
}> => {
  return fetcher<{
    status: string;
    database: string;
    uptime: number;
    memory: object;
    env: string;
  }>('health/detailed');
};

export const socketHealthCheck = async (): Promise<{
  status: string;
  activeConnections: number;
}> => {
  return fetcher<{ status: string; activeConnections: number }>('health/socket');
};

// Diagnostics API functions
export const diagnosticsHealth = async (): Promise<{ status: string; timestamp: string }> => {
  return fetcher<{ status: string; timestamp: string }>('/diagnostics/health');
};

export const testBandwidth = async (sizeKB: number = 100): Promise<Blob> => {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const url = constructApiUrl(`/diagnostics/test-bandwidth?size=${sizeKB}`);
  
  const response = await fetch(url, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error('Failed to perform bandwidth test');
  }
  
  return response.blob();
};

export const getConnectionStats = async (): Promise<{
  activeConnections: number;
  serverLoad: {
    cpu: object;
    memory: object;
    uptime: number;
  };
  timestamp: string;
}> => {
  return fetcher<{
    activeConnections: number;
    serverLoad: {
      cpu: object;
      memory: object;
      uptime: number;
    };
    timestamp: string;
  }>('/diagnostics/connection-stats');
};

export const getRateLimitStatus = async (): Promise<{
  isRateLimited: boolean;
  rateLimitedUntil: string | null;
  connectionCount: number;
  maxConnections: number;
  ipAddress: string;
  timestamp: string;
}> => {
  return fetcher<{
    isRateLimited: boolean;
    rateLimitedUntil: string | null;
    connectionCount: number;
    maxConnections: number;
    ipAddress: string;
    timestamp: string;
  }>('/diagnostics/rate-limit-status');
};

// Additional Auth API functions
export const requestVerificationCode = async (
  email: string
): Promise<{ message: string; userId: string; phoneNumber?: string }> => {
  return fetcher<{ message: string; userId: string; phoneNumber?: string }>(
    '/auth/request-verification',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    }
  );
};

// Additional Product API functions
export const deleteProductMedia = async (mediaId: string): Promise<void> => {
  return fetcher<void>(`/api/products/media/${mediaId}`, {
    method: 'DELETE',
  });
};

// Additional LiveStream API functions
export const getActiveListing = async (
  liveStreamId: string
): Promise<AuctionListing | null> => {
  return fetcher<AuctionListing | null>(`live-streams/${liveStreamId}/active-listing`);
};

export const checkIsStreamer = async (
  liveStreamId: string
): Promise<{ isStreamer: boolean }> => {
  return fetcher<{ isStreamer: boolean }>(`live-streams/${liveStreamId}/check-streamer`);
};

export const addBidToListing = async (
  listingId: string,
  amount: number
): Promise<Bid> => {
  return fetcher<Bid>(`live-streams/listings/${listingId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
    requireAuth: true,
  });
};

export const testSocketConnection = async (): Promise<{
  status: string;
  message: string;
  socketEnabled: boolean;
  path: string;
  timestamp: number;
}> => {
  return fetcher<{
    status: string;
    message: string;
    socketEnabled: boolean;
    path: string;
    timestamp: number;
  }>('live-streams/socket-test');
};

export const addSimplifiedListingToLiveStream = async (
  liveStreamId: string,
  data: {
    productId: string;
    startPrice: number;
    countdownTime?: number;
  }
): Promise<AuctionListing> => {
  return fetcher<AuctionListing>(`live-streams/${liveStreamId}/listings/simplified`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * HTTP methods for use with API requests
 */
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
} as const;
