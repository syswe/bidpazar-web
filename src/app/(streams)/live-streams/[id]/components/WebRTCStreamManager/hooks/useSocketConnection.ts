import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
import { logger } from "@/lib/logger";
import { normalizeSocketIOUrl } from "../utils/network";
import { logInfo, logError, logWarn } from "../utils/logging";
import { getSessionInfo, storeSessionInfo, getStoredConnectionInfo, storeConnectionInfo } from "../utils/storage";
import { socketPromise } from "../utils/network";
import { MediasoupDevice, RouterRtpCapabilitiesResponse, LogData } from "../types";

interface UseSocketConnectionProps {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
  isAnonymous: boolean;
  sessionId: string;
  onConnectionStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'streaming') => void;
  onError: (error: string | null) => void;
  onDeviceInitialized: (rtpCapabilities: any) => void;
  onParticipantCount?: (count: number) => void;
  onStreamerReady?: () => void;
  onViewerReady?: (producers?: Array<{ producerId: string; kind: string; peerId: string }>) => void;
  onConnectionError?: (error: {
    type: string;
    message: string;
    canReconnect: boolean;
    isLoopback?: boolean;
    details?: any;
  }) => void;
  deviceRef: React.MutableRefObject<MediasoupDevice | null>;
  rtpCapabilitiesRef: React.MutableRefObject<any | null>;
  onLoopbackDetected?: (isLoopback: boolean) => void;
  isLoopbackConnection?: boolean;
  optimizeForLoopback?: boolean;
}

