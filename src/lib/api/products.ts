import { fetcher, fetcherAuth, apiBaseUrl } from "./client";
import { getToken } from "../frontend-auth";
import { logger } from "../logger";
import type { Product, ProductMedia } from "./types";

/**
 * Products API Module
 */

export const getProducts = async (): Promise<Product[]> => {
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

export const getUserProducts = async (): Promise<Product[]> => {
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
        const { refreshToken } = await import("../frontend-auth");
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
};

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

export const deleteProductMedia = async (mediaId: string): Promise<void> => {
  return fetcher<void>(`products/media/${mediaId}`, {
    method: "DELETE",
  });
}; 