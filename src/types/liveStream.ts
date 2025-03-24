import { User } from "./user";

export type LiveStreamStatus = "SCHEDULED" | "LIVE" | "ENDED";

export interface AuctionListing {
  id: string;
  productId: string;
  liveStreamId: string;
  startPrice: number;
  status: "ACTIVE" | "COUNTDOWN" | "SOLD" | "UNSOLD";
  countdownTime: number;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    description: string;
    images: Array<{
      id: string;
      filename: string;
    }>;
  };
  bids?: Array<{
    id: string;
    amount: number;
    userId: string;
    listingId: string;
    createdAt: string;
    user?: {
      username: string;
    };
  }>;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  liveStreamId: string;
  createdAt: string;
  user?: {
    username: string;
  };
}

export interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: LiveStreamStatus;
  startTime: string | null;
  endTime: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  listings?: AuctionListing[];
  chatMessages?: ChatMessage[];
}
