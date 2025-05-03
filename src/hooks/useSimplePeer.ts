import { useState, useEffect, useRef, useCallback } from "react";

// Define types for SimplePeer
export interface SimplePeerOptions {
  initiator?: boolean;
  stream?: MediaStream;
  trickle?: boolean;
  config?: RTCConfiguration;
}

// Signal data type for WebRTC
export type SignalData = {
  type?: string;
  sdp?: string;
  candidate?: RTCIceCandidate;
  [key: string]: unknown;
};

export interface SimplePeerInstance {
  signal(data: unknown): void;
  destroy(): void;
  addStream?(stream: MediaStream): void;
  removeStream?(stream: MediaStream): void;
  on(event: "signal", callback: (data: SignalData) => void): void;
  on(event: "stream", callback: (stream: MediaStream) => void): void;
  on(
    event: "track",
    callback: (track: MediaStreamTrack, stream: MediaStream) => void
  ): void;
  on(event: "connect", callback: () => void): void;
  on(event: "close", callback: () => void): void;
  on(event: "error", callback: (err: Error) => void): void;
  on(event: string, callback: (data: unknown) => void): void;
  removeAllListeners: (event: string) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
}

// Factory function type
type SimplePeerFactory = (options?: SimplePeerOptions) => SimplePeerInstance;

// Configuration for WebRTC connections
interface UseSimplePeerOptions {
  iceServers?: RTCIceServer[];
}

// Debug utility functions
const debugLog = (message: string, data?: unknown) => {
  console.log(`[WebRTC Debug] ${message}`, data ? data : "");
};

const debugError = (message: string, error: unknown) => {
  console.error(`[WebRTC Error] ${message}`, error);

  // Log additional details if available
  if (error && typeof error === "object" && "message" in error) {
    console.error(
      `[WebRTC Error Details] Message: ${(error as Error).message}`
    );
  }
  if (error && typeof error === "object" && "stack" in error) {
    console.error(`[WebRTC Error Stack] ${(error as Error).stack}`);
  }
};

// Default STUN/TURN servers - for better NAT traversal
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  // Add your TURN servers here for better connectivity through firewalls
  // {
  //   urls: 'turn:your-turn-server.com',
  //   username: 'username',
  //   credential: 'credential'
  // }
];

/**
 * Custom hook for managing WebRTC connections with SimplePeer
 * Safely loads the SimplePeer module and provides a factory function.
 */
