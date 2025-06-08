import { fetcher } from "./client";
import type { ProductAuction, Bid } from "./types";

/**
 * Auctions API Module - for product auctions (not livestream auctions)
 */

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