export function useSocketConnection({
  streamId,
  userId,
  username,
  isStreamer,
  isAnonymous,
  sessionId,
  onConnectionStatusChange,
  onError,
  onDeviceInitialized,
  onParticipantCount,
  onStreamerReady,
  onViewerReady,
  onConnectionError,
  deviceRef,
  rtpCapabilitiesRef,
  onLoopbackDetected,
  isLoopbackConnection,
  optimizeForLoopback
}: UseSocketConnectionProps) {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef<boolean>(false);
  const connectInProgressRef = useRef<boolean>(false);
  const hasActiveConnection = useRef<boolean>(false);
  const connectionAttemptsRef = useRef<number>(0);
  const reconnectionCounterRef = useRef<number>(0);
  const lastReconnectionTimeRef = useRef<number>(0);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [reconnectionFailed, setReconnectionFailed] = useState<boolean>(false);
  const [detectedLoopback, setDetectedLoopback] = useState<boolean>(false);
  const effectiveUserId = userId;

  // Helper to check if a URL is a loopback URL
  const isLoopbackAddress = useCallback((address?: string): boolean => {
    if (!address) return false;

    // Remove IPv6 brackets if present
    if (address.startsWith("[") && address.endsWith("]")) {
      address = address.substring(1, address.length - 1);
    }

    return (
      address === "localhost" ||
      address === "127.0.0.1" ||
      address === "::1" ||
      address === "0.0.0.0" ||
      address === "::" ||
      // Also check for full IPv6 localhost
      address === "0:0:0:0:0:0:0:1"
    );
  }, []);

  const isLoopbackUrl = useCallback(
    (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);
        return isLoopbackAddress(parsedUrl.hostname);
      } catch (e) {
        return false; // Invalid URL
      }
    },
    [isLoopbackAddress]
  );

  // Main connection function
  const connectToSignalingServer = useCallback(() => {
    if (
      !mountedRef.current ||
      !streamId ||
      connectInProgressRef.current ||
      (socketRef.current && socketRef.current.connected)
    ) {
      return;
    }

    connectInProgressRef.current = true;
    connectionAttemptsRef.current += 1;

    logInfo("connectToSignalingServer called", {
      sessionId,
      attemptNumber: connectionAttemptsRef.current,
    });

    let effectiveSocketUrl = normalizeSocketIOUrl(
      runtimeConfig?.socketUrl || window.location.origin
    );
    const configSocketUrl = runtimeConfig?.socketUrl || "";
    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";
    const locationOrigin = window.location.origin;

    const wsPath = runtimeConfig?.wsUrl || "/socket.io"; // No trailing slash

    logInfo("Signaling server connection details", {
      effectiveSocketUrl,
      configSocketUrl,
      envSocketUrl,
      locationOrigin,
      wsPath,
      sessionId,
      isReconnect: reconnectionCounterRef.current > 0,
    });

    // Detect if this might be a loopback connection
    if (isLoopbackUrl(effectiveSocketUrl)) {
      logWarn("Detected Socket.IO connection to a loopback address", {
        socketUrl: effectiveSocketUrl,
        hostname: window.location.hostname,
      });
      setDetectedLoopback(true);
      if (onLoopbackDetected) {
        onLoopbackDetected(true);
      }
    }

    // Improved configuration with exponential backoff
    const socket = io(effectiveSocketUrl, {
      path: wsPath, // Using the path without trailing slash
      query: {
        streamId,
        userId: effectiveUserId,
        username,
        isStreamer: isStreamer ? 1 : 0,
        sessionId,
        isAnonymous: isAnonymous ? 1 : 0,
      },
      transports: ["websocket", "polling"], // Try both transports
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 8, // Increase from 5 to 8
      reconnectionDelay: Math.min(
        1000 * Math.pow(1.5, connectionAttemptsRef.current),
        10000
      ), // Exponential backoff
      reconnectionDelayMax: 15000, // Increased from 8000 to 15000
      timeout: 30000, // Increased timeout to allow for slower connections
      forceNew: true, // Force a new connection each time to prevent reusing existing problematic connections
      // Fix for trailing slash issues in Next.js 13+
      addTrailingSlash: false,
    });

    socketRef.current = socket;

    // Enhanced socket error handlers
    socket.io.on("error", (err) => {
      logError("Socket.IO engine error", err);

      // Report to parent component
      if (onConnectionError) {
        onConnectionError({
          type: "SOCKET_ENGINE_ERROR",
          message: `Connection error: ${err.message || "Unknown socket error"}`,
          canReconnect: true,
        });
      }
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      logInfo(`Socket.IO reconnect attempt ${attempt}`);

      // Update UI to show reconnection is in progress
      onConnectionStatusChange("connecting");
      setIsRecovering(true);

      // Store session info for recovery
      const handleDisconnection = () => {
        if (deviceRef.current?.loaded) {
          const sessionData = {
            streamId,
            userId: effectiveUserId,
            deviceCapabilities: deviceRef.current?.rtpCapabilities,
            timestamp: Date.now(),
            isStreamer,
            sessionId,
          };

          storeSessionInfo(streamId, effectiveUserId, sessionData);
          logInfo("Session info stored for possible recovery", {
            sessionId,
            streamId,
            timestamp: sessionData.timestamp,
          });
        }
      };

      // Only store on first reconnect attempt to avoid overwrites
      if (attempt === 1) {
        handleDisconnection();
      }
    });

    socket.io.on("reconnect_error", (error) => {
      logError("Socket.IO reconnect error", error);

      // If we're trying to recover, show appropriate status
      if (isRecovering) {
        // If reconnection fails multiple times, we might need to give up
        if (reconnectionCounterRef.current > 5) {
          setIsRecovering(false);
          onConnectionStatusChange("disconnected");
          setReconnectionFailed(true); // Set this to true to show retry button
          onError(
            "Connection lost. Please try to reconnect or refresh the page."
          );

          if (onConnectionError) {
            onConnectionError({
              type: "RECONNECT_FAILED",
              message: "Failed to reconnect after multiple attempts",
              canReconnect: true, // Set to true since we have a manual retry
            });
          }
        }
      }
    });

    socket.io.on("reconnect_failed", () => {
      logError("Socket.IO reconnect failed after all attempts");
      // Reset connection flags to allow manual reconnection attempts
      connectInProgressRef.current = false;
      setIsRecovering(false);
      setReconnectionFailed(true); // Set this to true to show retry button

      // Report to parent component that connection failed permanently
      if (onConnectionError) {
        onConnectionError({
          type: "RECONNECT_FAILED",
          message: "Connection failed after multiple attempts",
          canReconnect: true, // Set to true since we have a manual retry
        });
      }
    });

    socket.io.on("reconnect", (attempt) => {
      logInfo(`Socket.IO reconnected after ${attempt} attempts`);
      reconnectionCounterRef.current += 1;
      lastReconnectionTimeRef.current = Date.now();

      // Reset connection flag on successful reconnection
      connectInProgressRef.current = false;

      // Attempt session recovery
      const handleReconnection = async () => {
        const sessionData = getSessionInfo(streamId, effectiveUserId);

        if (
          sessionData &&
          sessionData.timestamp &&
          Date.now() - sessionData.timestamp < 5 * 60 * 1000
        ) {
          // Only recover sessions less than 5 minutes old

          logInfo("Attempting to recover session from stored data", {
            sessionId,
            timeSinceDisconnection: Date.now() - sessionData.timestamp,
          });

          // If we have device capabilities stored, try to use them
          if (sessionData.deviceCapabilities && deviceRef.current) {
            try {
              // If device is already loaded, we can skip reloading
              if (!deviceRef.current.loaded) {
                await deviceRef.current.load({
                  routerRtpCapabilities: sessionData.deviceCapabilities,
                });
                logInfo("Recovered device capabilities from stored session", {
                  sessionId: sessionData.sessionId,
                });
              }

              // Send stored capabilities to the server
              if (socketRef.current?.connected) {
                logInfo("Sending recovered device capabilities to server");

                socketRef.current.emit("connectRtpCapabilities", {
                  rtpCapabilities: deviceRef.current.rtpCapabilities,
                  streamId,
                  isReconnection: true,
                  sessionId: sessionData.sessionId,
                });
              }
            } catch (err) {
              logError("Failed to recover session", {
                error: err instanceof Error ? err.message : String(err)
              });
              // Fall back to normal connection process
              if (socketRef.current?.connected) {
                socketRef.current.emit("getRouterRtpCapabilities", {
                  streamId,
                });
              }
            }
          } else {
            logInfo(
              "No device capabilities found in stored session, requesting new ones"
            );
            if (socketRef.current?.connected) {
              socketRef.current.emit("getRouterRtpCapabilities", { streamId });
            }
          }
        } else {
          logInfo(
            "No valid session data found or session too old, starting fresh connection"
          );
          if (socketRef.current?.connected) {
            socketRef.current.emit("getRouterRtpCapabilities", { streamId });
          }
        }

        // Update the connection info to mark it as active again
        const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
        if (storedInfo) {
          storeConnectionInfo(streamId, effectiveUserId, {
            ...storedInfo,
            isActive: true,
            timestamp: Date.now(),
          });
        }
      };

      handleReconnection();
    });

    // Existing connect handler
    socket.on("connect", () => {
      if (!mountedRef.current) {
        logWarn("Socket connected but component unmounted, cleaning up");
        socket.disconnect();
        return;
      }

      // Reset reconnection counter on successful connection
      reconnectionCounterRef.current = 0;
      lastReconnectionTimeRef.current = Date.now();

      logInfo("Socket connected", {
        socketId: socket.id,
        streamId,
        userId: effectiveUserId,
        sessionId,
        transportType: socket.io.engine.transport.name, // Log the actual transport type that succeeded
      });

      // Mark this component as having an active connection
      hasActiveConnection.current = true;
      connectInProgressRef.current = false;
      onConnectionStatusChange("connected");
      onError(null);
      connectionAttemptsRef.current = 0; // Reset attempts on successful connection

      // Request router capabilities after successful connection
      socket.emit(
        "getRouterRtpCapabilities",
        { streamId, sessionId },
        (response: RouterRtpCapabilitiesResponse) => {
          if (!mountedRef.current) return;

          if (response.error) {
            logError("Failed to get router capabilities", {
              error: response.error,
            });
            onError(`Failed to initialize media: ${response.error}`);
            return;
          }

          // Store RTP capabilities for later use
          if (response.rtpCapabilities) {
            rtpCapabilitiesRef.current = response.rtpCapabilities;
          }

          // Don't show error for duplicate connection, try to continue anyway
          if (response.duplicateConnection) {
            logWarn(
              "Server reported duplicate connection but we'll try to continue",
              {
                existingSocketId: response.existingSocketId,
              }
            );

            // Store the duplicate connection info
            if (response.existingSocketId) {
              // This may be common during development with HMR, but should be rare in production
              logInfo("Handling potential duplicate connection scenario", {
                newSocketId: socket.id,
                existingSocketId: response.existingSocketId,
                streamId,
              });

              // Set state variables to prevent disruption
              hasActiveConnection.current = true;

              // Continue with normal flow but add a delay for the server to clean up previous connection
              setTimeout(() => {
                if (!mountedRef.current) return;

                if (response.rtpCapabilities) {
                  onDeviceInitialized(response.rtpCapabilities);
                }
              }, 300);

              return; // Skip the immediate initialization below
            }
          }

          logInfo("Received router capabilities", {
            capabilities: response.rtpCapabilities,
          });

          if (response.rtpCapabilities) {
            onDeviceInitialized(response.rtpCapabilities);
          } else {
            logError("No RTP capabilities received from server");
            onError(
              "Failed to initialize media: No RTP capabilities received"
            );
          }
        }
      );

      // Mark connection as active in localStorage
      const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
      if (storedInfo) {
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: true,
          timestamp: Date.now(),
        });
      }

      // Announce broadcaster or viewer readiness
      if (isStreamer) {
        logInfo("Emitting broadcaster_ready signal", { streamId, sessionId });
        socket.emit("broadcaster_ready", { streamId, sessionId });
      } else {
        logInfo("Emitting viewer_ready signal", { streamId, sessionId });
        socket.emit("viewer_ready", { streamId, sessionId });
      }
    });

    // Add a handler for server-side errors
    socket.on(
      "error",
      (data: {
        message: string;
        code?: string;
        details?: any;
        canReconnect?: boolean;
      }) => {
        if (!mountedRef.current) return;

        logError(`Server reported error: ${data.message}`, {
          code: data.code,
          details: data.details,
          canReconnect: data.canReconnect,
        });

        // Set the error message for the user
        onError(data.message);

        // If the server indicates we can reconnect, try that
        if (data.canReconnect) {
          logInfo("Will attempt to reconnect based on server suggestion");

          // Wait a moment then try reconnecting
          setTimeout(() => {
            if (mountedRef.current) {
              connectionAttemptsRef.current = 0;
              onConnectionStatusChange("disconnected");
              connectToSignalingServer();
            }
          }, 2000);
        }

        // Report the error to parent component if callback is provided
        if (onConnectionError) {
          onConnectionError({
            type: data.code || "SERVER_ERROR",
            message: data.message,
            canReconnect: !!data.canReconnect,
          });
        }
      }
    );

    // Set up broadcaster_ready and viewer_ready event handlers
    if (!isStreamer) {
      // Viewer listens for broadcaster ready events
      socket.on("broadcaster_ready", (data) => {
        logInfo("Received broadcaster_ready event", {
          broadcasterSocketId: data.broadcasterSocketId,
          broadcasterUserId: data.broadcasterUserId,
          streamId: data.streamId,
          activeProducers: data.activeProducers,
        });

        // Call streamer ready callback
        if (onStreamerReady) {
          onStreamerReady();
        }

        // If we have active producers, process them
        if (data.activeProducers && data.activeProducers.length > 0) {
          logInfo(
            `Broadcaster has ${data.activeProducers.length} active producers`
          );
          if (deviceRef.current?.loaded && onViewerReady) {
            onViewerReady(data.activeProducers);
          }
        }
      });

      // Handle viewer_ready_response with active producers info
      socket.on("viewer_ready_response", (data) => {
        logInfo("Received viewer_ready_response event", {
          broadcasterSocketId: data.broadcasterSocketId,
          broadcasterUserId: data.broadcasterUserId,
          hasActiveStreamer: data.hasActiveStreamer,
          activeProducers: data.activeProducers,
        });

        // If we have active producers, process them
        if (data.activeProducers && data.activeProducers.length > 0) {
          logInfo(`Stream has ${data.activeProducers.length} active producers`);
          if (deviceRef.current?.loaded && onViewerReady) {
            onViewerReady(data.activeProducers);
          }
        } else if (!data.hasActiveStreamer) {
          onError("The streamer is not currently broadcasting");
        }
      });

      // Send viewer ready event after connection
      socket.emit("viewer_ready", {
        streamId,
        sessionId,
      });
    } else {
      // Broadcaster listens for viewer ready events
      socket.on("viewer_connected", (data) => {
        logInfo("Received viewer_connected event", {
          viewerSocketId: data.viewerSocketId,
          viewerUserId: data.viewerUserId,
          streamId: data.streamId,
        });
      });

      // Handle broadcaster_ready_confirmed to know the server recognized us
      socket.on("broadcaster_ready_confirmed", (data) => {
        logInfo("Broadcaster ready confirmed by server", {
          success: data.success,
          roomState: data.roomState,
        });

        // Update UI state to show we're successfully broadcasting
        if (data.success) {
          onConnectionStatusChange("streaming");
          onError(""); // Clear any previous errors

          // Update participant count if provided
          if (data.roomState && typeof data.roomState.viewers === "number" && onParticipantCount) {
            onParticipantCount(data.roomState.viewers);
          }
        }
      });
    }

    // Set up additional debug event to monitor connection quality
    socket.io.engine.on("upgrade", (transport) => {
      logInfo("Socket.IO transport upgraded", {
        from: socket.io.engine.transport.name,
        to: transport.name,
      });
    });

    socket.on("participant_count", (data: { count: number }) => {
      if (mountedRef.current && onParticipantCount) {
        onParticipantCount(data.count);
      }
    });

    // Add an rtpCapabilities event handler and store the value
    socket.on("rtpCapabilities", (rtpCapabilities) => {
      logInfo("Received RTP capabilities from server");
      rtpCapabilitiesRef.current = rtpCapabilities;
    });

    return socket;
  }, [
    runtimeConfig,
    streamId,
    effectiveUserId,
    username,
    isStreamer,
    isAnonymous,
    sessionId,
    onConnectionStatusChange,
    onError,
    onConnectionError,
    onDeviceInitialized,
    onParticipantCount,
    onStreamerReady,
    onViewerReady,
    deviceRef,
    rtpCapabilitiesRef,
    isLoopbackUrl,
    onLoopbackDetected
  ]);

  // Component lifecycle management
  useEffect(() => {
    mountedRef.current = true;

    // Function to explicitly clear connection state on page unload/refresh
    const handleBeforeUnload = () => {
      // Set flag to indicate we're cleaning up due to page navigation
      logInfo(
        "Page navigation detected, cleaning up WebRTC connections before unload",
        {
          streamId,
          sessionId,
        }
      );

      // Update connection info in localStorage to indicate navigation
      const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
      if (storedInfo) {
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: false,
          timestamp: Date.now(), // Update timestamp for refresh detection
        });
      }

      // Force disconnect socket
      if (socketRef.current) {
        logInfo("Disconnecting socket on unmount", {
          socketId: socketRef.current.id,
        });

        socketRef.current.disconnect();
      }

      // Clean up the flag that might cause duplicate connection errors
      hasActiveConnection.current = false;
    };

    // Add page visibility change handler to detect tab switching
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logInfo("Tab became visible again");

        // Update stored connection info
        const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
        if (storedInfo && !storedInfo.isActive && hasActiveConnection.current) {
          // Update connection info
          storeConnectionInfo(streamId, effectiveUserId, {
            ...storedInfo,
            isActive: true,
            timestamp: Date.now(),
          });
        }
      } else {
        logInfo("Tab became hidden");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Add network status event listeners for troubleshooting
    const handleOnline = () => {
      logInfo("Network connection restored");

      // If we were in an error state, try reconnecting
      if (mountedRef.current) {
        connectionAttemptsRef.current = 0; // Reset for fresh attempt
        connectToSignalingServer();
      }
    };

    const handleOffline = () => {
      logWarn("Network connection lost");
      onError("Network connection lost. Waiting for reconnection...");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      mountedRef.current = false;

      logInfo("Component unmounting, cleaning up resources");

      // Close socket connection
      if (socketRef.current) {
        logInfo("Disconnecting socket on unmount", {
          socketId: socketRef.current.id,
        });
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Reset all refs to ensure a fresh start if remounted
      connectInProgressRef.current = false;
      connectionAttemptsRef.current = 0;
      hasActiveConnection.current = false; // Immediately set to false to avoid duplicate connection issues

      // Mark connection as inactive in localStorage
      const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
      if (storedInfo) {
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: false,
          timestamp: Date.now(),
        });
      }
    };
  }, [streamId, userId, effectiveUserId, isStreamer, connectToSignalingServer]);

  // Manual reconnection function that can be called externally
  const triggerManualReconnect = useCallback(() => {
    logInfo("Manual reconnection triggered");

    // Store session info before attempting reconnection
    if (deviceRef.current?.loaded) {
      const sessionData = {
        streamId,
        userId: effectiveUserId,
        deviceCapabilities: deviceRef.current?.rtpCapabilities,
        timestamp: Date.now(),
        isStreamer,
        sessionId,
      };

      storeSessionInfo(streamId, effectiveUserId, sessionData);
    }

    // If reconnection has failed previously, clear stored session data
    // for a completely fresh start
    if (reconnectionFailed) {
      logInfo("Clearing stored session data for a fresh reconnection");
      const clearSessionInfo = (streamId: string, userId: string) => {
        try {
          localStorage.removeItem(`webrtc-session-${streamId}-${userId}`);
          return true;
        } catch (e) {
          return false;
        }
      };
      const clearConnectionInfo = (streamId: string, userId: string) => {
        try {
          localStorage.removeItem(`webrtc-connection-${streamId}-${userId}`);
          return true;
        } catch (e) {
          return false;
        }
      };
      
      clearSessionInfo(streamId, effectiveUserId);
      clearConnectionInfo(streamId, effectiveUserId);
    }

    // Disconnect current socket
    if (socketRef.current?.connected) {
      logInfo("Disconnecting current socket for manual reconnection");
      socketRef.current.disconnect();
    }

    // Reset connection state
    connectInProgressRef.current = false;
    connectionAttemptsRef.current = 0;

    // Update UI
    onConnectionStatusChange("connecting");
    setIsRecovering(true);
    onError(null); // Clear any previous errors

    // Short delay to ensure proper disconnect before reconnect
    setTimeout(() => {
      if (mountedRef.current) {
        connectToSignalingServer();
      }
    }, 1000);
  }, [
    streamId,
    effectiveUserId,
    isStreamer,
    sessionId,
    connectToSignalingServer,
    reconnectionFailed,
    onConnectionStatusChange,
    onError,
  ]);

  // Initialize connection when component mounts and config is loaded
  useEffect(() => {
    if (!isConfigLoading && runtimeConfig && mountedRef.current && !socketRef.current) {
      connectToSignalingServer();
    }
  }, [isConfigLoading, runtimeConfig, connectToSignalingServer]);

  return {
    socket: socketRef.current,
    isRecovering,
    reconnectionFailed,
    triggerManualReconnect,
    isLoopback: detectedLoopback
  };
} 