export function useSimplePeer({
  iceServers = DEFAULT_ICE_SERVERS,
}: UseSimplePeerOptions = {}) {
  // Use ref to store the SimplePeer factory function
  const simplePeerFactoryRef = useRef<SimplePeerFactory | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load the SimplePeer module
  useEffect(() => {
    // Only load SimplePeer in client-side
    if (typeof window !== "undefined" && !isLoaded) {
      debugLog("Loading SimplePeer module...");

      // Detect browser for browser-specific configuration
      const isFirefox =
        typeof navigator !== "undefined" &&
        navigator.userAgent.includes("Firefox");

      debugLog("Browser detection", {
        isFirefox,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      });

      import("simple-peer")
        .then((module) => {
          debugLog("SimplePeer module imported successfully");

          simplePeerFactoryRef.current = (options?: SimplePeerOptions) => {
            // Add ICE servers to config
            const enhancedOptions = {
              ...options,
              config: {
                ...options?.config,
                iceServers,
              },
            };

            debugLog(
              "Creating SimplePeer instance with options",
              enhancedOptions
            );

            // Create a new instance with the 'new' keyword
            try {
              return new module.default(enhancedOptions);
            } catch (err) {
              debugError("Error creating SimplePeer instance", err);
              throw err;
            }
          };

          setIsLoaded(true);
          debugLog("SimplePeer module loaded successfully");

          // For Firefox, check WebRTC permission status and request if needed
          if (isFirefox && navigator.mediaDevices) {
            debugLog("Firefox detected, checking WebRTC permissions...");

            // Request minimal permissions to ensure WebRTC is initialized in Firefox
            navigator.mediaDevices
              .getUserMedia({ audio: true })
              .then((stream) => {
                debugLog("Audio permission granted in Firefox");
                // Clean up the stream immediately as we just need the permission
                stream.getTracks().forEach((track) => track.stop());
              })
              .catch((err) => {
                debugError("Audio permission check failed in Firefox", err);
              });
          }
        })
        .catch((error) => {
          debugError("Failed to load SimplePeer module", error);
          setError(error instanceof Error ? error : new Error(String(error)));
        });
    }
  }, [isLoaded, iceServers]);

  // Factory function to create a new peer connection
  const createPeer = useCallback(
    (options?: SimplePeerOptions): SimplePeerInstance | null => {
      if (!simplePeerFactoryRef.current) {
        debugError("SimplePeer factory not ready yet", { isLoaded });
        return null;
      }

      try {
        // Enhanced defaults based on browser detection
        const isFirefox =
          typeof navigator !== "undefined" &&
          navigator.userAgent.includes("Firefox");

        debugLog("Creating peer with browser detection", { isFirefox });

        // Default options with fallbacks
        const defaultOptions = {
          initiator: false,
          trickle: true,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
            // Add Firefox specific configuration with compatible types
            ...(isFirefox
              ? {
                  sdpSemantics: "unified-plan",
                  bundlePolicy: "max-bundle",
                }
              : {}),
          } as RTCConfiguration,
          // Set polite flag for better connection stability
          // This is especially important for Firefox
          polite: true,
        };

        const mergedOptions = {
          ...defaultOptions,
          ...options,
        };

        debugLog(
          "Creating SimplePeer instance with merged options",
          mergedOptions
        );

        // Create and return the SimplePeer instance
        const peer = simplePeerFactoryRef.current(mergedOptions);

        debugLog("SimplePeer instance created successfully", {
          options: mergedOptions,
          browser: navigator.userAgent,
        });

        return peer;
      } catch (error) {
        debugError("Error creating SimplePeer instance", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        return null;
      }
    },
    [isLoaded]
  );

  // Utility function to clean up peer connections
  const destroyPeer = useCallback((peer: SimplePeerInstance | null) => {
    if (!peer) {
      debugLog("Destroy called on null peer, ignoring");
      return;
    }

    debugLog("Destroying peer connection");

    try {
      // Remove all listeners first to prevent potential memory leaks
      const events = ["signal", "stream", "track", "connect", "close", "error"];
      events.forEach((event) => {
        try {
          debugLog(`Removing listeners for event: ${event}`);
          peer.removeAllListeners(event);
        } catch (err) {
          // Ignore errors from removeAllListeners
          debugError(`Error removing listeners for event: ${event}`, err);
        }
      });

      // Destroy the peer
      peer.destroy();
      debugLog("Peer destroyed successfully");
    } catch (err) {
      debugError("Error destroying peer", err);
    }
  }, []);

  // Helper function to monitor a peer for debugging
  const monitorPeer = useCallback(
    (peer: SimplePeerInstance | null, peerName = "unnamed") => {
      if (!peer) return null;

      debugLog(`Setting up monitoring for peer: ${peerName}`);

      const onSignal = (data: SignalData) => {
        debugLog(`Peer ${peerName} signal event`, { type: data.type });
      };

      const onConnect = () => {
        debugLog(`Peer ${peerName} connected successfully`);
      };

      const onClose = () => {
        debugLog(`Peer ${peerName} connection closed`);
      };

      const onError = (err: Error) => {
        debugError(`Peer ${peerName} encountered an error`, err);
      };

      const onStream = () => {
        debugLog(`Peer ${peerName} received stream`);
      };

      // Add all event listeners
      peer.on("signal", onSignal);
      peer.on("connect", onConnect);
      peer.on("close", onClose);
      peer.on("error", onError);
      peer.on("stream", onStream);

      // Return cleanup function
      return () => {
        // Cast the callback functions to the expected type to satisfy TypeScript
        peer.removeListener("signal", onSignal as (...args: unknown[]) => void);
        peer.removeListener(
          "connect",
          onConnect as (...args: unknown[]) => void
        );
        peer.removeListener("close", onClose as (...args: unknown[]) => void);
        peer.removeListener("error", onError as (...args: unknown[]) => void);
        peer.removeListener("stream", onStream as (...args: unknown[]) => void);
      };
    },
    []
  );

  return {
    createPeer,
    destroyPeer,
    monitorPeer,
    isLoaded,
    error,
  };
}

/**
 * Helper function to create WebRTC configuration with ICE servers
 */
export function createRTCConfig(
  additionalIceServers: RTCIceServer[] = []
): RTCConfiguration {
  debugLog("Creating RTC config with additional ICE servers", {
    defaultServers: DEFAULT_ICE_SERVERS.length,
    additionalServers: additionalIceServers.length,
  });

  return {
    iceServers: [...DEFAULT_ICE_SERVERS, ...additionalIceServers],
    iceCandidatePoolSize: 10,
  };
}
