import { useState, useCallback, useEffect } from 'react';
import { getCookie } from 'cookies-next';
import { toast } from 'sonner';

// Define types
export interface LiveStreamDetails {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: "SCHEDULED" | "STARTING" | "LIVE" | "ENDED";
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  roomName: string; // Added for Jitsi integration
  user?: {
    id: string;
    username: string;
    name: string | null;
  };
}

interface UseStreamDetailsParams {
  streamId: string;
  token?: string;
  logMessage: (message: string, level?: string, data?: any) => void;
  runtimeConfig: any;
  isConfigLoading: boolean;
}

export function useStreamDetails({
  streamId,
  token,
  logMessage,
  runtimeConfig,
  isConfigLoading
}: UseStreamDetailsParams) {
  const [streamDetails, setStreamDetails] = useState<LiveStreamDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreamDetails = useCallback(async () => {
    if (isConfigLoading || !runtimeConfig) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      logMessage(`Fetching stream details for id: ${streamId}`, 'info');
      
      const apiUrl = runtimeConfig.apiUrl;
      const response = await fetch(`${apiUrl}/live-streams/${streamId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch stream details: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      // Check if roomName exists, if not generate one
      if (!data.roomName) {
        data.roomName = `bidpazar-${streamId.slice(0, 8)}`;
        logMessage('Generated room name for stream', 'info', { streamId, roomName: data.roomName });
      }
      
      logMessage('Stream details fetched successfully', 'info', { streamId, data });
      setStreamDetails(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`Error fetching stream details: ${errorMessage}`, 'error');
      setError(`Failed to load stream: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, token, runtimeConfig, isConfigLoading, logMessage]);

  useEffect(() => {
    if (!isConfigLoading && runtimeConfig) {
      fetchStreamDetails();
    }
  }, [fetchStreamDetails, isConfigLoading, runtimeConfig]);

  return {
    streamDetails,
    isLoading,
    error,
    fetchStreamDetails
  };
} 