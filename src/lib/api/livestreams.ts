import { fetcher, apiBaseUrl } from "./client";
import { getToken } from "../frontend-auth";
import type { LiveStream, AuctionListing, Bid } from "./types";

/**
 * LiveStreams API Module
 */

export const getLiveStreams = async (): Promise<LiveStream[]> => {
  return fetcher<LiveStream[]>(`live-streams`, {
    returnEmptyOnError: true,
    defaultValue: [],
  });
};

export const getLiveStreamById = async (id: string): Promise<LiveStream> => {
  return fetcher<LiveStream>(`live-streams/${id}`);
};

export const getUserLiveStreams = async (): Promise<LiveStream[]> => {
  return fetcher<LiveStream[]>(`live-streams/user/streams`, {
    requireAuth: true,
  });
};

export const createLiveStream = async (
  data: {
    title: string;
    description?: string;
    thumbnailUrl?: string;
    startTime?: string;
  },
  token?: string
): Promise<LiveStream> => {
  const authToken = token || getToken();
  if (!authToken) {
    throw new Error("No authentication token available");
  }
  return fetcher(`live-streams`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    requireAuth: true,
  });
};

export const startLiveStream = async (
  id: string,
  token: string
): Promise<LiveStream> => {
  return fetcher<LiveStream>(`live-streams/${id}/start`, {
    method: "POST",
    requireAuth: true,
  });
};

export const endLiveStream = async (
  id: string,
  token: string
): Promise<LiveStream> => {
  return await fetcher(`${apiBaseUrl}/live-streams/${id}/end`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateLiveStream = async (
  id: string,
  data: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    status?: "SCHEDULED" | "LIVE" | "ENDED";
    startTime?: string;
  },
  token?: string
): Promise<LiveStream> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return await fetcher(`${apiBaseUrl}/live-streams/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers,
    requireAuth: true,
  });
};

export const deleteLiveStream = async (id: string): Promise<void> => {
  await fetcher(`${apiBaseUrl}/live-streams/${id}`, {
    method: "DELETE",
    requireAuth: true,
  });
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
  return fetcher<AuctionListing>(`live-streams/${liveStreamId}/listings`, {
    method: "POST",
    body: data,
    requireAuth: true,
  });
};

export const getStreamVideo = async (
  streamId: string
): Promise<{
  message: string;
  streamId: string;
  status: string;
  wsEndpoint: string;
}> => {
  return fetcher<{
    message: string;
    streamId: string;
    status: string;
    wsEndpoint: string;
  }>(
    `stream/${streamId}/video`,
    {
      method: "GET",
      requireAuth: true,
    }
  );
};

export const getActiveListing = async (
  liveStreamId: string
): Promise<AuctionListing | null> => {
  return fetcher<AuctionListing | null>(
    `live-streams/${liveStreamId}/active-listing`
  );
};

export const checkIsStreamer = async (
  liveStreamId: string
): Promise<{ isStreamer: boolean }> => {
  return fetcher<{ isStreamer: boolean }>(
    `live-streams/${liveStreamId}/check-streamer`
  );
};

export const addBidToListing = async (
  listingId: string,
  amount: number
): Promise<Bid> => {
  return fetcher<Bid>(`live-streams/listings/${listingId}/bids`, {
    method: "POST",
    body: JSON.stringify({ amount }),
    requireAuth: true,
  });
};

export const testSocketConnection = async (): Promise<{
  status: string;
  message: string;
  socketEnabled: boolean;
  path: string;
  timestamp: number;
}> => {
  return fetcher<{
    status: string;
    message: string;
    socketEnabled: boolean;
    path: string;
    timestamp: number;
  }>("live-streams/socket-test");
};

export const addSimplifiedListingToLiveStream = async (
  liveStreamId: string,
  data: {
    productId: string;
    startPrice: number;
    countdownTime?: number;
  }
): Promise<AuctionListing> => {
  return fetcher<AuctionListing>(
    `live-streams/${liveStreamId}/listings/simplified`,
    {
      method: "POST",
      body: JSON.stringify(data),
      requireAuth: true,
    }
  );
}; 