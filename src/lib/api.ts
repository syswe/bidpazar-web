import { getToken } from "./auth";
import { env } from './env';

// Log both backend and frontend API URLs for clarity
console.log("--- Environment Variables ---");
console.log(`env.BACKEND_API_URL: ${env.BACKEND_API_URL}`);
console.log(`env.API_URL (Next.js API base): ${env.API_URL}`);
console.log(`env.SOCKET_URL: ${env.SOCKET_URL}`);
console.log("-----------------------------");

// Example usage (can be removed if not needed)
export const backendBaseUrl = env.BACKEND_API_URL;
export const frontendApiBaseUrl = env.API_URL;

// Use the API_URL from our env utility
const API_URL = env.API_URL;

// Log API URL configuration for debugging purposes
console.log("API configuration:");
console.log(`NEXT_PUBLIC_API_URL env: ${process.env.NEXT_PUBLIC_API_URL}`);
console.log(`window.__ENV__?.NEXT_PUBLIC_API_URL: ${typeof window !== 'undefined' ? window.__ENV__?.NEXT_PUBLIC_API_URL : 'N/A (server)'}`);
console.log(`Using API_URL: ${API_URL}`);
console.log(`Environment mode: ${process.env.NODE_ENV}`);

// Helper function to ensure proper URL construction
const constructApiUrl = (endpoint: string): string => {
  // Remove any leading slashes from the endpoint
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  // Remove any trailing slashes from the API_URL
  const baseUrl = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;

  return `${baseUrl}/${cleanEndpoint}`;
};

// Function to get a browser-compatible URL (replaces Docker hostnames with localhost)
const getBrowserCompatibleUrl = (url: string): string => {
  if (typeof window === 'undefined') {
    // We're on the server, return the URL as is
    return url;
  }
  
  // In browser, ensure Docker hostnames are replaced with localhost
  return url
    .replace(/http:\/\/api:/, 'http://localhost:')
    .replace(/http:\/\/backend:/, 'http://localhost:')
    .replace(/ws:\/\/api:/, 'ws://localhost:')
    .replace(/ws:\/\/backend:/, 'ws://localhost:');
};

// Verify API URL format
if (!API_URL.includes("/api")) {
  console.warn(
    'WARNING: API_URL may be misconfigured - missing "/api" path segment'
  );
}

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

