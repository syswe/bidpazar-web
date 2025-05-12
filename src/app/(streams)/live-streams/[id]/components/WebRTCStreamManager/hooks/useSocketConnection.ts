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
    canCreateNewStream?: boolean;
    details?: any;
    originalMessage?: string;
  }) => void;
  deviceRef: React.MutableRefObject<MediasoupDevice | null>;
  rtpCapabilitiesRef: React.MutableRefObject<any | null>;
  onLoopbackDetected?: (isLoopback: boolean) => void;
  isLoopbackConnection?: boolean;
  optimizeForLoopback?: boolean;
}

// Global connection tracking to prevent duplicate WebSocket connections
interface ActiveConnection {
  socket: Socket;
  streamId: string;
  userId: string;
  refCount: number;
  lastConnectionTime: number;
  connectionId: string;
}

// Connection cache to prevent duplicate connections
const activeSocketConnections = new Set<string>();
const globalConnectionTracker = new Map<string, ActiveConnection>();

// More aggressive throttling specifically for streamers viewing their own streams
const CONNECTION_THROTTLE_MS = 5000; // Increased to 5 seconds for all connections
const STREAMER_SELF_VIEW_THROTTLE_MS = 10000; // 10 seconds for streamers viewing own stream
const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds timeout
const MAX_RECONNECTION_ATTEMPTS = 3; // Limit reconnection attempts
const RECONNECTION_DELAY_MS = 2000; // 2 seconds between reconnection attempts
const lastConnectionAttempts = new Map<string, number>();
const pendingConnections = new Map<string, boolean>();

