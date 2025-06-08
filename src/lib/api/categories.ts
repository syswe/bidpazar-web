import { fetcher } from "./client";
import type { Category } from "./types";

/**
 * Categories API Module
 */

export const getCategories = async (options?: { withProductCount?: boolean }): Promise<Category[]> => {
  const params = new URLSearchParams();
  if (options?.withProductCount) {
    params.append('withProductCount', 'true');
  }

  const url = params.toString() ? `categories?${params.toString()}` : 'categories';
  
  return fetcher<Category[]>(url, {
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