// API istekleri için genel yardımcı fonksiyon
const fetcher = async <T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers || {}),
  };

  try {
    // Get original URL from the env config
    const originalUrl = constructApiUrl(endpoint);
    // Get browser-compatible URL (replaces Docker hostnames if needed)
    const url = getBrowserCompatibleUrl(originalUrl);
    
    console.log(`[DEBUG] Fetcher making request to: ${url}`);
    console.log(`[DEBUG] Request method: ${options?.method || 'GET'}`);
    console.log(`[DEBUG] Authorization header present: ${!!token}`);

    // Determine credentials mode based on environment
    // In development, we always include credentials
    // In production, only include credentials for same-origin or specified domains
    const credentialsMode = process.env.NODE_ENV === 'development' 
      ? 'include' 
      : 'same-origin';

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        // Use consistent cors mode and credentials policy
        mode: 'cors',
        credentials: credentialsMode,
      });

      console.log(
        `[DEBUG] Fetcher got response: ${response.status} ${response.statusText}`
      );

      // Check content type and status first
      const contentType = response.headers.get("content-type");
      console.log(`[DEBUG] Fetcher response content-type: ${contentType}`);
      
      // Standard response handling logic
      if (!response.ok) {
        // For error responses, try to parse as JSON first
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          console.error("[DEBUG] Fetcher received JSON error:", errorData);
          throw new Error(
            errorData.message || errorData.error || "API isteği başarısız oldu"
          );
        } else {
          // If not JSON, handle as text
          const errorText = await response.text();
          console.error("[DEBUG] Fetcher received non-JSON error:", errorText);
          throw new Error(
            `API isteği başarısız oldu: ${response.status} ${response.statusText}`
          );
        }
      }

      // For OK responses where content is expected
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log(`[DEBUG] Fetcher received JSON data:`, data);
        return data as T;
      }

      // Handle empty responses or non-JSON responses
      if (response.status === 204 || !contentType) {
        console.log(`[DEBUG] Fetcher received no content (204 or no content-type)`);
        return {} as T; // No content expected
      }

      // Default case - still try to parse as JSON, but log a warning
      console.warn(
        `[DEBUG] Unexpected content type: ${contentType} for successful response`
      );
      try {
        return (await response.json()) as T;
      } catch (e) {
        console.error("[DEBUG] Failed to parse response as JSON:", e);
        throw new Error("Invalid response format");
      }
      
    } catch (fetchError) {
      // If the error might be due to hostname resolution, try with localhost
      if (url.includes('http://api:') || url.includes('ws://api:') ||
          url.includes('http://backend:') || url.includes('ws://backend:')) {
        
        console.warn('[DEBUG] Failed to connect to container hostname, trying with localhost instead');
        
        // Replace with localhost and retry
        const localhostUrl = url
          .replace(/http:\/\/api:/, 'http://localhost:')
          .replace(/http:\/\/backend:/, 'http://localhost:')
          .replace(/ws:\/\/api:/, 'ws://localhost:')
          .replace(/ws:\/\/backend:/, 'ws://localhost:');
          
        console.log(`[DEBUG] Retrying with URL: ${localhostUrl}`);
        
        // Try again with the fallback URL
        const retryResponse = await fetch(localhostUrl, {
          ...options,
          headers,
          mode: 'cors',
          credentials: credentialsMode,
        });
        
        console.log(`[DEBUG] Retry response: ${retryResponse.status} ${retryResponse.statusText}`);
        
        // Process the retry response
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new Error(`API isteği başarısız oldu: ${retryResponse.status} ${retryResponse.statusText}`);
        }
        
        const data = await retryResponse.json();
        console.log(`[DEBUG] Retry succeeded, received data:`, data);
        return data as T;
      }
      
      // If not a hostname issue or retrying failed, rethrow
      throw fetchError;
    }
  } catch (error) {
    console.error("[DEBUG] Fetcher error:", error);
    throw error;
  }
};

// Kategori işlemleri
export const getCategories = async (): Promise<Category[]> => {
  return fetcher<Category[]>("/categories");
};

export const getCategoryById = async (id: string): Promise<Category> => {
  return fetcher<Category>(`/categories/${id}`);
};

export const createCategory = async (data: {
  name: string;
  description?: string;
}): Promise<Category> => {
  return fetcher<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateCategory = async (
  id: string,
  data: {
    name?: string;
    description?: string;
  }
): Promise<Category> => {
  return fetcher<Category>(`/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteCategory = async (id: string): Promise<void> => {
  return fetcher<void>(`/categories/${id}`, {
    method: "DELETE",
  });
};

// Ürün işlemleri
export const getProducts = async (): Promise<Product[]> => {
  return fetcher<Product[]>("/products");
};

export const getProductById = async (id: string): Promise<Product> => {
  const response = await fetch(`${API_URL}/products/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch product");
  }
  return response.json();
};

export const getProductsByCategory = async (
  categoryId: string
): Promise<Product[]> => {
  return fetcher<Product[]>(`/products/category/${categoryId}`);
};

export const getUserProducts = async (): Promise<Product[]> => {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required to fetch your products");
  }

  return fetcher<Product[]>(`/products/user`);
};

export const createProduct = async (data: {
  title: string;
  description: string;
  price: number;
  categoryId: string;
}): Promise<Product> => {
  return fetcher<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
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
  return fetcher<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  return fetcher<void>(`/products/${id}`, {
    method: "DELETE",
  });
};

