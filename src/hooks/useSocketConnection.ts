import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

// Define our enhanced socket type with safeEmit function
export interface EnhancedSocket extends Socket {
  safeEmit: <T = unknown>(
    event: string,
    data: unknown,
    callback?: (response: T) => void
  ) => boolean;
}

// Define authentication error type
export interface AuthError {
  message: string;
  code?: string;
  details?: unknown;
}

// Define the options for the hook
interface UseSocketOptions {
  url: string;
  authToken?: string | null;
  userId?: string | null;
  username?: string | null;
  query?: Record<string, string>;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  enableToasts?: boolean;
  onConnect?: (socket: EnhancedSocket) => void;
  onDisconnect?: (reason: string) => void;
  onAuthError?: (error: AuthError) => void;
}

// Debug utility function
const debugLog = (message: string, data?: unknown) => {
  console.log(`[Socket Debug] ${message}`, data ? data : "");
};

const debugError = (message: string, error: unknown) => {
  console.error(`[Socket Error] ${message}`, error);

  // Log additional details if available
  if (error && typeof error === "object" && "message" in error) {
    console.error(
      `[Socket Error Details] Message: ${(error as Error).message}`
    );
  }
  if (error && typeof error === "object" && "stack" in error) {
    console.error(`[Socket Error Stack] ${(error as Error).stack}`);
  }
};

/**
 * Custom hook to manage socket.io connections with enhanced features:
 * - Automatic reconnection
 * - Event queueing when disconnected
 * - Safe event emission
 * - Connection status tracking
 * - Toast notifications
 */
