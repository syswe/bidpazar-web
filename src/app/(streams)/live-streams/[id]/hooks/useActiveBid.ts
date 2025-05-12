import { useState, useEffect, useCallback } from 'react';
import { getCookie } from 'cookies-next';

// Define the ActiveBid interface
export interface ActiveBid {
  id: string;
  productId: string;
  streamId: string;
  timeRemaining: number; // in seconds
  isActive: boolean;
}

export interface ProductBid {
  id: string;
  productId: string;
  streamId: string;
  currentPrice: number;
  bidCount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  endsAt: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    basePrice: number;
    currentPrice: number;
  };
}

interface UseActiveBidParams {
  streamId: string;
  token?: string;
  isStreamer: boolean;
  isConfigLoading: boolean;
  logMessage: (message: string, level?: string, data?: any) => void;
}

export function useActiveBid({
  streamId,
  token,
  isStreamer,
  isConfigLoading,
  logMessage
}: UseActiveBidParams) {
  const [activeProductBid, setActiveProductBid] = useState<ProductBid | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [shouldRetry, setShouldRetry] = useState<boolean>(true);
  const [errorCount, setErrorCount] = useState<number>(0);

  const fetchActiveBid = useCallback(async () => {
    // Skip if config is still loading
    if (isConfigLoading) {
      return;
    }
    
    // Skip if we've already tried this recently (prevent excessive API calls)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    if (timeSinceLastFetch < 2000) { // Don't retry more often than every 2 seconds
      return;
    }
    
    // If we've had too many consecutive errors, stop trying for a while
    if (errorCount > 5 && !shouldRetry) {
      return;
    }
    
    setIsLoading(true);
    setLastFetchTime(now);
    
    try {
      logMessage(`Fetching active bid for stream: ${streamId}`, 'info');
      
      // Use the API endpoint, which should handle backend communication properly
      const response = await fetch(`/api/live-streams/${streamId}/bids/active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store', // Don't cache this request
      });
      
      if (response.status === 404) {
        // No active bid found - this is a valid state, not an error
        setActiveProductBid(null);
        setError(null);
        setErrorCount(0); // Reset error count on successful response
        return;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        // Don't throw, just log
        logMessage(`Active bid fetch returned status ${response.status}: ${errorText}`, 'warn');
        setErrorCount(prev => prev + 1);
        
        // If we get multiple consecutive errors, start backing off
        if (errorCount > 5) {
          setShouldRetry(false);
          setTimeout(() => setShouldRetry(true), 30000); // Try again after 30 seconds
        }
        
        return;
      }
      
      const data = await response.json();
      
      if (!data) {
        setActiveProductBid(null);
      } else {
        logMessage('Active bid fetched successfully', 'info', { bidId: data.id });
        setActiveProductBid(data);
      }
      
      setError(null);
      setErrorCount(0); // Reset error count on successful response
      
    } catch (error) {
      // Just log the error, don't throw or update state
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`Error fetching active bid: ${errorMessage}`, 'error');
      setErrorCount(prev => prev + 1);
      
      // Only set error state for non-404 errors
      if (errorMessage.indexOf('404') === -1) {
        setError(`Failed to load active bid: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [streamId, token, isConfigLoading, logMessage, lastFetchTime, errorCount, shouldRetry]);

  useEffect(() => {
    if (streamId) {
      fetchActiveBid();
      
      // Set up polling interval for bid updates - less frequent to prevent API spam
      const intervalId = setInterval(fetchActiveBid, 10000); // Poll every 10 seconds instead of 5
      
      return () => clearInterval(intervalId);
    }
  }, [streamId, fetchActiveBid]);

  return {
    activeProductBid,
    isLoading,
    error,
    fetchActiveBid
  };
} 