export const addProductMedia = async (
  productId: string,
  data: { url: string; type: string }
): Promise<ProductMedia> => {
  return fetcher<ProductMedia>(`/products/${productId}/media`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// Admin işlemleri
export const getAllUsers = async (): Promise<User[]> => {
  return fetcher<User[]>("/users");
};

export const getUserById = async (id: string): Promise<User> => {
  return fetcher<User>(`/users/${id}`);
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
  return fetcher<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteUser = async (id: string): Promise<void> => {
  return fetcher<void>(`/users/${id}`, {
    method: "DELETE",
  });
};

export const makeAdmin = async (id: string): Promise<User> => {
  return fetcher<User>(`/users/${id}/make-admin`, {
    method: "POST",
  });
};

export const removeAdmin = async (id: string): Promise<User> => {
  return fetcher<User>(`/users/${id}/remove-admin`, {
    method: "POST",
  });
};

// File upload functions
export const uploadProductImages = async (
  productId: string,
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
    `${API_URL}/products/${productId}/upload/images`,
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
  productId: string,
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
    `${API_URL}/products/${productId}/upload/videos`,
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
  const response = await fetch(`${API_URL}/live-streams`);
  if (!response.ok) {
    throw new Error("Failed to fetch live streams");
  }
  return response.json();
};

export const getLiveStreamById = async (id: string): Promise<LiveStream> => {
  const response = await fetch(`${API_URL}/live-streams/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch live stream");
  }
  return response.json();
};

export const getUserLiveStreams = async (): Promise<LiveStream[]> => {
  const token = getToken();
  if (!token) {
    throw new Error("Authentication required to fetch your streams");
  }

  return fetcher<LiveStream[]>(`/live-streams/user/streams`);
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
  return fetcher(`/live-streams`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
};

export const startLiveStream = async (
  id: string,
  token: string
): Promise<LiveStream> => {
  const response = await fetch(`${API_URL}/live-streams/${id}/start`, {
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

    // Try to end the stream on WebRTC server, but don't fail if it's not available
    const webrtcServer = env.WEBRTC_SERVER;
    if (webrtcServer) {
      try {
        const response = await fetch(`${webrtcServer}/stream/${id}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.warn(
            "Warning: Failed to end stream on WebRTC server, but continuing with API server update"
          );
        } else {
          console.log("Successfully ended stream on WebRTC server");
        }
      } catch (webRtcError) {
        console.warn("WebRTC server might not be available:", webRtcError);
        // Continue execution - don't throw here
      }
    } else {
      console.warn(
        "NEXT_PUBLIC_WEBRTC_SERVER environment variable not defined, skipping WebRTC server notification"
      );
    }

    // Always try to update stream status in the API server
    return fetcher<LiveStream>(`/live-streams/${id}/end`, {
      method: "POST",
    });
  } catch (error) {
    console.error("Error ending stream:", error);
    throw error;
  }
};

export const deleteLiveStream = async (id: string): Promise<void> => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error("Authentication required to delete a stream");
    }

    console.log(`Attempting to delete stream with ID: ${id}`);
    console.log(`API_URL is: ${API_URL}`); // Debug log to verify API_URL

    // Try both ways to delete the stream - direct fetch and our helper
    try {
      // First attempt - direct fetch with improved URL handling
      // Make sure we're using the correct API URL format
      const apiUrl = API_URL.endsWith("/")
        ? `${API_URL}live-streams/${id}`
        : `${API_URL}/live-streams/${id}`;

      console.log(`Sending DELETE request to: ${apiUrl}`); // Debug log

      const directResponse = await fetch(apiUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (directResponse.ok) {
        console.log("Stream deleted successfully via direct fetch");
        // If successful, return early
        return;
      }

      // Check the response status code
      console.log(`Response status code: ${directResponse.status}`);
      console.log(`Response status text: ${directResponse.statusText}`);

      // Check if the response is JSON before trying to parse it
      const contentType = directResponse.headers.get("content-type");
      console.log(`Content-Type of response: ${contentType}`);

      if (contentType && contentType.includes("application/json")) {
        // Safe to parse as JSON
        const errorData = await directResponse.json();
        console.error("Server error response:", errorData);
        throw new Error(errorData.message || "Failed to delete stream");
      } else {
        // Not JSON, handle as text
        const errorText = await directResponse.text();
        console.error("Server returned non-JSON response:", errorText);

        // Check if we're getting a 404 which likely means incorrect endpoint
        if (directResponse.status === 404) {
          throw new Error(
            `Stream deletion failed: API endpoint not found. Please check server configuration.`
          );
        } else {
          throw new Error(
            `Server error (${directResponse.status}): ${
              directResponse.statusText || "Unknown error"
            }`
          );
        }
      }
    } catch (innerError) {
      console.error("First deletion attempt failed:", innerError);

      // Try the second method as a fallback with better error handling
      try {
        console.log(`Trying fallback method with fetcher helper`);
        return await fetcher<void>(`/live-streams/${id}`, {
          method: "DELETE",
        });
      } catch (fetcherError) {
        console.error("Second deletion attempt failed:", fetcherError);
        throw fetcherError;
      }
    }
  } catch (error) {
    console.error("Error deleting live stream:", error);
    throw error;
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
  const response = await fetch(
    `${API_URL}/live-streams/${liveStreamId}/listings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add listing to live stream");
  }

  return response.json();
};

export const getStreamVideo = async (streamId: string): Promise<{
  message: string;
  streamId: string;
  status: string;
  wsEndpoint: string;
}> => {
  const response = await fetch(`${API_URL}/stream/${streamId}/video`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get stream video");
  }

  return response.json();
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
  return fetcher<Conversation[]>('/messages/conversations');
};

export const getConversationMessages = async (
  conversationId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ messages: Message[]; totalCount: number }> => {
  return fetcher<{ messages: Message[]; totalCount: number }>(
    `/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
  );
};

