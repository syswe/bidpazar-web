/**
 * BidPazar API Client - Modular Architecture
 * 
 * This file exports all API modules and provides backward compatibility
 * with the previous monolithic api.ts structure.
 */

// Export types
export * from "./types";

// Export core client
export { fetcher, fetcherAuth, handleApiError, apiBaseUrl } from "./client";

// Export all modules
export * as categories from "./categories";
export * as products from "./products";
export * as users from "./users";
export * as livestreams from "./livestreams";
export * as messages from "./messages";
export * as auctions from "./auctions";
export * as notifications from "./notifications";
export * as system from "./system";

// Backward compatibility exports - re-export commonly used functions
// Categories
export { 
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from "./categories";

// Products
export { 
  getProducts,
  getProductById,
  getProductsByCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  getUserProducts,
  uploadProductImages,
  uploadProductVideos,
  deleteProductMedia
} from "./products";

// Users
export { 
  getAllUsers,
  getUserById,
  createUser,
  resetUserPassword,
  updateUser,
  deleteUser,
  makeAdmin,
  removeAdmin,
  findUserByUsername,
  getUserWonAuctions,
  getUserOrders
} from "./users";

// LiveStreams
export { 
  getLiveStreams,
  getLiveStreamById,
  getUserLiveStreams,
  createLiveStream,
  startLiveStream,
  endLiveStream,
  updateLiveStream,
  deleteLiveStream,
  addListingToLiveStream,
  getStreamVideo,
  getActiveListing,
  checkIsStreamer,
  addBidToListing,
  testSocketConnection,
  addSimplifiedListingToLiveStream
} from "./livestreams";

// Messages
export { 
  getUserConversations,
  getConversationMessages,
  getOrCreateConversation,
  getConversationDetails,
  sendMessage,
  searchSellerRecipients,
} from "./messages";

// Auctions
export { 
  getProductAuctions,
  getProductAuctionById,
  createProductAuction,
  updateProductAuction,
  cancelProductAuction,
  addBidToProductAuction,
  getProductAuctionByProductId
} from "./auctions";

// Notifications
export { 
  getUserNotifications,
  markNotificationsAsRead
} from "./notifications";

// System
export { 
  healthCheck,
  detailedHealthCheck,
  socketHealthCheck,
  diagnosticsHealth,
  testBandwidth,
  getConnectionStats,
  getRateLimitStatus,
  requestVerificationCode
} from "./system";

/**
 * API Client Factory - for creating pre-configured API instances
 */
export const createApiClient = () => {
  // Import modules dynamically to avoid circular dependencies
  const categoriesModule = require("./categories");
  const productsModule = require("./products");
  const usersModule = require("./users");
  const livestreamsModule = require("./livestreams");
  const messagesModule = require("./messages");
  const auctionsModule = require("./auctions");
  const notificationsModule = require("./notifications");
  const systemModule = require("./system");

  return {
    categories: categoriesModule,
    products: productsModule,
    users: usersModule,
    livestreams: livestreamsModule,
    messages: messagesModule,
    auctions: auctionsModule,
    notifications: notificationsModule,
    system: systemModule,
  };
};

/**
 * Default API client instance
 */
export const api = createApiClient(); 
