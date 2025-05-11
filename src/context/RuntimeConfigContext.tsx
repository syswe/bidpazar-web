"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Define the structure of the runtime configuration
export interface RuntimeConfig {
  apiUrl: string;
  socketUrl: string;
  appUrl: string;
  webrtcServer: string;
  wsUrl: string;
  turnServerUrl?: string;
  turnUsername?: string;
  turnPassword?: string;
  stunServerUrl?: string;
}

// Default configuration with sensible fallbacks
const defaultConfig: RuntimeConfig = {
  apiUrl: "/api",
  socketUrl:
    typeof window !== "undefined"
      ? `http://${window.location.host}` // Use HTTP for Socket.IO, not WebSocket protocol
      : "http://localhost:3000",
  appUrl:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  webrtcServer:
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000",
  wsUrl: "/socket.io", // No trailing slash to match server configuration
  stunServerUrl: "stun:stun.l.google.com:19302",
};

interface RuntimeConfigContextType {
  config: RuntimeConfig;
  isLoading: boolean;
  error: Error | null;
  refreshConfig: () => Promise<void>;
}

// Create the context with a default that includes sensible defaults
const RuntimeConfigContext = createContext<RuntimeConfigContextType>({
  config: defaultConfig,
  isLoading: true,
  error: null,
  refreshConfig: async () => {}, // Empty function as placeholder
});

