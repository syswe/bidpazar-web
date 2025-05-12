import { getToken } from "./frontend-auth";
import { env } from "./env";
import { logger } from "./logger";

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

// Enable client-side debugging in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const existingDebug = localStorage.getItem("debug") || "";
  const newDebugScopes = [];

  if (!existingDebug.includes("socket.io-client:*")) {
    newDebugScopes.push("socket.io-client:*");
  }
  if (!existingDebug.includes("mediasoup-client:*")) {
    newDebugScopes.push("mediasoup-client:*");
  }

  if (newDebugScopes.length > 0) {
    localStorage.setItem(
      "debug",
      [existingDebug, ...newDebugScopes].filter(Boolean).join(",")
    );
    console.log(
      "[Dev Logging] Enabled Socket.IO and Mediasoup client debug logs. Current localStorage.debug:",
      localStorage.getItem("debug")
    );
  }
}

// Log API URL for clarity - Keep minimal logging
// console.log("--- Environment Variables ---");
// console.log(`env.API_URL: ${env.API_URL}`);
// console.log(`env.SOCKET_URL: ${env.SOCKET_URL}`);
// console.log("-----------------------------");

// Simplify to always use relative URLs for API endpoints
export const apiBaseUrl = "/api"; // Use relative path for Next.js API routes

// Log API URL configuration for debugging purposes
// console.log("API configuration:");
// console.log(`NEXT_PUBLIC_API_URL env: ${process.env.NEXT_PUBLIC_API_URL}`);
// console.log(`window.__ENV__?.NEXT_PUBLIC_API_URL: ${typeof window !== 'undefined' ? window.__ENV__?.NEXT_PUBLIC_API_URL : 'N/A (server)'}`);
// console.log(`Using API_URL: ${apiBaseUrl}`);
// console.log(`Environment mode: ${process.env.NODE_ENV}`);

// Simplify URL construction - no need for complex logic with full-stack app
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

// Log for debugging
// console.debug(`[API] Test Constructed URL: ${constructApiUrl('products')}`);

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
  images: { id: string; url: string; type: string }[];
  category?: { id: string; name: string };
  user?: {
    id: string;
    username: string;
    name?: string;
  };
  createdAt: string;
  updatedAt: string;
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

export interface ProductAuction {
  id: string;
  productId: string;
  startPrice: number;
  currentPrice: number;
  duration: number; // Duration in days (1, 3, 5, or 7)
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  startTime?: string;
  endTime?: string;
  winningBidId?: string;
  product?: Product;
  bids?: Bid[];
  winningBid?: Bid;
  createdAt: string;
  updatedAt: string;
}