export const getOrCreateConversation = async (
  otherUserId: string
): Promise<Conversation> => {
  return fetcher<Conversation>(`/messages/conversations/${otherUserId}`);
};

export const getConversationDetails = async (
  conversationId: string
): Promise<Conversation> => {
  return fetcher<Conversation>(`/messages/conversations/details/${conversationId}`);
};

export const sendMessage = async (
  conversationId: string,
  content: string,
  receiverId: string
): Promise<Message> => {
  return fetcher<Message>('/messages/messages', {
    method: 'POST',
    body: JSON.stringify({ conversationId, content, receiverId }),
  });
};

export const findUserByUsername = async (
  username: string
): Promise<User | null> => {
  return fetcher<User | null>(`/messages/find-user/${username}`);
};

// Notification API functions
export const getUserNotifications = async (): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> => {
  return fetcher<{ notifications: Notification[]; unreadCount: number }>('/messages/notifications');
};

export const markNotificationsAsRead = async (): Promise<{ success: boolean }> => {
  return fetcher<{ success: boolean }>('/messages/notifications/read', {
    method: 'POST',
  });
};

// Health API functions
export const healthCheck = async (): Promise<{ status: string }> => {
  return fetcher<{ status: string }>('/health');
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
  }>('/health/detailed');
};

export const socketHealthCheck = async (): Promise<{
  status: string;
  activeConnections: number;
}> => {
  return fetcher<{ status: string; activeConnections: number }>('/health/socket');
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
  const browserUrl = getBrowserCompatibleUrl(url);
  
  const response = await fetch(browserUrl, {
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
  return fetcher<void>(`/products/media/${mediaId}`, {
    method: 'DELETE',
  });
};

// Additional LiveStream API functions
export const getActiveListing = async (
  liveStreamId: string
): Promise<AuctionListing | null> => {
  return fetcher<AuctionListing | null>(`/live-streams/${liveStreamId}/active-listing`);
};

export const checkIsStreamer = async (
  liveStreamId: string
): Promise<{ isStreamer: boolean }> => {
  return fetcher<{ isStreamer: boolean }>(`/live-streams/${liveStreamId}/check-streamer`);
};

export const addBidToListing = async (
  listingId: string,
  amount: number
): Promise<Bid> => {
  return fetcher<Bid>(`/live-streams/listings/${listingId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
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
  }>('/live-streams/socket-test');
};

export const addSimplifiedListingToLiveStream = async (
  liveStreamId: string,
  data: {
    productId: string;
    startPrice: number;
    countdownTime?: number;
  }
): Promise<AuctionListing> => {
  return fetcher<AuctionListing>(`/live-streams/${liveStreamId}/listings/simplified`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
