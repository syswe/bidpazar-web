import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UseStreamControlsProps {
  streamId: string;
  token?: string;
  isStreamer: boolean;
  logMessage: (message: string, level?: string, data?: any) => void;
  runtimeConfig?: any;
  fetchStreamDetails: () => Promise<void>;
}

export const useStreamControls = ({
  streamId,
  token,
  isStreamer,
  logMessage,
  runtimeConfig,
  fetchStreamDetails
}: UseStreamControlsProps) => {
  const [isControlsLoading, setIsControlsLoading] = useState<boolean>(false);

  const handleStartStream = useCallback(async () => {
    const startTime = performance.now();
    logMessage("Streamer attempting to start the stream", "info", {
      streamId,
      isStreamer,
    });

    if (!streamId || !isStreamer) {
      logMessage(
        "Start stream cancelled: Invalid streamId or user is not streamer",
        "warn",
        { streamId, isStreamer }
      );
      toast.error("Cannot start stream.");
      return;
    }

    setIsControlsLoading(true);

    try {
      if (!token) {
        logMessage("Start stream failed: No auth token", "error");
        toast.error("Authentication required. Please login and try again.");
        setIsControlsLoading(false);
        return;
      }

      performance.mark("stream-start-api-call-begin");

      // Call the API to start the stream
      const startEndpoint = `/api/live-streams/${streamId}/start`;

      logMessage("Calling start endpoint...", "debug", {
        url: startEndpoint,
        method: "POST",
        hasToken: !!token,
      });

      const response = await fetch(startEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      performance.mark("stream-start-api-call-end");
      performance.measure(
        "stream-start-api-call",
        "stream-start-api-call-begin",
        "stream-start-api-call-end"
      );

      const apiCallDuration =
        performance.getEntriesByName("stream-start-api-call")[0]?.duration || 0;

      if (!response.ok) {
        let errorMsg = `Error starting stream: ${response.status}`;
        let errorBody = "";

        try {
          // Try to parse error response
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json();
            errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
          } else {
            errorBody = await response.text();
          }
          errorMsg += ` - ${errorBody}`;
        } catch (e) {
          /* Ignore parsing errors */
          errorBody = "Unknown error occurred";
        }

        logMessage(`Start stream failed: ${errorMsg}`, "error", {
          status: response.status,
          duration: `${apiCallDuration.toFixed(2)}ms`,
        });

        toast.error(`Failed to start stream: ${errorBody || "Unknown error"}`);
        setIsControlsLoading(false);
        return;
      }

      // Check content type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        logMessage("Received non-JSON response from start endpoint", "error", {
          contentType,
          preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        });
        toast.error("Unexpected response format. Please try again.");
        setIsControlsLoading(false);
        return;
      }

      const data = await response.json();
      logMessage("Stream started successfully via API", "info", {
        ...data,
        apiDuration: `${apiCallDuration.toFixed(2)}ms`,
        totalDuration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });

      toast.success("Stream started successfully!");

      // Refresh stream details to get updated status
      await fetchStreamDetails();
      setIsControlsLoading(false);
    } catch (err: any) {
      console.error("Error in handleStartStream:", err);
      logMessage(`Start stream process failed: ${err.message}`, "error", {
        error: err,
        stack: err.stack,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });
      toast.error("Failed to start stream. Please try again.");
      setIsControlsLoading(false);
    }
  }, [streamId, isStreamer, token, logMessage, fetchStreamDetails]);

  const handleEndStream = useCallback(async () => {
    const startTime = performance.now();
    logMessage("Streamer attempting to end the stream", "info", {
      streamId,
      isStreamer,
    });

    if (!streamId || !isStreamer) {
      logMessage(
        "End stream cancelled: Invalid streamId or user is not streamer",
        "warn",
        { streamId, isStreamer }
      );
      toast.error("Cannot end stream.");
      return;
    }

    setIsControlsLoading(true);

    try {
      if (!token) {
        logMessage("End stream failed: No auth token", "error");
        toast.error("Authentication required. Please login and try again.");
        setIsControlsLoading(false);
        return;
      }

      performance.mark("stream-end-api-call-begin");

      const endEndpoint = `/api/live-streams/${streamId}/end`;
      
      logMessage("Calling end endpoint...", "debug", {
        url: endEndpoint,
        method: "POST",
        hasToken: !!token,
      });

      const response = await fetch(endEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      performance.mark("stream-end-api-call-end");
      performance.measure(
        "stream-end-api-call",
        "stream-end-api-call-begin",
        "stream-end-api-call-end"
      );

      const apiCallDuration =
        performance.getEntriesByName("stream-end-api-call")[0]?.duration || 0;

      if (!response.ok) {
        let errorMsg = `Error ending stream: ${response.status}`;
        let errorBody = "";
        
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json();
            errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
          } else {
            errorBody = await response.text();
          }
          errorMsg += ` - ${errorBody}`;
        } catch (e) {
          /* Ignore parsing errors */
          errorBody = "Unknown error occurred";
        }

        logMessage(`End stream failed: ${errorMsg}`, "error", {
          status: response.status,
          duration: `${apiCallDuration.toFixed(2)}ms`,
        });

        toast.error(`Failed to end stream: ${errorBody || "Unknown error"}`);
        setIsControlsLoading(false);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        logMessage("Received non-JSON response from end endpoint", "error", {
          contentType,
          preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        });
        toast.error("Unexpected response format. Please try again.");
        setIsControlsLoading(false);
        return;
      }

      const data = await response.json();
      logMessage("Stream ended successfully via API", "info", {
        ...data,
        apiDuration: `${apiCallDuration.toFixed(2)}ms`,
        totalDuration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });

      toast.success("Stream ended successfully!");

      // Refresh stream details to get updated status
      await fetchStreamDetails();
      setIsControlsLoading(false);
    } catch (err: any) {
      console.error("Error in handleEndStream:", err);
      logMessage(`End stream process failed: ${err.message}`, "error", {
        error: err,
        stack: err.stack,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });
      toast.error("Failed to end stream. Please try again.");
      setIsControlsLoading(false);
    }
  }, [streamId, isStreamer, token, logMessage, fetchStreamDetails]);

  return {
    isControlsLoading,
    handleStartStream,
    handleEndStream
  };
}; 