export const RuntimeConfigProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Initialize with default config immediately
  const [config, setConfig] = useState<RuntimeConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [fetchInProgress, setFetchInProgress] = useState(false);

  const fetchConfig = async () => {
    // Don't fetch if already in progress or if we've fetched recently (within 5 seconds)
    const now = Date.now();
    if (
      fetchInProgress ||
      (now - lastFetchTime < 5000 && lastFetchTime !== 0)
    ) {
      console.log(
        "[RuntimeConfig] Skipping fetch - already in progress or too recent"
      );
      return;
    }

    if (typeof window === "undefined") {
      console.log("[RuntimeConfig] Running on server, using default config");
      setIsLoading(false);
      return;
    }

    try {
      setFetchInProgress(true);
      setIsLoading(true);

      // Log request attempt
      console.log(
        `[RuntimeConfig] Fetching runtime configuration (attempt ${
          retryCount + 1
        })`
      );

      // Use /api/config endpoint to get runtime configuration
      const response = await fetch("/api/config", {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        cache: "no-store",
      });

      // Handle non-200 responses
      if (!response.ok) {
        // Try to get the error message from the response if possible
        let errorMessage = `Config API returned ${response.status}`;
        try {
          // Check content type to avoid parsing HTML as JSON
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            // If not JSON, just get the text
            const errorText = await response.text();
            // Check if it's HTML (error page)
            if (
              errorText.includes("<!DOCTYPE html>") ||
              errorText.includes("<html>")
            ) {
              errorMessage =
                "Received HTML instead of JSON. The server might be returning an error page.";
            } else {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (parseError) {
          console.error(
            "[RuntimeConfig] Error parsing error response:",
            parseError
          );
        }

        // If we get 401/403 errors, use default config and don't retry excessively
        if (response.status === 401 || response.status === 403) {
          console.warn(
            "[RuntimeConfig] Authentication error, using default config"
          );
          setError(
            new Error(`Authentication required for config: ${errorMessage}`)
          );
          setIsLoading(false);

          // If we've had multiple auth errors, stop retrying frequently
          if (retryCount >= 2) {
            console.warn(
              "[RuntimeConfig] Too many auth errors, limiting retries"
            );
            // Only retry once per minute after multiple failures
            setTimeout(() => setRetryCount((prev) => prev + 1), 60000);
          } else {
            setRetryCount((prev) => prev + 1);
          }

          setFetchInProgress(false);
          setLastFetchTime(Date.now());
          return;
        }

        throw new Error(`Failed to fetch runtime config: ${errorMessage}`);
      }

      // Check content type to avoid parsing non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Invalid response format: Expected JSON, got "${contentType}". Response starts with: ${text.substring(
            0,
            100
          )}...`
        );
      }

      // Parse the JSON response
      const data = await response.json();

      // Log the fetched config
      console.log("[RuntimeConfig] Fetched runtime config:", data);

      // Merge with default config to ensure all properties exist
      const newConfig = { ...defaultConfig, ...data };

      // Validate and normalize URL formats
      // ----------------------------------

      // 1. API URL - ensure it starts with / if it's a relative path, or has http/https if absolute
      if (newConfig.apiUrl) {
        if (
          !newConfig.apiUrl.startsWith("http") &&
          !newConfig.apiUrl.startsWith("/")
        ) {
          newConfig.apiUrl = `/${newConfig.apiUrl}`;
        }
      }

      // 2. Socket.IO URL - Allow ws:// or wss:// protocols
      if (newConfig.socketUrl) {
        if (
          !newConfig.socketUrl.startsWith("http://") &&
          !newConfig.socketUrl.startsWith("https://") &&
          !newConfig.socketUrl.startsWith("ws://") &&
          !newConfig.socketUrl.startsWith("wss://")
        ) {
          // If no recognized protocol, default to ws:// or http:// based on needs
          // Forcing ws:// as per .env
          newConfig.socketUrl = `ws://${newConfig.socketUrl}`;
          console.log(
            "[RuntimeConfig] Added ws:// protocol to Socket.IO URL as default"
          );
        }

        // Remove trailing slash to avoid double slashes when combined with path
        if (
          newConfig.socketUrl.endsWith("/") &&
          newConfig.wsUrl &&
          newConfig.wsUrl.startsWith("/")
        ) {
          newConfig.socketUrl = newConfig.socketUrl.replace(/\/$/, "");
          console.log(
            "[RuntimeConfig] Removed trailing slash from Socket.IO URL to avoid path issues"
          );
        }
      }

      // 3. WebRTC Server URL - similar to Socket.IO, needs http:// or https://
      if (newConfig.webrtcServer) {
        if (newConfig.webrtcServer.startsWith("ws://")) {
          newConfig.webrtcServer = newConfig.webrtcServer.replace(
            "ws://",
            "http://"
          );
          console.log("[RuntimeConfig] Converted WebRTC ws:// URL to http://");
        } else if (newConfig.webrtcServer.startsWith("wss://")) {
          newConfig.webrtcServer = newConfig.webrtcServer.replace(
            "wss://",
            "https://"
          );
          console.log(
            "[RuntimeConfig] Converted WebRTC wss:// URL to https://"
          );
        } else if (
          !newConfig.webrtcServer.startsWith("http://") &&
          !newConfig.webrtcServer.startsWith("https://")
        ) {
          // If no protocol, add http://
          newConfig.webrtcServer = `http://${newConfig.webrtcServer}`;
          console.log(
            "[RuntimeConfig] Added HTTP protocol to WebRTC Server URL"
          );
        }

        // Ensure trailing slash for WebRTC server
        if (!newConfig.webrtcServer.endsWith("/")) {
          newConfig.webrtcServer = `${newConfig.webrtcServer}/`;
          console.log(
            "[RuntimeConfig] Added trailing slash to WebRTC server URL"
          );
        }
      }

      // 4. App URL - ensure it has http:// or https:// prefix
      if (
        newConfig.appUrl &&
        !newConfig.appUrl.startsWith("http://") &&
        !newConfig.appUrl.startsWith("https://")
      ) {
        newConfig.appUrl = `http://${newConfig.appUrl}`;
        console.log("[RuntimeConfig] Added HTTP protocol to App URL");
      }

      // 5. WebSocket path - ensure it starts with a slash
      if (newConfig.wsUrl && !newConfig.wsUrl.startsWith("/")) {
        newConfig.wsUrl = `/${newConfig.wsUrl}`;
        console.log("[RuntimeConfig] Added leading slash to WebSocket path");
      }

      // Log normalized configuration
      console.log("[RuntimeConfig] Normalized configuration:", newConfig);

      // Set the validated configuration
      setConfig(newConfig);
      setIsLoading(false);
      setRetryCount(0); // Reset retry count on successful fetch
      setError(null);
    } catch (error) {
      console.error("[RuntimeConfig] Error fetching config:", error);

      // Set error state but keep using the default/current config
      setError(error instanceof Error ? error : new Error(String(error)));
      setIsLoading(false);

      // Increment retry counter for next attempt, but limit maximum retries
      if (retryCount < 5) {
        setRetryCount((prev) => prev + 1);
      }
    } finally {
      setFetchInProgress(false);
      setLastFetchTime(Date.now());
    }
  };

  // Fetch config on mount with proper retry logic
  useEffect(() => {
    // Initial fetch on mount
    if (retryCount === 0 && lastFetchTime === 0) {
      fetchConfig();
    }

    // Set up retry with exponential backoff if needed
    if (retryCount > 0 && retryCount < 5) {
      // Exponential backoff: 2s, 4s, 8s, 16s, 32s max
      const backoffDelay = Math.min(2000 * 2 ** (retryCount - 1), 30000);
      console.log(
        `[RuntimeConfig] Will retry fetch in ${backoffDelay}ms (attempt ${
          retryCount + 1
        })`
      );

      const retryTimer = setTimeout(fetchConfig, backoffDelay);
      return () => clearTimeout(retryTimer);
    } else if (retryCount >= 5) {
      // After 5 retries, back off significantly to avoid hammering the server
      console.warn(
        "[RuntimeConfig] Max retries reached, severely limiting further attempts"
      );
      const longRetryTimer = setTimeout(() => setRetryCount(1), 120000); // Reset to 1 after 2 minutes
      return () => clearTimeout(longRetryTimer);
    }
  }, [retryCount]);

  // Function to manually refresh the config
  const refreshConfig = async () => {
    // Reset retry count and trigger a fresh fetch
    setRetryCount(0);
    await fetchConfig();
  };

  return (
    <RuntimeConfigContext.Provider
      value={{ config, isLoading, error, refreshConfig }}
    >
      {children}
    </RuntimeConfigContext.Provider>
  );
};

export const useRuntimeConfig = () => {
  const context = useContext(RuntimeConfigContext);
  if (context === undefined) {
    throw new Error(
      "useRuntimeConfig must be used within a RuntimeConfigProvider"
    );
  }
  return context;
};
