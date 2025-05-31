// Re-export all client-side API functions
export * from './stories/client';
export * from './live-streams/client';
export * from './utils/client';

// Re-export types from the main api file
export type {
  Category,
  ProductMedia,
  Product,
  User,
  LiveStream,
  AuctionListing,
  ProductAuction,
  Bid,
  ChatMessage,
  Message,
  Notification,
  Conversation,
  Story,
  WonAuction,
  Order
} from '@/lib/api';

// Re-export remaining functions from the main api.ts that haven't been moved
export {
  getProducts,
  getProductById,
  getProductsByCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  getUserProducts,
  getUserWonAuctions,
  getUserOrders,
  getAllUsers,
  getUserById,
  createUser,
  resetUserPassword,
  updateUser,
  deleteUser,
  makeAdmin,
  removeAdmin,
  uploadProductImages,
  uploadProductVideos,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getUserConversations,
  getConversationMessages,
  getOrCreateConversation,
  getConversationDetails,
  sendMessage,
  findUserByUsername,
  getUserNotifications,
  markNotificationsAsRead
} from '@/lib/api'; 