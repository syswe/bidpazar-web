import { useState, useCallback, useEffect } from 'react';
import { getCookie } from 'cookies-next';
import { toast } from 'sonner';

// Define types
export interface LiveStreamDetails {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  userId: string;
  status: "LIVE" | "ENDED" | "SCHEDULED";
  startTime?: string;
  updatedAt?: string;
  user?: {
    id: string;
    username: string;
    profileImage?: string;
  };
}

interface UseStreamDetailsProps {
  streamId: string;
  token?: string;
  logMessage: (message: string, level?: string, data?: any) => void;
  runtimeConfig?: any;
  isConfigLoading: boolean;
}

export const useStreamDetails = ({
  streamId,
  token,
  logMessage,
  runtimeConfig,
  isConfigLoading
}: UseStreamDetailsProps) => {
  const [streamDetails, setStreamDetails] = useState<LiveStreamDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchStreamDetails = useCallback(async () => {
    if (!streamId || isConfigLoading) return;

    try {
      // Get token explicitly from both sources
      const authToken = token ?? (getCookie("token") as string | undefined);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "Accept": "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
        logMessage("Using auth token for stream details fetch", "debug");
      } else {
        logMessage("No auth token found for stream details fetch", "warn");
      }

      // Construct the correct API URL
      const apiEndpoint = `/api/live-streams/${streamId}`;

      logMessage("Making stream details API request", "debug", {
        url: apiEndpoint,
        headers: Object.keys(headers),
      });

      const response = await fetch(apiEndpoint, {
        headers,
        next: { revalidate: 10 },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError("Stream not found.");
          logMessage(`Fetch failed: Stream not found (404)`, "error", {
            status: response.status,
            streamId,
          });
          toast.error("Stream not found.");
          setStreamDetails(null);
          return;
        }
        throw new Error(`Failed to fetch stream details: ${response.status}`);
      }

      // Check if we're getting HTML instead of JSON (which suggests a server error)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Check if response is HTML
        const text = await response.text();
        if (text.includes("<!DOCTYPE html>") || text.includes("<html>")) {
          setError(
            "Received HTML instead of JSON. The server might be returning an error page."
          );
          logMessage("Received HTML instead of JSON response", "error", {
            previewLength: Math.min(text.length, 100),
            preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
          });
        } else {
          setError("Invalid response format from server.");
          logMessage("Invalid response format", "error", {
            previewLength: Math.min(text.length, 100),
            preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
          });
        }

        setStreamDetails(null);
        return;
      }

      // At this point we know it's a valid JSON response
      const data = await response.json();

      logMessage("Stream details fetched successfully", "info", {
        id: data.id,
        status: data.status,
        creatorId: data.creatorId,
        title: data.title,
      });

      setStreamDetails(data);
    } catch (err: any) {
      console.error("Error fetching stream details:", err);

      const errorMsg = err.message || "Unknown fetch error";
      logMessage(`Fetch failed: ${errorMsg}`, "error", {
        err,
        streamId,
        stack: err.stack,
      });

      toast.error(
        "Could not load stream details. Please try refreshing the page."
      );
      setError("Failed to load stream information");
      setStreamDetails(null);
    } finally {
      setIsLoading(false);
      logMessage("Fetch stream details finished.", "debug");
    }
  }, [streamId, token, logMessage, isConfigLoading, runtimeConfig]);

  // Initial fetch on mount
  useEffect(() => {
    fetchStreamDetails();
  }, [fetchStreamDetails]);

  return {
    streamDetails,
    isLoading,
    error,
    fetchStreamDetails,
    setStreamDetails
  };
}; 