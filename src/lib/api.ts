import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

// Log API URL configuration for debugging purposes
console.log("API configuration:");
console.log(`NEXT_PUBLIC_API_URL env: ${process.env.NEXT_PUBLIC_API_URL}`);
console.log(`Using API_URL: ${API_URL}`);

// Helper function to ensure proper URL construction
const constructApiUrl = (endpoint: string): string => {
  // Remove any leading slashes from the endpoint
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  // Remove any trailing slashes from the API_URL
  const baseUrl = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;

  return `${baseUrl}/${cleanEndpoint}`;
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
    const url = constructApiUrl(endpoint);
    console.log(`Fetcher making request to: ${url}`);
    console.log(`Authorization header present: ${!!token}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log(
      `Fetcher got response: ${response.status} ${response.statusText}`
    );

    // Check content type and status first
    const contentType = response.headers.get("content-type");
    console.log(`Fetcher response content-type: ${contentType}`);

    if (!response.ok) {
      // For error responses, try to parse as JSON first
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        console.error("Fetcher received JSON error:", errorData);
        throw new Error(
          errorData.message || errorData.error || "API isteği başarısız oldu"
        );
      } else {
        // If not JSON, handle as text
        const errorText = await response.text();
        console.error("Fetcher received non-JSON error:", errorText);
        throw new Error(
          `API isteği başarısız oldu: ${response.status} ${response.statusText}`
        );
      }
    }

    // For OK responses where content is expected
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    // Handle empty responses or non-JSON responses
    if (response.status === 204 || !contentType) {
      return {} as T; // No content expected
    }

    // Default case - still try to parse as JSON, but log a warning
    console.warn(
      `Unexpected content type: ${contentType} for successful response`
    );
    try {
      return (await response.json()) as T;
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Fetcher error:", error);
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
    const webrtcServer = process.env.NEXT_PUBLIC_WEBRTC_SERVER;
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
