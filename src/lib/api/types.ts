// Core API Types
export interface Category {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  parentId?: string;
  productCount?: number;
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
  buyNowPrice?: number;
  currency: string;
  userId: string;
  categoryId: string;
  images: { id: string; url: string; type: string }[];
  category?: { id: string; name: string };
  user?: {
    id: string;
    username: string;
    name?: string;
    userType?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  phoneNumber?: string;
  isVerified: boolean;
  isAdmin: boolean;
  userType?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

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

export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  createdAt: string;
  isRead?: boolean;
  sender?: {
    id: string;
    username: string;
    name?: string;
  };
}

export interface Notification {
  id: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  updatedAt: string;
  participants: Array<{
    id: string;
    username: string;
    name?: string;
  }>;
  latestMessage?: Message;
  _count?: {
    messages: number;
    unreadMessages?: number;
  };
}

export interface Story {
  id: string;
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO";
  mediaUrl?: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    name?: string;
  };
  views: number;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
}

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

// HTTP method constants
export const HttpMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
} as const;

export type HttpMethodType = typeof HttpMethod[keyof typeof HttpMethod]; 