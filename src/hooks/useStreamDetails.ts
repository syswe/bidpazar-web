import { useState, useEffect, useCallback } from 'react';

// Define the LiveStream type if not already defined in your project
interface LiveStream {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  status: string;
  startTime?: string;
  endTime?: string;
  creatorId: string;
  viewerCount: number;
  [key: string]: any; // For any additional fields
}

interface UseStreamDetailsResult {
  streamDetails: LiveStream | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Custom hook to fetch stream details with proper loading, error, and success states
 */
export function useStreamDetails(streamId: string, token?: string): UseStreamDetailsResult {
  const [streamDetails, setStreamDetails] = useState<LiveStream | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchStreamDetails = useCallback(async () => {
    if (!streamId) {
      setError(new Error('Stream ID is required'));
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/live-streams/${streamId}`, { headers });
      
      // Handle specific error cases
      if (response.status === 403) {
        setError(new Error('You do not have permission to view this stream'));
        setStreamDetails(null);
        setIsLoading(false);
        return;
      }
      
      if (response.status === 404) {
        setError(new Error('This stream does not exist or has been removed'));
        setStreamDetails(null);
        setIsLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stream details: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setStreamDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Error fetching stream details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, token]);
  
  useEffect(() => {
    fetchStreamDetails();
  }, [fetchStreamDetails]);
  
  // Function to manually reload stream details
  const reload = useCallback(() => {
    fetchStreamDetails();
  }, [fetchStreamDetails]);
  
  return { 
    streamDetails, 
    isLoading, 
    error, 
    reload 
  };
}

/**
 * Hook for live polling of stream details during active streams
 */
export function useStreamDetailsPoll(
  streamId: string, 
  token?: string, 
  pollInterval = 10000, 
  activeStates = ['LIVE', 'PAUSED', 'STARTING', 'ENDING']
): UseStreamDetailsResult {
  const { streamDetails, isLoading, error, reload } = useStreamDetails(streamId, token);
  
  // Set up polling for active streams
  useEffect(() => {
    // Only poll if stream is in an active state
    if (!streamDetails || !activeStates.includes(streamDetails.status)) {
      return;
    }
    
    const intervalId = setInterval(() => {
      reload();
    }, pollInterval);
    
    // Clean up on unmount or when status changes
    return () => clearInterval(intervalId);
  }, [streamDetails?.status, reload, pollInterval, activeStates]);
  
  return { streamDetails, isLoading, error, reload };
} 