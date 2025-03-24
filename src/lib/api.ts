import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

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
  _count?: {
    listings: number;
    viewers: number;
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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "API isteği başarısız oldu");
  }

  return data as T;
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
  return fetcher<Product>(`/products/${id}`);
};

export const getProductsByCategory = async (
  categoryId: string
): Promise<Product[]> => {
  return fetcher<Product[]>(`/products/category/${categoryId}`);
};

export const getUserProducts = async (userId: string): Promise<Product[]> => {
  return fetcher<Product[]>(`/products/user/${userId}`);
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

export const createLiveStream = async (
  data: {
    title: string;
    description?: string;
    thumbnailUrl?: string;
    startTime?: string;
  },
  token: string
): Promise<LiveStream> => {
  const response = await fetch(`${API_URL}/live-streams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create live stream");
  }

  return response.json();
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
  const response = await fetch(`${API_URL}/live-streams/${id}/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to end live stream");
  }

  return response.json();
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
