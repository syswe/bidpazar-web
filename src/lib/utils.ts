import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to a human-readable format
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Format a date string for date and time display
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

/**
 * Calculate minimum bid increment based on current auction price
 * Rules:
 * - Min product price: 100 TL
 * - 100-2000 TL: 100 TL increment
 * - 2000-5000 TL: 250 TL increment  
 * - 5000+ TL: 500 TL increment
 */
export function calculateMinimumBidIncrement(currentPrice: number): number {
  if (currentPrice < 100) {
    return 100; // Minimum product price
  } else if (currentPrice < 2000) {
    return 100; // 100-2000 TL range
  } else if (currentPrice < 5000) {
    return 250; // 2000-5000 TL range
  } else {
    return 500; // 5000+ TL range
  }
}

/**
 * Calculate the minimum valid bid amount for an auction
 */
export function calculateMinimumBidAmount(currentPrice: number): number {
  const increment = calculateMinimumBidIncrement(currentPrice);
  return currentPrice + increment;
}

/**
 * Calculate next valid bid amount for an auction
 * Handles first bid exception: if no bids yet (currentPrice === startPrice), next bid is startPrice
 * Otherwise applies increment rules
 */
export function calculateNextBidAmount(currentPrice: number, startPrice: number): number {
  // First bid exception: if current price equals start price, the first bid can be the start price
  if (currentPrice === startPrice) {
    return startPrice;
  }
  
  // Otherwise, apply normal increment rules
  return calculateMinimumBidAmount(currentPrice);
}

/**
 * Validate if a bid amount meets the minimum increment requirements
 */
export function validateBidAmount(currentPrice: number, bidAmount: number, startPrice?: number): {
  isValid: boolean;
  minimumAmount: number;
  increment: number;
  error?: string;
} {
  // Handle first bid exception: when no bids yet (currentPrice === startPrice),
  // bid amount only needs to be >= startPrice
  if (startPrice && currentPrice === startPrice) {
    if (bidAmount >= startPrice) {
      return {
        isValid: true,
        minimumAmount: startPrice,
        increment: 0
      };
    } else {
      return {
        isValid: false,
        minimumAmount: startPrice,
        increment: 0,
        error: `İlk teklif en az ${startPrice} TL olmalıdır`
      };
    }
  }
  
  const increment = calculateMinimumBidIncrement(currentPrice);
  const minimumAmount = currentPrice + increment;
  
  if (bidAmount < minimumAmount) {
    return {
      isValid: false,
      minimumAmount,
      increment,
      error: `Teklif en az ${minimumAmount} TL olmalıdır (${increment} TL artış)`
    };
  }
  
  return {
    isValid: true,
    minimumAmount,
    increment
  };
}