export interface Bid {
  id: string;
  amount: number;
  listingId?: string;
  productAuctionId?: string;
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
  } = {}
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
    // Determine the full URL - simplified
    const fullUrl = url.startsWith("http") ? url : constructApiUrl(url);

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    // Add auth token if needed
    if (requireAuth) {
      const token = getToken(); // Assuming getToken() is still available from frontend-auth
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
        isJson && data.message ? data.message : `API error: ${response.status}`;
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
        const { refreshToken } = await import("./frontend-auth");
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

      throw new Error(errorMessage);
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

// Kategori işlemleri
export const getCategories = async (): Promise<Category[]> => {
  return fetcher<Category[]>(`categories`, {
    returnEmptyOnError: true,
    defaultValue: [],
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
  return fetcher<Product[]>("products", {
    returnEmptyOnError: true,
    defaultValue: [],
  });
};

export const getProductById = async (id: string): Promise<Product> => {
  return fetcher<Product>(`products/${id}`);
};

export const getProductsByCategory = async (
  categoryId: string
): Promise<Product[]> => {
  return fetcher<Product[]>(`products/category/${categoryId}`, {
    returnEmptyOnError: true,
    defaultValue: [],
  });
};

// Add the missing product management functions
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

export interface WonAuction {
  id: string;
  auctionId: string;
  productId: string;
  productName: string;
  productImage: string;
  winDate: string;
  winningBid: number;
  status: string;
  seller: {
    id: string;
    name: string;
    username: string;
  };
  isPaid: boolean;
  isLiveStream: boolean;
  streamId?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    imageUrl: string;
  }[];
}

// Function to handle API errors
const handleApiError = (error: any) => {
  console.error("API error:", error);

  // Let the error propagate without the additional "Unauthorized: Please log in again"
  // This allows the calling function to decide how to handle auth issues
  throw error;
};

// Fetcher for making API calls with auth
const fetcherAuth = async (url: string, options: RequestInit = {}) => {
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

// Get user's products
export async function getUserProducts(): Promise<Product[]> {
  try {
    // Try to get token from localStorage or cookie
    const token = getToken();
    if (!token) {
      console.warn("No authentication token available for getUserProducts");
      return [];
    }

    // First attempt with current token
    try {
      return await fetcherAuth("/api/products/user");
    } catch (error: any) {
      // If unauthorized, try to refresh token once before failing
      if (error.status === 401) {
        console.log(
          "Token expired, attempting refresh before retrying getUserProducts"
        );
        const { refreshToken } = await import("./frontend-auth");
        const refreshed = await refreshToken();

        if (refreshed) {
          // Retry with new token
          console.log("Token refreshed, retrying getUserProducts");
          return await fetcherAuth("/api/products/user");
        } else {
          // Return empty array instead of triggering auth error
          console.warn("Token refresh failed, returning empty products array");
          return [];
        }
      }
      throw error; // Re-throw non-auth errors
    }
  } catch (error) {
    console.error("Error fetching user products:", error);
    // Return empty array instead of error to prevent login loops
    return [];
  }
}

// Get user's won auctions (both types)
export async function getUserWonAuctions(): Promise<WonAuction[]> {
  try {
    // Fetch both types of auctions the user has won
    const [productAuctions, livestreamAuctions] = await Promise.all([
      fetcherAuth("/api/auctions/won"),
      fetcherAuth("/api/listings/won"),
    ]);

    // Process regular auctions
    const processedProductAuctions = productAuctions.map((auction: any) => ({
      id: auction.id,
      auctionId: auction.id,
      productId: auction.product.id,
      productName: auction.product.title,
      productImage:
        auction.product.media?.[0]?.url || "https://via.placeholder.com/150",
      winDate: new Date(auction.updatedAt).toISOString(),
      winningBid: auction.currentPrice,
      status: getAuctionStatus(auction.status),
      seller: {
        id: auction.product.userId,
        name:
          auction.product.user?.name ||
          auction.product.user?.username ||
          "Satıcı",
        username: auction.product.user?.username || "user",
      },
      isPaid: auction.isPaid || false,
      isLiveStream: false,
    }));

    // Process livestream auctions
    const processedLivestreamAuctions = livestreamAuctions.map(
      (listing: any) => ({
        id: listing.id,
        auctionId: listing.id,
        productId: listing.product.id,
        productName: listing.product.title,
        productImage:
          listing.product.media?.[0]?.url || "https://via.placeholder.com/150",
        winDate: new Date(listing.updatedAt).toISOString(),
        winningBid: listing.winningBid?.amount || listing.startPrice,
        status: getListingStatus(listing.status),
        seller: {
          id: listing.product.userId,
          name:
            listing.product.user?.name ||
            listing.product.user?.username ||
            "Satıcı",
          username: listing.product.user?.username || "user",
        },
        isPaid: listing.isPaid || false,
        isLiveStream: true,
        streamId: listing.liveStreamId,
      })
    );

    // Combine both types and sort by win date (newest first)
    return [...processedProductAuctions, ...processedLivestreamAuctions].sort(
      (a, b) => new Date(b.winDate).getTime() - new Date(a.winDate).getTime()
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// Get user's orders
export async function getUserOrders(): Promise<Order[]> {
  try {
    // Since we don't have a dedicated Orders table, we'll use winning bids as orders
    const wonAuctions = await getUserWonAuctions();

    // Transform won auctions into orders format
    return wonAuctions
      .filter((auction) => auction.isPaid) // Only paid auctions are considered orders
      .map((auction, index) => ({
        id: auction.id,
        orderNumber: `BP-${new Date().getFullYear()}-${String(
          index + 1
        ).padStart(3, "0")}`,
        date: auction.winDate,
        total: auction.winningBid,
        status: mapAuctionStatusToOrderStatus(auction.status),
        items: [
          {
            id: auction.productId,
            name: auction.productName,
            quantity: 1,
            price: auction.winningBid,
            imageUrl: auction.productImage,
          },
        ],
      }));
  } catch (error) {
    return handleApiError(error);
  }
}

// Helper functions to map statuses
function getAuctionStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Tamamlandı";
    case "ACTIVE":
      return "İşleniyor";
    case "PENDING":
      return "Beklemede";
    case "CANCELLED":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

function getListingStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "Tamamlandı";
    case "ACTIVE":
      return "İşleniyor";
    case "COUNTDOWN":
      return "İşleniyor";
    case "PENDING":
      return "Beklemede";
    case "CANCELLED":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

function mapAuctionStatusToOrderStatus(status: string): string {
  switch (status) {
    case "Tamamlandı":
      return "Tamamlandı";
    case "İşleniyor":
      return "Kargoda";
    case "Beklemede":
      return "Beklemede";
    case "İptal Edildi":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

// Admin işlemleri
export const getAllUsers = async (): Promise<User[]> => {
  return fetcher<User[]>(`users`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: [],
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
  logger.info("Uploading product images", {
    productId: id,
    fileCount: files.length,
    fileNames: files.map((f) => f.name),
    fileSizes: files.map((f) => f.size),
  });

  const token = getToken();
  if (!token) {
    logger.error("Authentication required for image upload", { productId: id });
    throw new Error("Authentication required");
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
    logger.debug("Added file to form data", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  });

  try {
    logger.debug("Sending image upload request", {
      productId: id,
      endpoint: `${apiBaseUrl}/products/${id}/upload`,
    });

    const response = await fetch(`${apiBaseUrl}/products/${id}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    logger.debug("Received upload response", {
      productId: id,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("Failed to upload images", {
        productId: id,
        status: response.status,
        error: data.error,
      });
      throw new Error(data.error || "Failed to upload images");
    }

    logger.info("Images uploaded successfully", {
      productId: id,
      uploadedCount: data.length,
      mediaIds: data.map((m: any) => m.id),
    });

    return data;
  } catch (error: any) {
    logger.error("Error in uploadProductImages", {
      productId: id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export const uploadProductVideos = async (
  id: string,
  files: File[]
): Promise<ProductMedia[]> => {
  logger.info("Uploading product videos", {
    productId: id,
    fileCount: files.length,
    fileNames: files.map((f) => f.name),
    fileSizes: files.map((f) => f.size),
  });

  const token = getToken();
  if (!token) {
    logger.error("Authentication required for video upload", { productId: id });
    throw new Error("Authentication required");
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
    logger.debug("Added video to form data", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  });

  try {
    logger.debug("Sending video upload request", {
      productId: id,
      endpoint: `${apiBaseUrl}/products/${id}/upload`,
    });

    const response = await fetch(`${apiBaseUrl}/products/${id}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    logger.debug("Received upload response", {
      productId: id,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("Failed to upload videos", {
        productId: id,
        status: response.status,
        error: data.error,
      });
      throw new Error(data.error || "Failed to upload videos");
    }

    logger.info("Videos uploaded successfully", {
      productId: id,
      uploadedCount: data.length,
      mediaIds: data.map((m: any) => m.id),
    });

    return data;
  } catch (error: any) {
    logger.error("Error in uploadProductVideos", {
      productId: id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

// LiveStream API functions
export const getLiveStreams = async (): Promise<LiveStream[]> => {
  return fetcher<LiveStream[]>(`live-streams`, {
    returnEmptyOnError: true,
    defaultValue: [],
  });
};

export const getLiveStreamById = async (id: string): Promise<LiveStream> => {
  return fetcher<LiveStream>(`live-streams/${id}`);
};

export const getUserLiveStreams = async (): Promise<LiveStream[]> => {
  return fetcher<LiveStream[]>(`live-streams/user/streams`, {
    requireAuth: true,
  });
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
    throw new Error("No authentication token available");
  }
  return fetcher(`live-streams`, {
    method: "POST",
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
  return fetcher<LiveStream>(`live-streams/${id}/start`, {
    method: "POST",
    requireAuth: true,
  });
};

export const endLiveStream = async (
  id: string,
  token: string
): Promise<LiveStream> => {
  return await fetcher(`${apiBaseUrl}/live-streams/${id}/end`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateLiveStream = async (
  id: string,
  data: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    status?: "SCHEDULED" | "LIVE" | "ENDED";
  }
): Promise<LiveStream> => {
  return await fetcher(`${apiBaseUrl}/live-streams/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
    requireAuth: true,
  });
};

export const deleteLiveStream = async (id: string): Promise<void> => {
  await fetcher(`${apiBaseUrl}/live-streams/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
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
  return fetcher<AuctionListing>(`live-streams/${liveStreamId}/listings`, {
    method: "POST",
    body: data,
    requireAuth: true, // Ensure token is added by fetcher
  });
};

export const getStreamVideo = async (
  streamId: string
): Promise<{
  message: string;
  streamId: string;
  status: string;
  wsEndpoint: string;
}> => {
  return fetcher<{
    message: string;
    streamId: string;
    status: string;
    wsEndpoint: string;
  }>(
    `stream/${streamId}/video`, // Use relative path
    {
      method: "GET",
      requireAuth: true,
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
  type: "MESSAGE" | "BID_WON" | "BID_OUTBID" | "SYSTEM";
  isRead: boolean;
  relatedId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Message API functions
export const getUserConversations = async (): Promise<Conversation[]> => {
  try {
    console.log("Fetching user conversations...");
    const result = await fetcher<Conversation[]>(`messages/conversations`, {
      requireAuth: true,
      returnEmptyOnError: true,
      defaultValue: [],
    });
    console.log("Fetched conversations result:", result);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
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
  return fetcher<Conversation>(`messages/conversations/${otherUserId}`, {
    requireAuth: true,
  });
};

export const getConversationDetails = async (
  conversationId: string
): Promise<Conversation> => {
  return fetcher<Conversation>(
    `messages/conversations/details/${conversationId}`
  );
};

export const sendMessage = async (
  conversationId: string,
  content: string,
  receiverId: string
): Promise<Message> => {
  return fetcher<Message>("messages/messages", {
    method: "POST",
    body: { conversationId, content, receiverId },
    requireAuth: true,
  });
};

export const findUserByUsername = async (
  username: string
): Promise<User | null> => {
  return fetcher<User | null>(`users/byUsername/${username}`, {
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: null,
  });
};

// Notification API functions
export const getUserNotifications = async (): Promise<{
  notifications: Notification[];
  unreadCount: number;
}> => {
  try {
    console.log("Fetching user notifications...");
    const result = await fetcher<{
      notifications: Notification[];
      unreadCount: number;
    }>(`notifications`, {
      requireAuth: true,
      returnEmptyOnError: true,
      defaultValue: { notifications: [], unreadCount: 0 },
    });
    console.log("Fetched notifications result:", result);

    // Ensure we have a valid structure
    if (!result || typeof result !== "object") {
      console.error("Invalid notifications result from API:", result);
      return { notifications: [], unreadCount: 0 };
    }

    // Ensure notifications is an array
    const notifications = Array.isArray(result.notifications)
      ? result.notifications
      : [];

    // Ensure unreadCount is a number
    const unreadCount =
      typeof result.unreadCount === "number" ? result.unreadCount : 0;

    return { notifications, unreadCount };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return { notifications: [], unreadCount: 0 };
  }
};

export const markNotificationsAsRead = async (): Promise<{
  success: boolean;
}> => {
  return fetcher<{ success: boolean }>(`notifications/read`, {
    method: "POST",
    requireAuth: true,
    returnEmptyOnError: true,
    defaultValue: { success: false },
  });
};

// Health API functions
export const healthCheck = async (): Promise<{ status: string }> => {
  return fetcher<{ status: string }>("health", {
    returnEmptyOnError: true,
    defaultValue: { status: "error" },
  });
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
  }>("health/detailed");
};

export const socketHealthCheck = async (): Promise<{
  status: string;
  activeConnections: number;
}> => {
  return fetcher<{ status: string; activeConnections: number }>(
    "health/socket"
  );
};

// Diagnostics API functions
export const diagnosticsHealth = async (): Promise<{
  status: string;
  timestamp: string;
}> => {
  return fetcher<{ status: string; timestamp: string }>("diagnostics/health"); // Use relative path
};

export const testBandwidth = async (sizeKB: number = 100): Promise<Blob> => {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = constructApiUrl(`diagnostics/test-bandwidth?size=${sizeKB}`);

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to perform bandwidth test");
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
  }>("diagnostics/connection-stats"); // Use relative path
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
  }>("diagnostics/rate-limit-status"); // Use relative path
};

// Additional Auth API functions
export const requestVerificationCode = async (
  email: string
): Promise<{ message: string; userId: string; phoneNumber?: string }> => {
  return fetcher<{ message: string; userId: string; phoneNumber?: string }>(
    "auth/request-verification", // Use relative path
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
};

// Additional Product API functions
export const deleteProductMedia = async (mediaId: string): Promise<void> => {
  // Ensure relative path is correct
  return fetcher<void>(`products/media/${mediaId}`, {
    method: "DELETE",
  });
};

// Additional LiveStream API functions
export const getActiveListing = async (
  liveStreamId: string
): Promise<AuctionListing | null> => {
  return fetcher<AuctionListing | null>(
    `live-streams/${liveStreamId}/active-listing`
  );
};

export const checkIsStreamer = async (
  liveStreamId: string
): Promise<{ isStreamer: boolean }> => {
  return fetcher<{ isStreamer: boolean }>(
    `live-streams/${liveStreamId}/check-streamer`
  );
};

export const addBidToListing = async (
  listingId: string,
  amount: number
): Promise<Bid> => {
  return fetcher<Bid>(`live-streams/listings/${listingId}/bids`, {
    method: "POST",
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
  }>("live-streams/socket-test");
};

export const addSimplifiedListingToLiveStream = async (
  liveStreamId: string,
  data: {
    productId: string;
    startPrice: number;
    countdownTime?: number;
  }
): Promise<AuctionListing> => {
  return fetcher<AuctionListing>(
    `live-streams/${liveStreamId}/listings/simplified`,
    {
      method: "POST",
      body: JSON.stringify(data),
      requireAuth: true,
    }
  );
};

// Product Auction functions
export const getProductAuctions = async (): Promise<ProductAuction[]> => {
  return fetcher<ProductAuction[]>("product-auctions", {
    returnEmptyOnError: true,
    defaultValue: [],
  });
};

export const getProductAuctionById = async (
  id: string
): Promise<ProductAuction> => {
  return fetcher<ProductAuction>(`product-auctions/${id}`);
};

export const createProductAuction = async (data: {
  productId: string;
  startPrice: number;
  duration: 1 | 3 | 5 | 7; // Only allow these specific durations
}): Promise<ProductAuction> => {
  return fetcher<ProductAuction>("product-auctions", {
    method: "POST",
    body: data,
    requireAuth: true,
  });
};

export const updateProductAuction = async (
  id: string,
  data: {
    startPrice?: number;
    status?: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  }
): Promise<ProductAuction> => {
  return fetcher<ProductAuction>(`product-auctions/${id}`, {
    method: "PUT",
    body: data,
    requireAuth: true,
  });
};

export const cancelProductAuction = async (
  id: string
): Promise<ProductAuction> => {
  return fetcher<ProductAuction>(`product-auctions/${id}/cancel`, {
    method: "POST",
    requireAuth: true,
  });
};

export const addBidToProductAuction = async (
  auctionId: string,
  amount: number
): Promise<Bid> => {
  return fetcher<Bid>(`product-auctions/${auctionId}/bids`, {
    method: "POST",
    body: JSON.stringify({ amount }),
    requireAuth: true,
  });
};

export const getProductAuctionByProductId = async (
  productId: string
): Promise<ProductAuction | null> => {
  return fetcher<ProductAuction | null>(
    `product-auctions/by-product/${productId}`,
    {
      returnEmptyOnError: true,
      defaultValue: null,
    }
  );
};

/**
 * HTTP methods for use with API requests
 */
export const HttpMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
} as const;
