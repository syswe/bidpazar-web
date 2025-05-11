import { useState, useCallback, useEffect } from 'react';
import { getCookie } from 'cookies-next';

// Define the ActiveBid interface
export interface ActiveBid {
  id: string;
  productId: string;
  streamId: string;
  timeRemaining: number; // in seconds
  isActive: boolean;
}

interface UseActiveBidProps {
  streamId: string;
  token?: string;
  isStreamer: boolean;
  isConfigLoading: boolean;
  logMessage: (message: string, level?: string, data?: any) => void;
}

export const useActiveBid = ({
  streamId,
  token,
  isStreamer,
  isConfigLoading,
  logMessage
}: UseActiveBidProps) => {
  const [activeProductBid, setActiveProductBid] = useState<ActiveBid | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActiveBid = useCallback(async () => {
    if (!streamId || isConfigLoading) return;
    
    setIsLoading(true);

    try {
      // Get token explicitly from both sources
      const authToken = token ?? (getCookie("token") as string | undefined);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      // Construct the correct API URL
      const apiEndpoint = `/api/live-streams/${streamId}/active-bid`;

      const response = await fetch(apiEndpoint, {
        headers,
        next: { revalidate: 10 }, // Check for new bids frequently
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch active bid: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Non-JSON response from active bid endpoint");
      }

      const data = await response.json();

      if (data && data.isActive) {
        setActiveProductBid({
          id: data.id,
          productId: data.productId,
          streamId: data.streamId,
          timeRemaining: data.timeRemaining,
          isActive: true,
        });
        
        logMessage("Active bid found", "info", { 
          bidId: data.id, 
          productId: data.productId,
          timeRemaining: data.timeRemaining
        });
      } else {
        setActiveProductBid(null);
        logMessage("No active bid found", "debug");
      }
    } catch (error) {
      logMessage("Error fetching active bid", "error", error);
      setActiveProductBid(null);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, token, isConfigLoading, logMessage]);

  // Poll for active bids at regular intervals (viewers only)
  useEffect(() => {
    if (!isStreamer && streamId) {
      fetchActiveBid();

      // Poll every 30 seconds for new bids
      const bidInterval = setInterval(() => {
        fetchActiveBid();
      }, 30000);

      return () => {
        clearInterval(bidInterval);
      };
    }
  }, [fetchActiveBid, isStreamer, streamId]);

  return {
    activeProductBid,
    isLoading,
    fetchActiveBid
  };
}; 