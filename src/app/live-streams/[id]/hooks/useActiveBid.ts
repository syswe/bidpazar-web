import { useState, useEffect, useCallback } from "react";

// Define the ActiveBid interface
export interface ActiveBid {
  id: string;
  productId: string;
  streamId: string;
  timeRemaining: number; // in seconds
  isActive: boolean;
}

// Define the ProductBid interface
export interface ProductBid {
  id: string;
  product: {
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    basePrice: number;
    currentPrice: number;
  };
  bidCount: number;
  highestBidder: string | null;
  countdownEnd: string | null;
}

interface UseActiveBidProps {
  streamId: string;
  token?: string;
  isStreamer: boolean;
  logMessage?: (message: string, data?: any) => void;
  socket?: any;
}

export function useActiveBid({
  streamId,
  token,
  isStreamer,
  logMessage = console.log,
  socket,
}: UseActiveBidProps) {
  const [activeProductBid, setActiveProductBid] = useState<ProductBid | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active bid function
  const fetchActiveBid = useCallback(async () => {
    if (!streamId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      logMessage(`[useActiveBid] Fetching active bid for stream ${streamId}`);

      // Use local API endpoint to avoid CORS issues
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/live-streams/${streamId}/active-bid`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No active product is not an error
          setActiveProductBid(null);
          setError(null);
          logMessage(`[useActiveBid] No active product for stream ${streamId}`);
          setIsLoading(false);
          return;
        }

        // Other error
        logMessage(
          `[useActiveBid] Error fetching active bid: ${response.status}`
        );
        setError(`Failed to fetch active product: ${response.status}`);
        setActiveProductBid(null);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      logMessage(`[useActiveBid] Active bid data:`, data);

      if (data.product) {
        setActiveProductBid(data);
        setError(null);
      } else {
        setActiveProductBid(null);
      }
    } catch (err) {
      logMessage(`[useActiveBid] Error in fetchActiveBid:`, err);
      setError(
        `Failed to fetch active product: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setActiveProductBid(null);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, token, logMessage]);

  // Initial fetch
  useEffect(() => {
    fetchActiveBid();
  }, [fetchActiveBid]);

  // Listen for socket events to update the bid
  useEffect(() => {
    if (socket) {
      // Listen for new bids
      const handleNewBid = () => {
        logMessage("[useActiveBid] New bid received via socket, refreshing");
        fetchActiveBid();
      };

      // Listen for auction start
      const handleCountdownStarted = (data: any) => {
        if (data.streamId === streamId) {
          logMessage("[useActiveBid] Countdown started via socket, refreshing");
          fetchActiveBid();
        }
      };

      // Listen for auction end
      const handleCountdownEnded = (data: any) => {
        if (data.streamId === streamId) {
          logMessage("[useActiveBid] Countdown ended via socket, refreshing");
          fetchActiveBid();
        }
      };

      // Listen for new auctions
      const handleNewAuction = (data: any) => {
        if (data.streamId === streamId) {
          logMessage("[useActiveBid] New auction created, refreshing");
          fetchActiveBid();
        }
      };

      // Register listeners
      socket.on("new-bid", handleNewBid);
      socket.on("countdown-started", handleCountdownStarted);
      socket.on("countdown-ended", handleCountdownEnded);
      socket.on("new-auction", handleNewAuction);

      // Cleanup
      return () => {
        socket.off("new-bid", handleNewBid);
        socket.off("countdown-started", handleCountdownStarted);
        socket.off("countdown-ended", handleCountdownEnded);
        socket.off("new-auction", handleNewAuction);
      };
    }
  }, [socket, streamId, fetchActiveBid, logMessage]);

  // Refresh active bid every 5 seconds to ensure we have latest countdown
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchActiveBid();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [fetchActiveBid]);

  return {
    activeProductBid,
    isLoading,
    error,
    fetchActiveBid,
  };
}