// Add helper function to generate a session ID
const generateSessionId = () => {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Add helper function to generate a random ID
const generateRandomId = () => {
  return Math.random().toString(36).substring(2, 9);
};

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
  // Generate a unique connection ID for tracking
  const connectionIdRef = useRef<string>(`${streamId}-${userId}-${Date.now()}-${Math.random().toString(36).substring(2,9)}`);

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

  // Cleanup function to remove the socket connection
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      const connectionKey = `${streamId}:${userId}`;
      logInfo(`Cleaning up socket connection: ${connectionIdRef.current}`);
      
      try {
        // First check if this socket is being shared in the global tracker
        const existingGlobalConnection = globalConnectionTracker.get(connectionKey);
        
        if (existingGlobalConnection && existingGlobalConnection.socket === socketRef.current) {
          // Decrement reference count
          existingGlobalConnection.refCount--;
          
          // Only actually disconnect if this is the last reference
          if (existingGlobalConnection.refCount <= 0) {
            logInfo(`Last reference to shared socket ${connectionKey}, destroying connection`);
            
            // Unregister from global connection tracking
            globalConnectionTracker.delete(connectionKey);
            activeSocketConnections.delete(connectionIdRef.current);
            
            // Disconnect the socket
            if (socketRef.current.connected) {
              socketRef.current.disconnect();
            }
            
            // Force clear handlers
            socketRef.current.removeAllListeners();
            
            // Try to close the socket.io instance more aggressively
            if (socketRef.current.io) {
              // @ts-ignore - Internal property access
              socketRef.current.io.engine?.close();
            }
          } else {
            logInfo(`Shared socket ${connectionKey} still has ${existingGlobalConnection.refCount} references, not disconnecting`);
          }
        } else {
          // This socket is not shared or doesn't match the tracked socket, clean up directly
          activeSocketConnections.delete(connectionIdRef.current);
          
          // Disconnect
          if (socketRef.current.connected) {
            socketRef.current.disconnect();
          }
          
          // Force clear handlers
          socketRef.current.removeAllListeners();
          
          // Try to close the socket.io instance more aggressively
          if (socketRef.current.io) {
            // @ts-ignore - Internal property access
            socketRef.current.io.engine?.close();
          }
        }
      } catch (err) {
        logError("Error during socket cleanup", {
          error: err instanceof Error ? err.message : String(err),
          connectionId: connectionIdRef.current
        });
      }
      
      // Clear the reference
      socketRef.current = null;
    }
  }, [streamId, userId]);

  // Main connection function
  const connectToSignalingServer = useCallback(() => {
    if (
      !mountedRef.current ||
      !streamId ||
      connectInProgressRef.current ||
      (socketRef.current && socketRef.current.connected) ||
      pendingConnections.get(`${streamId}:${userId}`)
    ) {
      return;
    }
    
    // Create a connection key for tracking 
    const connectionKey = `${streamId}:${userId}`;
    
    // Detect if this is a streamer viewing their own stream
    const isStreamerViewingOwnStream = isStreamer && streamId.includes(userId.substring(0, 8));
    
    // Check for throttling with appropriate delay based on connection type
    const now = Date.now();
    const lastAttempt = lastConnectionAttempts.get(connectionKey) || 0;
    const throttleTime = isStreamerViewingOwnStream ? 
      STREAMER_SELF_VIEW_THROTTLE_MS : CONNECTION_THROTTLE_MS;
    
    if (now - lastAttempt < throttleTime) {
      logWarn(`Connection attempt throttled for ${connectionKey}, tried too recently`);
      
      // For streamers viewing their own stream, try to reuse an existing socket if available
      if (isStreamerViewingOwnStream) {
        const existingConnection = globalConnectionTracker.get(connectionKey);
        if (existingConnection && existingConnection.socket.connected) {
          logInfo(`Reusing existing socket for streamer self-view: ${connectionKey}`);
          socketRef.current = existingConnection.socket;
          hasActiveConnection.current = true;
          connectInProgressRef.current = false;
          pendingConnections.set(connectionKey, false);
          
          // Increment ref count
          existingConnection.refCount++;
          
          // Update state
          onConnectionStatusChange("connected");
          onError(null);
          
          // Set up event handlers
          setupSocketEventHandlers(existingConnection.socket);
          return;
        }
      }
      
      // Don't retry too quickly - schedule a single retry after throttle period
      if (!pendingConnections.get(`${connectionKey}:retry`)) {
        pendingConnections.set(`${connectionKey}:retry`, true);
        const retryTimeout = setTimeout(() => {
          pendingConnections.set(`${connectionKey}:retry`, false);
          if (mountedRef.current && !hasActiveConnection.current) {
            connectToSignalingServer();
          }
        }, throttleTime + 500); // Add a small buffer
        
        // Clean up timeout if component unmounts
        return () => clearTimeout(retryTimeout);
      }
      return;
    }

    // Update throttling tracker
    lastConnectionAttempts.set(connectionKey, now);
    
    // Check if we've reached the maximum reconnection attempts
    if (reconnectionCounterRef.current >= MAX_RECONNECTION_ATTEMPTS) {
      logWarn(`Maximum reconnection attempts (${MAX_RECONNECTION_ATTEMPTS}) reached for ${connectionKey}`);
      setReconnectionFailed(true);
      onConnectionStatusChange("disconnected");
      
      if (onConnectionError) {
        onConnectionError({
          type: "MAX_RECONNECTION_ATTEMPTS",
          message: `Maximum reconnection attempts (${MAX_RECONNECTION_ATTEMPTS}) reached`,
          canReconnect: false
        });
      }
      return;
    }
    
    // Set connection in progress
    connectInProgressRef.current = true;
    pendingConnections.set(connectionKey, true);
    connectionAttemptsRef.current += 1;
    
    // Check first if we already have a working connection we can reuse
    const existingConnection = globalConnectionTracker.get(connectionKey);
    if (existingConnection && existingConnection.socket.connected) {
      logInfo(`Reusing existing socket connection for ${connectionKey}`);
      socketRef.current = existingConnection.socket;
      hasActiveConnection.current = true;
      connectInProgressRef.current = false;
      pendingConnections.set(connectionKey, false);
      
      // Increment ref count
      existingConnection.refCount++;
      
      // Update state
      onConnectionStatusChange("connected");
      onError(null);
      
      // Set up event handlers
      setupSocketEventHandlers(existingConnection.socket);
      
      return;
    }

    // Generate unique connection ID to help with tracking
    const effectiveUserId = userId || 'anonymous';
    const connectionId = `${streamId}-${userId}-${Date.now()}-${Math.random().toString(36).substring(2,9)}`;
    connectionIdRef.current = connectionId;
    
    // Prepare connection query params
    const generatedSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2,9)}`;
    const connectionParams = {
      streamId,
      userId: effectiveUserId,
      username: username || 'Anonymous User',
      isStreamer: isStreamer ? 1 : 0,
      sessionId: sessionId || generatedSessionId,
      isAnonymous: !userId ? 1 : 0,
      connectionId,
      ts: Date.now(),
      // Add flag for loopback awareness to help server handle these connections better
      loopbackAware: 1,
      isStreamerSelfView: isStreamerViewingOwnStream ? 1 : 0
    };
    
    // Log connecting with more detail for diagnosis
    logInfo(`Connecting to WebRTC signaling server for stream ${streamId}`, {
      ...connectionParams,
      isStreamerViewingOwnStream,
      attemptNumber: connectionAttemptsRef.current,
      reconnectionCount: reconnectionCounterRef.current
    });
    
    onConnectionStatusChange("connecting");
    
    try {
      // Detect if this might be a loopback connection
      const effectiveSocketUrl = normalizeSocketIOUrl(
        runtimeConfig?.socketUrl || window.location.origin
      );

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

      // For loopback connections, especially self-view, adjust the config
      const socketConfig = {
        path: runtimeConfig?.wsUrl || '/socket.io',
        query: connectionParams,
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS, 
        reconnectionDelay: RECONNECTION_DELAY_MS,
        timeout: CONNECTION_TIMEOUT_MS,
        transports: ['websocket', 'polling'],  // Prefer WebSocket but fall back to polling
        forceNew: !isStreamerViewingOwnStream, // Allow connection reuse for self-view
      };

      // Configure socket with explicit transport config and timeout
      const socket = io(effectiveSocketUrl, socketConfig);
      
      // Set a connection timeout
      const timeoutId = setTimeout(() => {
        if (socket && !socket.connected && mountedRef.current) {
          logError(`Connection timeout after ${CONNECTION_TIMEOUT_MS}ms for ${connectionKey}`);
          
          if (onConnectionError) {
            onConnectionError({
              type: "CONNECTION_TIMEOUT",
              message: `Connection timed out after ${CONNECTION_TIMEOUT_MS}ms`,
              canReconnect: reconnectionCounterRef.current < MAX_RECONNECTION_ATTEMPTS
            });
          }
          
          // Cleanup the pending connection
          pendingConnections.set(connectionKey, false);
          reconnectionCounterRef.current++;
          connectInProgressRef.current = false;
          
          // Clean up socket
          if (!socket.connected) {
            socket.close();
          }
        }
      }, CONNECTION_TIMEOUT_MS);
      
      socketRef.current = socket;

      // Special handling for loopback connections
      socket.on('loopback_detected', (data) => {
        logInfo("Server detected loopback connection", data);
        setDetectedLoopback(true);
        
        if (onLoopbackDetected) {
          onLoopbackDetected(true);
        }
        
        // For streamers viewing their own streams, we still want to try to make it work
        if (isStreamerViewingOwnStream) {
          logInfo("Loopback connection allowed for streamer self-view");
          // We don't disconnect, let it continue
        }
      });
      
      // Setup socket connection error handlers
      socket.on("connect_error", (err: Error) => {
        logError("Socket connection error", { 
          error: err.message, 
          transportType: socket.io.engine?.transport?.name,
          canReconnect: reconnectionCounterRef.current < MAX_RECONNECTION_ATTEMPTS
        });
        
        clearTimeout(timeoutId);
        pendingConnections.set(connectionKey, false);
        
        if (mountedRef.current) {
          reconnectionCounterRef.current++;
          connectInProgressRef.current = false;
          
          if (onConnectionError) {
            onConnectionError({
              type: "SOCKET_CONNECT_ERROR",
              message: err.message,
              canReconnect: reconnectionCounterRef.current < MAX_RECONNECTION_ATTEMPTS
            });
          }
        }
      });
      
      socket.io.engine.on("error", (err: any) => {
        const errorMessage = typeof err === 'string' ? err : (err?.message || 'unknown error');
        logError("Socket.IO engine error", { 
          error: errorMessage
        });
        
        pendingConnections.set(connectionKey, false);
        
        if (mountedRef.current && onConnectionError) {
          onConnectionError({
            type: "SOCKET_ENGINE_ERROR",
            message: `Connection error: ${errorMessage}`,
            canReconnect: true
          });
        }
      });

      socket.on("connect", () => {
        if (!mountedRef.current) {
          logWarn("Socket connected but component unmounted, cleaning up");
          socket.disconnect();
          pendingConnections.set(connectionKey, false);
          clearTimeout(timeoutId);
          return;
        }

        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Reset reconnection counter on successful connection
        reconnectionCounterRef.current = 0;
        lastReconnectionTimeRef.current = Date.now();
        pendingConnections.set(connectionKey, false);

        logInfo("Socket connected", {
          socketId: socket.id,
          streamId,
          userId: effectiveUserId,
          sessionId,
          transportType: socket.io.engine.transport.name, // Log the actual transport type that succeeded
          isStreamerViewingOwnStream,
          isLoopback: detectedLoopback
        });

        // Store this connection in the global tracker to allow sharing
        globalConnectionTracker.set(connectionKey, {
          socket,
          streamId,
          userId: effectiveUserId,
          refCount: 1,
          lastConnectionTime: Date.now(),
          connectionId: connectionIdRef.current
        });
        
        // Also track by connection ID
        activeSocketConnections.add(connectionIdRef.current);

        // Update UI state
        hasActiveConnection.current = true;
        connectInProgressRef.current = false;
        
        // For loopback connections, especially if this is a streamer viewing their own stream,
        // we want to mark it connected even though it's a loopback connection
        const connectionStatus = isStreamerViewingOwnStream && detectedLoopback ? 
          "connected" : (detectedLoopback ? "connecting" : "connected");
        
        onConnectionStatusChange(connectionStatus);
        onError(null);
        connectionAttemptsRef.current = 0;
      });

      socket.on("disconnect", (reason) => {
        logWarn(`Socket disconnected: ${reason}`, {
          socketId: socket.id,
          connectionId,
          reconnectionCounter: reconnectionCounterRef.current
        });
        
        pendingConnections.set(connectionKey, false);
        
        if (mountedRef.current) {
          if (reason === "io server disconnect" || reason === "io client disconnect") {
            // The server/client has forcefully disconnected - don't attempt reconnection
            hasActiveConnection.current = false;
            onConnectionStatusChange("disconnected");
          } else {
            // For transport close and other reasons, update UI but let socket.io handle reconnect
            onConnectionStatusChange("connecting");
          }
        }
      });

      // Setup all other event handlers
      setupSocketEventHandlers(socket);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError("Error creating socket connection", { error: errorMessage });
      connectInProgressRef.current = false;
      pendingConnections.set(connectionKey, false);
      onConnectionStatusChange("disconnected");
      
      if (onConnectionError) {
        onConnectionError({
          type: "SOCKET_INIT_ERROR",
          message: errorMessage,
          canReconnect: true
        });
      }
    }
  }, [
    streamId,
    userId,
    username,
    isStreamer,
    sessionId,
    runtimeConfig,
    onConnectionStatusChange,
    onError,
    onConnectionError,
    onLoopbackDetected,
    isLoopbackUrl
    // Intentionally omitting setupSocketEventHandlers to avoid circular reference
  ]);

  // Setup event handlers for socket.io events
  const setupSocketEventHandlers = useCallback((socket: Socket) => {
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

    // Add a handler for server-side errors
    socket.on(
      "error",
      (data: {
        message: string;
        code?: string;
        details?: any;
        canReconnect?: boolean;
        canCreateNewStream?: boolean;
      }) => {
        if (!mountedRef.current) return;

        logError(`Server reported error: ${data.message}`, {
          code: data.code,
          details: data.details,
          canReconnect: data.canReconnect,
          canCreateNewStream: data.canCreateNewStream
        });

        // Set the error message for the user
        onError(data.message);
        
        // Notify parent component about the error with proper metadata
        if (onConnectionError) {
          onConnectionError({
            type: data.code || "SERVER_ERROR",
            message: `Connection error: ${data.code || "Unknown"} - ${data.message}`,
            canReconnect: data.canReconnect !== false, // Default to true unless explicitly set to false
            canCreateNewStream: !!data.canCreateNewStream,
            details: data.details,
            originalMessage: data.message
          });
        }
      }
    );

    // Set up participant count event handler
    socket.on("participant_count", (data: { count: number }) => {
      if (mountedRef.current && onParticipantCount) {
        onParticipantCount(data.count);
      }
    });
    
    // Set up broadcaster/viewer specific handlers
    if (isStreamer) {
      // Broadcaster listens for viewer ready events
      socket.on("viewer_connected", (data) => {
        logInfo("Received viewer_connected event", {
          viewerSocketId: data.viewerSocketId,
          viewerUserId: data.viewerUserId,
          streamId: data.streamId,
        });
      });
    } else {
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
    }
    
    return () => {
      // Clean up event listeners when the component unmounts
      socket.off("getRouterRtpCapabilities");
      socket.off("error");
      socket.off("participant_count");
      socket.off("broadcaster_ready");
      socket.off("viewer_connected");
    };
  }, [
    streamId, 
    sessionId, 
    onError, 
    onDeviceInitialized, 
    onConnectionError, 
    onParticipantCount,
    onStreamerReady,
    onViewerReady,
    isStreamer,
    deviceRef,
    rtpCapabilitiesRef
  ]);

  // Component lifecycle management
  useEffect(() => {
    mountedRef.current = true;

    // Create a fixed, stable connection ID that persists across component remounts
    // This helps prevent duplicate connections when the component remounts
    if (!connectionIdRef.current) {
      connectionIdRef.current = `${streamId}-${userId}-${Date.now()}-${Math.random().toString(36).substring(2,9)}`;
    }

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
      if (mountedRef.current && !hasActiveConnection.current) {
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

    // Detect if this is a streamer viewing their own stream and handle specially
    const isStreamerViewingOwnStream = isStreamer && streamId.includes(userId.substring(0, 8));
    if (isStreamerViewingOwnStream) {
      logInfo("Detected streamer viewing own stream, using special connection handling", {
        streamId,
        userId
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      mountedRef.current = false;

      logInfo("Component unmounting, cleaning up resources", {
        connectionId: connectionIdRef.current,
        streamId,
        userId: effectiveUserId
      });

      // Remove from global tracking and clean up socket properly
      activeSocketConnections.delete(connectionIdRef.current);
      cleanupSocket();

      // Reset all refs to ensure a fresh start if remounted
      connectInProgressRef.current = false;
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

      // Clean up pending connection state
      if (streamId && userId) {
        pendingConnections.set(`${streamId}:${userId}`, false);
        pendingConnections.set(`${streamId}:${userId}:retry`, false);
      }
    };
  }, [streamId, userId, effectiveUserId, isStreamer, connectToSignalingServer, cleanupSocket]);

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

    // Disconnect current socket properly
    logInfo("Cleaning up socket for manual reconnection");
    cleanupSocket();

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
    cleanupSocket
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