export function useSocketConnection({
  url,
  authToken,
  userId,
  username,
  query = {},
  autoConnect = true,
  reconnectionAttempts = 10,
  enableToasts = true,
  onConnect,
  onDisconnect,
  onAuthError,
}: UseSocketOptions) {
  // Socket state
  const [socket, setSocket] = useState<EnhancedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Event queue reference
  const eventQueueRef = useRef<
    Array<{
      event: string;
      data: unknown;
      callback?: (response: unknown) => void;
    }>
  >([]);

  // Track reconnection attempts
  const reconnectCountRef = useRef(0);

  // Create and manage socket connection
  useEffect(() => {
    if (!url) {
      debugLog("No URL provided, skipping socket connection");
      return;
    }

    debugLog(`Setting up socket connection to ${url}`, {
      authTokenProvided: !!authToken,
      userIdProvided: !!userId,
      usernameProvided: !!username,
      queryParams: query,
      autoConnect,
      reconnectionAttempts,
    });

    try {
      // Prepare authentication data
      const auth: Record<string, string> = {};
      if (authToken) {
        auth.token = authToken;
      }

      // Prepare query parameters
      const finalQuery: Record<string, string> = { ...query };

      // Set user information in query if no auth token is available
      if (!authToken && userId) {
        finalQuery.userId = userId;
        finalQuery.username = username || "Anonymous";
        finalQuery.isAnonymous = "true";
      } else if (!authToken) {
        // Generate guest identity if no auth and no explicit userId
        const guestId = `guest-${Math.random().toString(36).substring(2, 10)}`;
        finalQuery.userId = guestId;
        finalQuery.username = "Anonymous Guest";
        finalQuery.isAnonymous = "true";
      }

      // Configure socket
      const socketIo = io(url, {
        auth: Object.keys(auth).length > 0 ? auth : undefined,
        query: finalQuery,
        // Connection options
        reconnection: true,
        reconnectionAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ["polling", "websocket"], // Start with polling for more reliable connection
        autoConnect,
      }) as EnhancedSocket;

      // Process event queue
      const processEventQueue = () => {
        debugLog(
          `Processing queued events: ${eventQueueRef.current.length} events pending`
        );

        while (eventQueueRef.current.length > 0) {
          const event = eventQueueRef.current.shift();
          if (event && socketIo.connected) {
            debugLog(`Sending queued event: ${event.event}`, {
              dataType: typeof event.data,
            });
            try {
              socketIo.emit(event.event, event.data, event.callback);
            } catch (error) {
              debugError(`Failed to emit queued event: ${event.event}`, error);
            }
          }
        }
      };

      // Add safeEmit function to socket
      socketIo.safeEmit = <T>(
        event: string,
        data: unknown,
        callback?: (response: T) => void
      ): boolean => {
        try {
          if (socketIo.connected) {
            debugLog(`Emitting event: ${event}`, { dataType: typeof data });
            // Type assertion to handle the callback type conversion safely
            socketIo.emit(
              event,
              data,
              callback as unknown as (response: unknown) => void
            );
            return true;
          } else {
            // Queue important events for later
            if (
              [
                "send-message",
                "place-bid",
                "start-countdown",
                "stop-countdown",
              ].includes(event)
            ) {
              debugLog(`Socket disconnected, queuing event: ${event}`);
              eventQueueRef.current.push({
                event,
                data,
                callback: callback as unknown as (response: unknown) => void,
              });

              if (enableToasts) {
                toast.info(
                  "You're currently offline. Your action will be sent when reconnected."
                );
              }
            } else {
              debugLog(
                `Socket disconnected, dropping non-critical event: ${event}`
              );
            }
            return false;
          }
        } catch (error) {
          debugError(`Error in safeEmit for event: ${event}`, error);
          return false;
        }
      };

      // Socket event handlers
      socketIo.on("connect", () => {
        debugLog(`Socket connected with ID: ${socketIo.id}`);
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectCountRef.current = 0;

        if (enableToasts && isReconnecting) {
          toast.success("Reconnected to server!");
        }

        // Process any queued events
        processEventQueue();

        // Call onConnect callback if provided
        try {
          if (onConnect) {
            debugLog("Calling onConnect callback");
            onConnect(socketIo);
          }
        } catch (error) {
          debugError("Error in onConnect callback", error);
        }
      });

      // Handle authentication confirmation
      socketIo.on(
        "auth:status",
        (data: {
          authenticated: boolean;
          userId: string;
          username: string;
        }) => {
          debugLog("Received authentication status", data);
          setIsAuthenticated(data.authenticated);

          if (data.authenticated && enableToasts) {
            toast.success(`Authenticated as ${data.username}`);
          }
        }
      );

      // Handle authentication errors
      socketIo.on("auth_error", (error) => {
        debugError("Authentication error", error);
        setIsAuthenticated(false);

        if (enableToasts) {
          toast.error("Authentication failed. Some features may be limited.");
        }

        if (onAuthError) {
          onAuthError(error);
        }
      });

      socketIo.on("connect_error", (error) => {
        debugError("Socket connection error", error);
        setIsConnected(false);
        setIsReconnecting(true);

        if (enableToasts && reconnectCountRef.current === 0) {
          toast.error("Connection error. Retrying...");
        }
      });

      socketIo.on("reconnect_attempt", (attemptNumber) => {
        debugLog(`Attempting to reconnect... (attempt ${attemptNumber})`);
        reconnectCountRef.current = attemptNumber;
        setIsReconnecting(true);

        // Show toast only on certain attempts to avoid spam
        if (enableToasts && attemptNumber % 3 === 1) {
          toast.info(`Reconnecting... (attempt ${attemptNumber})`);
        }
      });

      socketIo.on("reconnect_failed", () => {
        debugError("Failed to reconnect after all attempts", {
          attempts: reconnectionAttempts,
        });
        setIsReconnecting(false);

        if (enableToasts) {
          toast.error("Failed to reconnect. Please refresh the page.");
        }
      });

      socketIo.on("disconnect", (reason) => {
        debugLog(`Socket disconnected: ${reason}`);
        setIsConnected(false);

        // Don't show error for normal disconnects
        if (
          enableToasts &&
          reason !== "io client disconnect" &&
          reason !== "io server disconnect"
        ) {
          setIsReconnecting(true);
          toast.error("Disconnected from server. Attempting to reconnect...");
        }

        // Call onDisconnect callback if provided
        try {
          if (onDisconnect) {
            debugLog("Calling onDisconnect callback", { reason });
            onDisconnect(reason);
          }
        } catch (error) {
          debugError("Error in onDisconnect callback", error);
        }
      });

      socketIo.on("error", (error) => {
        debugError("Socket error event", error);
      });

      // Respond to server heartbeats
      socketIo.on("heartbeat", (data: { timestamp: number }) => {
        debugLog("Received heartbeat", data);
        try {
          socketIo.emit("heartbeat-response", data);
        } catch (error) {
          debugError("Error responding to heartbeat", error);
        }
      });

      // Set socket in state
      setSocket(socketIo);

      // Cleanup on unmount
      return () => {
        debugLog("Cleaning up socket connection");
        try {
          socketIo.disconnect();
        } catch (error) {
          debugError("Error during socket cleanup", error);
        }
      };
    } catch (error) {
      debugError("Critical error during socket setup", error);
      if (enableToasts) {
        toast.error("Failed to establish connection. Please refresh the page.");
      }
    }
  }, [
    url,
    authToken,
    userId,
    username,
    autoConnect,
    reconnectionAttempts,
    enableToasts,
    isReconnecting,
    onConnect,
    onDisconnect,
    onAuthError,
    query,
  ]);

  return {
    socket,
    isConnected,
    isReconnecting,
    isAuthenticated,

    // Helper function to send events safely
    sendEvent: <T = unknown>(
      event: string,
      data: unknown,
      callback?: (response: T) => void
    ): boolean => {
      try {
        if (!socket) {
          debugLog(`Cannot send event ${event}: Socket not initialized`);
          return false;
        }
        // Use a cast to preserve the generic type parameter
        return socket.safeEmit<T>(event, data, callback);
      } catch (error) {
        debugError(`Error in sendEvent for ${event}`, error);
        return false;
      }
    },

    // Helper to connect/disconnect manually
    connect: () => {
      debugLog("Manual connect attempt");
      try {
        if (socket && !socket.connected) {
          socket.connect();
        }
      } catch (error) {
        debugError("Error during manual connect", error);
      }
    },
    disconnect: () => {
      debugLog("Manual disconnect attempt");
      try {
        if (socket && socket.connected) {
          socket.disconnect();
        }
      } catch (error) {
        debugError("Error during manual disconnect", error);
      }
    },
  };
}
