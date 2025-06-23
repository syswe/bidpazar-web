import { useState, useCallback, useEffect } from "react";
import { getCookie } from "cookies-next";
import { toast } from "sonner";

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
}

export function useStreamDetails({
  streamId,
  token,
  logMessage,
}: UseStreamDetailsParams) {
  const [streamDetails, setStreamDetails] = useState<LiveStreamDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false); // Add flag to prevent concurrent requests

  const fetchStreamDetails = useCallback(async () => {
    if (isFetching) {
      logMessage(
        "Fetch already in progress, skipping duplicate request",
        "warn"
      );
      return;
    }

    setIsLoading(true);
    setIsFetching(true);
    setError(null);

    try {
      logMessage(`Fetching stream details for id: ${streamId}`, "info");

      // Use local API endpoint to avoid CORS issues
      const response = await fetch(`/api/live-streams/${streamId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch stream details: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();

      // Check if roomName exists, if not generate one
      if (!data.roomName) {
        data.roomName = streamId; // Use full streamId for LiveKit compatibility
        logMessage("Generated room name for stream", "info", {
          streamId,
          roomName: data.roomName,
        });
      }

      logMessage("Stream details fetched successfully", "info", {
        streamId,
        data,
      });
      setStreamDetails(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logMessage(`Error fetching stream details: ${errorMessage}`, "error");
      setError(`Failed to load stream: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [streamId, token, logMessage, isFetching]);

  useEffect(() => {
    if (!streamId) return; // Don't fetch if no streamId
    fetchStreamDetails();
  }, [streamId, token]); // Remove fetchStreamDetails from dependencies to prevent infinite loops

  return {
    streamDetails,
    isLoading,
    error,
    fetchStreamDetails,
  };
}
