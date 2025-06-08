/**
 * BidPazar API Client - New Modular Structure
 * 
 * This file now exports from the new modular API structure.
 * All API functions are organized by domain/feature.
 * 
 * Usage:
 * - import { getProducts } from '@/lib/api'; // Direct import
 * - import { api } from '@/lib/api'; api.products.getProducts(); // Namespaced
 * - import { products } from '@/lib/api'; products.getProducts(); // Module import
 */

// Re-export everything from the new API structure
export * from "./api/index"; 