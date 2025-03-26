import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useSimplePeer, SimplePeerInstance } from "@/hooks/useSimplePeer";
import { useAuth } from "@/components/AuthProvider";
import {
  getSocketForStream,
  clearSocketInstance,
  resetAllConnections,
  clearRateLimitForStream,
  connectionState
} from "@/socket-io-client";
import StreamControls from "./StreamControls";
import { toast } from "sonner";

interface VideoStreamManagerProps {
  streamId: string;
  isStreamer: boolean;
}

interface VideoProps {
  stream: MediaStream | null;
  muted?: boolean;
  showDebugInfo?: boolean;
}

const Video: React.FC<VideoProps> = ({ stream, muted = false, showDebugInfo = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoStats, setVideoStats] = useState<{
    width: number;
    height: number;
    fps?: number;
  } | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      // Handle video metadata loaded to get resolution info
      const handleMetadataLoaded = () => {
        if (videoRef.current) {
          setVideoStats({
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
          });
        }
      };

      // Handle video errors
      const handleVideoError = (e: Event) => {
        setVideoError(`Video playback error: ${e.type}`);
      };

      videoRef.current.addEventListener('loadedmetadata', handleMetadataLoaded);
      videoRef.current.addEventListener('error', handleVideoError);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleMetadataLoaded);
          videoRef.current.removeEventListener('error', handleVideoError);
        }
      };
    }
  }, [stream]);

  // Periodically update video stats (for development/debug only)
  useEffect(() => {
    if (!showDebugInfo || !stream) return;

    const statsInterval = setInterval(() => {
      if (videoRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          setVideoStats({
            width: settings.width || videoRef.current.videoWidth,
            height: settings.height || videoRef.current.videoHeight,
            fps: settings.frameRate,
          });
        }
      }
    }, 5000);

    return () => clearInterval(statsInterval);
  }, [stream, showDebugInfo]);

  if (!stream) return null;

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover rounded-lg"
        muted={muted}
        onError={() => setVideoError('Video playback failed')}
      />

      {/* Show error message if video fails */}
      {videoError && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-white p-4">
          <div className="text-center">
            <p className="text-red-400 mb-2">{videoError}</p>
            <button
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              onClick={() => {
                setVideoError(null);
                if (videoRef.current && stream) {
                  videoRef.current.srcObject = null;
                  setTimeout(() => {
                    if (videoRef.current) videoRef.current.srcObject = stream;
                  }, 1000);
                }
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Show video stats in debug mode */}
      {showDebugInfo && videoStats && (
        <div className="absolute bottom-20 left-4 bg-black bg-opacity-70 text-white text-xs p-1 rounded">
          {videoStats.width}x{videoStats.height}{videoStats.fps ? ` @${videoStats.fps}fps` : ''}
        </div>
      )}
    </>
  );
};

interface ViewerData {
  userId: string;
  username: string;
  connectionId?: string;
  peer?: SimplePeerInstance;
}

export const VideoStreamManager: React.FC<VideoStreamManagerProps> = ({
  streamId,
  isStreamer,
}) => {
  // Add global error handler for Chrome extension messaging errors
  useEffect(() => {
    // This handles the "A listener indicated an asynchronous response by returning true, but the message channel closed..." error
    // This error is related to Chrome extensions and doesn't affect our application functionality
    const originalOnError = window.onerror;

    window.onerror = function (message, source, lineno, colno, error) {
      // Check if error is related to message channel
      if (message && (
        (typeof message === 'string' && message.includes('message channel closed')) ||
        (error && error.message && error.message.includes('message channel closed'))
      )) {
        console.log('Suppressing Chrome extension message channel error:', message);
        return true; // Prevents the error from being logged in the console
      }

      // Call the original handler for other errors
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    return () => {
      window.onerror = originalOnError;
    };
  }, []);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [viewers, setViewers] = useState<Map<string, ViewerData>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [streamActive, setStreamActive] = useState(false);
  // showControls is managed internally and could be used in future features
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showControls, setShowControls] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  const { createPeer, destroyPeer, isLoaded } = useSimplePeer();

  // Add connectionErrorCount state
  const [connectionErrorCount, setConnectionErrorCount] = useState<number>(0);

  // Store refs for functions we need to access elsewhere
  const setupReceiverPeerRef = useRef<() => void>(() => { });

  // Add a ref to keep track of whether we've already called setupReceiverPeer
  const hasSetupReceiverPeer = useRef(false);

  // Add these state declarations after the other state variables
  const [enableAudio] = useState(true);
  const [enableVideo] = useState(true);
  const [currentCameraId] = useState<string | undefined>(undefined);
  const [currentMicrophoneId] = useState<string | undefined>(undefined);
  const [streamQuality, setStreamQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [connectionErrors, setConnectionErrors] = useState<string[]>([]);

  // Add state to track if reset is in progress
  const [isResetting, setIsResetting] = useState(false);
  const resetAttemptedRef = useRef(false);

  // Add a debug logging function
  const logDebug = useCallback((message: string, data?: unknown) => {
    console.debug(`[VideoStreamManager] ${message}`, data);
    const logMessage = data
      ? `${new Date().toLocaleTimeString()} - ${message} ${typeof data === 'object' ? JSON.stringify(data) : data}`
      : `${new Date().toLocaleTimeString()} - ${message}`;
    setDebugLogs(prev => [logMessage, ...prev].slice(0, 50));
  }, []);

  // Log connection errors
  const logConnectionError = useCallback((message: string, error?: unknown) => {
    console.error(`[VideoStreamManager] ${message}`, error);
    const errorMessage = error
      ? `${new Date().toLocaleTimeString()} - ERROR: ${message} ${typeof error === 'object' ? JSON.stringify(error) : error}`
      : `${new Date().toLocaleTimeString()} - ERROR: ${message}`;
    setConnectionErrors(prev => [errorMessage, ...prev].slice(0, 20));
  }, []);

  // Error tracking with window.onerror
  useEffect(() => {
    const handleError = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
      if (source?.includes('socket.io') || (typeof message === 'string' && message.includes('socket.io'))) {
        logConnectionError('Socket.IO Error: ', error);
        return true;
      }
      return false;
    };

    // Capture fetch errors
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);
        if (!response.ok && args[0] && typeof args[0] === 'string' && args[0].includes('/api/live-streams')) {
          logConnectionError(`Fetch error: ${response.status} ${response.statusText} for ${args[0]}`);
        }
        return response;
      } catch (error) {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('/api/live-streams')) {
          logConnectionError(`Fetch failed: ${error}`, error);
        }
        throw error;
      }
    };

    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
      window.fetch = originalFetch;
    };
  }, [logConnectionError]);

  // Camera and audio control functions
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [localStream, isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [localStream, isVideoEnabled]);

  // Enhanced ICE server configuration for better connectivity
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];

  // Move the peer recreation logic outside of handleIceConnectionStateChange
  const handleViewerJoined = useCallback((data: { userId: string; username: string }) => {
    logDebug(`Recreating peer for viewer ${data.userId}`);

    // Get the existing viewer data
    const viewerData = viewers.get(data.userId);
    if (!viewerData || !localStream) return;

    // Clean up old peer
    if (viewerData.peer) {
      try {
        viewerData.peer.destroy();
        logDebug(`Destroyed old peer for viewer ${data.userId}`);
      } catch (e) {
        logDebug(`Error destroying peer: ${e}`);
      }
    }

    // Remove from viewers map
    const viewersCopy = new Map(viewers);
    viewersCopy.delete(data.userId);
    setViewers(viewersCopy);

    // Create a new peer for this viewer
    const peer = createPeer({
      initiator: true,
      stream: localStream,
      trickle: true,
      config: {
        iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
      }
    });

    if (!peer) {
      logDebug(`Failed to create peer for viewer ${data.userId}`);
      return;
    }

    // Set up basic event handlers
    peer.on("signal", (signal) => {
      logDebug(`Sending signal to viewer: ${data.userId}`);
      if (socketRef.current?.connected) {
        socketRef.current.emit("signal", {
          signal,
          targetUserId: data.userId,
          streamId,
        });
      }
    });

    peer.on("connect", () => {
      logDebug(`Connected to viewer: ${data.userId}`);
    });

    peer.on("error", (err) => {
      logDebug(`Error in reconnected peer to ${data.userId}: ${err.message}`);
    });

    peer.on("close", () => {
      logDebug(`Peer connection to viewer ${data.userId} closed`);
    });

    // Add to viewers map
    viewersCopy.set(data.userId, {
      userId: data.userId,
      username: data.username,
      peer,
    });

    setViewers(viewersCopy);
  }, [logDebug, viewers, localStream, createPeer, streamId]);

  // Now update the handleIceConnectionStateChange function without the circular dependency
  const handleIceConnectionStateChange = useCallback((peer: SimplePeerInstance, userId: string) => {
    // We'll track ICE state via events instead of direct property access
    logDebug(`ICE connection event for ${userId}`);

    // Since SimplePeerInstance doesn't expose iceConnectionState directly,
    // we'll use a more general reconnection approach based on timeouts
    return () => {
      logDebug(`Attempting to reconnect peer for ${userId}`);

      try {
        // Instead of restartIce (which isn't exposed), we'll recreate the peer
        if (isStreamer) {
          // For streamers, we have a dedicated function to recreate viewer peers
          const viewerData = viewers.get(userId);
          if (viewerData) {
            handleViewerJoined({
              userId: userId,
              username: viewerData.username
            });
          }
        } else {
          // Handle viewer peer reconnection
          logDebug('Recreating receiver peer');
          if (!hasSetupReceiverPeer.current) {
            hasSetupReceiverPeer.current = true;
            setupReceiverPeerRef.current();
          }
        }
      } catch (error) {
        logDebug(`Error during peer reconnection: ${error}`);
      }
    };
  }, [isStreamer, logDebug, viewers, handleViewerJoined]);

  // Add cross-device compatibility handlers
  const detectDeviceCapabilities = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasWebRTC = !!window.RTCPeerConnection;
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    // Type-safe way to access userAgentData if it exists
    const browserInfo = 'userAgentData' in navigator
      ? JSON.stringify((navigator as { userAgentData?: Record<string, unknown> }).userAgentData || {})
      : 'Not available';

    logDebug('Device capabilities detected', {
      isMobile,
      hasWebRTC,
      hasGetUserMedia,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      browserInfo
    });

    // Return low resource mode for mobile devices to optimize performance
    return {
      isMobile,
      hasWebRTC,
      hasGetUserMedia,
      lowResourceMode: isMobile,
      recommendedQuality: isMobile ? 'low' : 'medium'
    };
  }, [logDebug]);

  // Add device capabilities to component state
  const [deviceCapabilities] = useState(() => detectDeviceCapabilities());

  // Apply low resource mode settings
  useEffect(() => {
    if (deviceCapabilities.lowResourceMode) {
      logDebug('Setting low resource mode for mobile device');
      // Apply lower quality settings for mobile
      setStreamQuality('low');
    }
  }, [deviceCapabilities, logDebug]);

  // Add iOS-specific fixes
  useEffect(() => {
    // Fix for iOS Safari which requires user interaction to play video
    const handleUserInteraction = () => {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        if (video.paused) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              logDebug('Error playing video after user interaction', error);
            });
          }
        }
      });
    };

    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchend', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchend', handleUserInteraction);
    };
  }, [logDebug]);

  // Update video constraints based on device capabilities
  // In the startCamera function, update the constraints object:
  // Remove the unused videoConstraints declaration and its entire definition

  // Handle when a viewer joins (for streamer only)
  const handleViewerJoinedConnection = useCallback(
    (data: { userId: string; username: string }) => {
      if (!isStreamer || !localStream) return;

      console.log(`Setting up peer connection for viewer: ${data.username}`);

      // Create a peer connection for this viewer
      const peer = createPeer({
        initiator: true,
        stream: localStream,
        trickle: true,
        config: {
          iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all',
        }
      });

      if (!peer) {
        console.error("Failed to create peer for viewer");
        return;
      }

      // Set up peer event handlers
      peer.on("signal", (signal) => {
        console.log(`Sending signal to viewer: ${data.userId}`);
        if (socketRef.current?.connected) {
          socketRef.current.emit("signal", {
            signal,
            targetUserId: data.userId,
            streamId,
          });
        } else {
          console.warn(`Socket disconnected, cannot send signal to viewer ${data.userId}. Will queue for reconnection.`);
          // Queue for when socket reconnects
          const signalInterval = setInterval(() => {
            if (socketRef.current?.connected) {
              console.log(`Socket reconnected, sending queued signal to viewer ${data.userId}`);
              socketRef.current.emit("signal", {
                signal,
                targetUserId: data.userId,
                streamId,
              });
              clearInterval(signalInterval);
            }
          }, 1000);

          // Don't let this run forever
          setTimeout(() => clearInterval(signalInterval), 10000);
        }
      });

      // Add additional handlers for better error recovery
      peer.on("connect", () => {
        console.log(`Connected to viewer: ${data.userId}`);
      });

      peer.on("error", (err) => {
        console.error(`Error in peer connection to viewer ${data.userId}:`, err);

        // If it was a critical error, schedule reconnection
        setTimeout(() => {
          if (viewers.has(data.userId)) {
            handleViewerJoined(data);
          }
        }, 2000);
      });

      peer.on("close", () => {
        console.log(`Peer connection to viewer ${data.userId} closed`);
      });

      // Add the viewer to our tracking map
      const viewersCopy = new Map(viewers);
      viewersCopy.set(data.userId, {
        userId: data.userId,
        username: data.username,
        peer,
      });
      setViewers(viewersCopy);
    },
    [createPeer, isStreamer, localStream, streamId, viewers, handleViewerJoined]
  );

  // Add missing refs at the beginning of the component (after the other useRef declarations)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const retryCount = useRef<number>(0);
  const debugMode = process.env.NODE_ENV === 'development' || showDebugConsole;
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Now let's fix the setupSocket function to be more robust
  const setupSocket = useCallback(() => {
    // If we're resetting, don't try to reconnect yet
    if (isResetting) {
      logDebug('Reset in progress, delaying connection attempt');
      return;
    }

    // Prevent parallel connection attempts
    if (isInitializingRef.current) {
      logDebug('Connection attempt already in progress');
      return;
    }

    isInitializingRef.current = true;

    // If we're rate limited, don't try to connect
    if (connectionState.isRateLimited) {
      const waitTime = Math.ceil((connectionState.rateLimitedUntil - Date.now()) / 1000);
      logDebug(`Rate limited, will retry in ${waitTime > 0 ? waitTime : 30}s`);
      isInitializingRef.current = false;

      // Schedule retry after rate limit expires
      if (!retryTimeoutRef.current) {
        const delay = (waitTime > 0 ? waitTime : 30) * 1000;
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          // Clear rate limit state
          clearRateLimitForStream(streamId);
          // Try again
          setupSocket();
        }, delay);
      }
      return;
    }

    // If we already have a socket reference and it's connected, reuse it
    if (socketRef.current && socketRef.current.connected) {
      logDebug('Socket already connected, reusing current connection');
      isInitializingRef.current = false;
      return;
    }

    // If we already have a socket reference, check if it's connecting
    if (socketRef.current && !socketRef.current.connected) {
      const status = socketRef.current.io?.engine?.readyState;
      if (status === "opening") {
        logDebug('Socket connection already in progress, waiting');
        isInitializingRef.current = false;
        return;
      }
    }

    // If we already have a socket reference, disconnect it properly first
    if (socketRef.current) {
      try {
        logDebug('Disconnecting existing socket before creating new one');
        socketRef.current.disconnect();
        socketRef.current = null;
      } catch (err) {
        logConnectionError("Error disconnecting existing socket:", err);
      }
    }

    logDebug('Setting up socket connection for stream', {
      streamId,
      isStreamer,
      userId: user?.id,
      username: user?.username
    });

    try {
      // Create a new socket connection or get existing one
      const socket = getSocketForStream(streamId, user, undefined);
      socketRef.current = socket;

      // Track connection timeout
      const connectTimeoutMs = 15000; // 15 second timeout
      const connectTimeout = setTimeout(() => {
        if (socket && !socket.connected) {
          logConnectionError('Socket connection timed out - cleaning up');

          try {
            socket.disconnect();
            clearSocketInstance(streamId);
            socketRef.current = null;
            isInitializingRef.current = false;

            // Schedule a retry
            retryCount.current += 1;
            if (retryCount.current <= 5) { // Limit retries
              const delay = Math.min(2000 * Math.pow(1.5, retryCount.current), 30000);
              logDebug(`Scheduling retry ${retryCount.current}/5 in ${delay / 1000}s`);

              setTimeout(() => {
                if (!socketRef.current?.connected) {
                  logDebug('Attempting reconnection after timeout');
                  setupSocket();
                }
              }, delay);
            } else {
              logDebug('Max retries reached, giving up automatic reconnection');
              setHasError(true);
            }
          } catch (error) {
            logConnectionError('Error cleaning up timed-out socket', error);
            isInitializingRef.current = false;
          }
        }
      }, connectTimeoutMs);

      // Connection success
      socket.on('connect', () => {
        // Clear timeout and update state
        clearTimeout(connectTimeout);
        setIsConnected(true);
        setConnectionErrorCount(0); // Reset error count
        isInitializingRef.current = false;
        retryCount.current = 0; // Reset retry count on success

        logDebug(`Socket connected with ID: ${socket.id || 'unknown'}`, {
          transport: socket.io?.engine?.transport?.name || 'unknown'
        });

        // Setup stream specific functionality after connection
        // If we're the streamer and have a stream, start the stream
        if (isStreamer && localStream) {
          logDebug("Emitting start-stream event");
          socket.emit("start-stream", {
            streamId,
            userId: user?.id
          });
        }

        // If we're a viewer and the stream is active, setup the receiver peer
        if (!isStreamer && streamActive && !hasSetupReceiverPeer.current) {
          logDebug("Setting up receiver peer for active stream");
          hasSetupReceiverPeer.current = true;
          setupReceiverPeerRef.current();
        }
      });

      socket.on('stream-started', () => {
        logDebug('Stream started event received');
        setStreamActive(true);

        // Setup peer connection for viewer
        if (!isStreamer && !hasSetupReceiverPeer.current) {
          hasSetupReceiverPeer.current = true;
          setupReceiverPeerRef.current();
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logConnectionError('Error setting up socket:', err);
      setIsConnected(false);
      isInitializingRef.current = false;

      let retryDelay = 1000;

      if (errorMessage.includes('Rate limited')) {
        // Parse rate limit wait time
        const waitTimeMatch = errorMessage.match(/in (\d+) seconds/);
        if (waitTimeMatch && waitTimeMatch[1]) {
          retryDelay = (parseInt(waitTimeMatch[1], 10) + 1) * 1000;
        } else {
          retryDelay = 30000; // Default 30s if no time specified
        }

        // Clear global cache
        clearSocketInstance(streamId);

        logDebug(`Rate limited, will retry in ${retryDelay / 1000}s`);
      } else {
        // For other errors, use shorter backoff
        retryDelay = Math.min(2000 * (connectionErrorCount + 1), 10000);
        logDebug(`Connection error, will retry in ${retryDelay / 1000}s`);
      }

      // Schedule retry
      retryCount.current += 1;
      setTimeout(() => {
        if (retryCount.current <= 5 && !socketRef.current?.connected) {
          logDebug(`Retry attempt ${retryCount.current}/5`);
          setupSocket();
        } else if (retryCount.current > 5) {
          logDebug('Max retries reached, giving up automatic retry');
          setHasError(true);
        }
      }, retryDelay);

      setConnectionErrorCount(prev => prev + 1);
    }
  }, [
    streamId,
    isStreamer,
    user,
    connectionErrorCount,
    logConnectionError,
    logDebug,
    isResetting,
    setHasError
  ]);

  // Setup the receiver peer with fallback to initiator if needed
  const setupReceiverPeer = useCallback(() => {
    if (!isLoaded || isStreamer) return;

    console.log("Setting up receiver peer as viewer");

    // Destroy any existing peer first
    const existingPeer = viewers.get('viewer')?.peer;
    if (existingPeer) {
      console.log("Destroying existing peer before creating new one");
      existingPeer.destroy();
    }

    // Create peer instance for receiving
    const peer = createPeer({
      initiator: false,
      trickle: true,
      config: {
        iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
      }
    });

    if (!peer) {
      console.error("Failed to create receiver peer");
      return;
    }

    // Store the peer to access it later for signaling - BUT avoid the infinite loop by
    // checking if the viewer already exists with the same ID
    const viewerId = user?.id || socketRef.current?.id || 'anonymous';
    const existingViewer = viewers.get('viewer');

    // Only update state if there's a meaningful change
    if (!existingViewer || existingViewer.peer !== peer) {
      const viewerPeers = new Map(viewers);
      viewerPeers.set('viewer', {
        userId: viewerId,
        username: user?.username || 'Anonymous',
        peer
      });
      setViewers(viewerPeers);
    }

    // Set up peer event handlers
    peer.on("signal", (signal) => {
      console.log("Viewer sending signal to streamer");
      if (socketRef.current?.connected) {
        socketRef.current.emit("signal", {
          signal,
          targetUserId: "streamer", // The streamer will handle this
          streamId
        });
      } else {
        console.warn("Socket disconnected, cannot send signal. Will queue for reconnection.");
        // Queue for when socket reconnects
        const signalInterval = setInterval(() => {
          if (socketRef.current?.connected) {
            console.log("Socket reconnected, sending queued signal");
            socketRef.current.emit("signal", {
              signal,
              targetUserId: "streamer",
              streamId
            });
            clearInterval(signalInterval);
          }
        }, 1000);

        // Don't let this run forever
        setTimeout(() => clearInterval(signalInterval), 10000);
      }
    });

    peer.on("connect", () => {
      console.log("Peer connection established with streamer");
    });

    peer.on("stream", (stream: MediaStream) => {
      console.log("Received stream from streamer");
      setRemoteStreams((prev) => {
        // Check if we already have this stream to avoid unnecessary updates
        const existingStream = prev.get("streamer");
        if (existingStream && existingStream.id === stream.id) {
          return prev; // Return existing state to prevent unnecessary updates
        }

        const newStreams = new Map(prev);
        newStreams.set("streamer", stream);
        return newStreams;
      });
    });

    peer.on("error", (err) => {
      console.error("Peer connection error:", err);
      // Try to recover by recreating the peer connection
      const reconnect = handleIceConnectionStateChange(peer, 'streamer');
      setTimeout(reconnect, 2000);
    });

    peer.on("close", () => {
      console.log("Peer connection closed");
    });

    // Only request signal if socket is connected
    if (socketRef.current?.connected) {
      console.log("Requesting signal from streamer");
      socketRef.current.emit("request-streamer-signal", {
        streamId,
        fromUserId: user?.id || socketRef.current?.id || 'anonymous'
      });

      // Set up a delay to retry if no response within a few seconds
      const retryRequestId = setTimeout(() => {
        console.log("No immediate response from streamer, retrying request");
        if (socketRef.current?.connected && remoteStreams.size === 0) {
          socketRef.current.emit("request-streamer-signal", {
            streamId,
            fromUserId: user?.id || socketRef.current?.id || 'anonymous'
          });
        }
      }, 3000);

      // Set a timeout to try as initiator if no response
      const timeoutId = setTimeout(() => {
        console.log("No response from streamer, trying as initiator");

        // Don't destroy existing peer if we already have a stream
        if (remoteStreams.size === 0) {
          peer.destroy();

          const initPeer = createPeer({
            initiator: true,
            trickle: true,
            config: {
              iceServers,
              iceCandidatePoolSize: 10
            }
          });

          if (initPeer) {
            console.log("Created initiator peer as fallback");
            // Update peer reference
            const viewerPeers = new Map(viewers);
            viewerPeers.set('viewer', {
              userId: viewerId,
              username: user?.username || 'Anonymous',
              peer: initPeer
            });
            setViewers(viewerPeers);

            initPeer.on("signal", (signal) => {
              console.log("Initiator sending signal to streamer");
              if (socketRef.current?.connected) {
                socketRef.current.emit("signal", {
                  signal,
                  targetUserId: "streamer",
                  streamId
                });
              } else {
                console.warn("Socket disconnected, queueing signal for later");
                // Try to send signal when connected
                const signalInterval = setInterval(() => {
                  if (socketRef.current?.connected) {
                    console.log("Now connected, sending queued signal");
                    socketRef.current.emit("signal", {
                      signal,
                      targetUserId: "streamer",
                      streamId
                    });
                    clearInterval(signalInterval);
                  }
                }, 1000);

                // Don't let this run forever
                setTimeout(() => clearInterval(signalInterval), 10000);
              }
            });

            // Set up the same event handlers as before
            initPeer.on("connect", () => {
              console.log("Initiator peer connection established");
            });

            initPeer.on("stream", (stream: MediaStream) => {
              console.log("Received stream via initiator connection");
              setRemoteStreams((prev) => {
                // Check if we already have this stream to avoid unnecessary updates
                const existingStream = prev.get("streamer");
                if (existingStream && existingStream.id === stream.id) {
                  return prev; // Return existing state to prevent unnecessary updates
                }

                const newStreams = new Map(prev);
                newStreams.set("streamer", stream);
                return newStreams;
              });
            });

            initPeer.on("error", (err) => {
              console.error("Initiator peer error:", err);
            });
          }
        } else {
          console.log("Already have a remote stream, not switching to initiator mode");
        }
      }, 8000);

      // Clean up retry timer on unmount
      return () => {
        clearTimeout(retryRequestId);
        clearTimeout(timeoutId);
        peer.destroy();
      };
    } else {
      console.warn("Socket not connected, will request signal when connected");
      // Try again when socket connects
      const checkInterval = setInterval(() => {
        if (socketRef.current?.connected) {
          console.log("Socket now connected, requesting signal from streamer");
          socketRef.current.emit("request-streamer-signal", {
            streamId,
            fromUserId: user?.id || socketRef.current?.id || 'anonymous'
          });
          clearInterval(checkInterval);
        }
      }, 1000);

      // Clear interval after max 15 seconds
      setTimeout(() => clearInterval(checkInterval), 15000);

      return () => {
        peer.destroy();
      };
    }
  }, [isLoaded, isStreamer, viewers, createPeer, streamId, user?.id, user?.username, socketRef, remoteStreams.size, handleIceConnectionStateChange]);

  // Store the current implementation in the ref
  useEffect(() => {
    setupReceiverPeerRef.current = setupReceiverPeer;
  }, [setupReceiverPeer]);

  // Add function to diagnose WebSocket connection inside component body
  const diagnoseConnectionIssues = useCallback(() => {
    logDebug('Diagnosing connection issues...');

    // Check current socket state
    if (socketRef.current) {
      const socket = socketRef.current;
      const transport = socket.io?.engine?.transport?.name;
      const readyState = socket.io?.engine?.readyState;
      const connected = socket.connected;

      logDebug('Socket diagnostics:', {
        id: socket.id,
        transport,
        readyState,
        connected,
        opts: socket.io?.opts,
        hasListener: socket.hasListeners('connect'),
        hasErrorListener: socket.hasListeners('error')
      });
    } else {
      logDebug('No socket reference available');
    }

    // Check if we're rate limited
    logDebug('Rate limit status:', {
      isRateLimited: connectionState.isRateLimited,
      rateLimitedUntil: connectionState.rateLimitedUntil ?
        new Date(connectionState.rateLimitedUntil).toLocaleTimeString() : 'none'
    });

    // Check network connectivity
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
      method: 'GET',
      cache: 'no-store'
    })
      .then(response => response.ok ? 'OK' : 'Failed')
      .then(status => logDebug(`API health check: ${status}`))
      .catch(err => logDebug(`API health check failed: ${err.message}`));

    // Check WebRTC peer capabilities
    if (isStreamer && localStream) {
      logDebug('Local stream active with tracks:', {
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
    }

    return "Diagnostics complete";
  }, [socketRef, logDebug, connectionState.isRateLimited, connectionState.rateLimitedUntil, isStreamer, localStream]);

  // Modify startCamera to ensure proper sequencing
  const startCamera = useCallback(async () => {
    if (!isStreamer) return null;

    // First ensure we have a socket connection before starting camera
    if (!socketRef.current || !socketRef.current.connected) {
      logDebug('No socket connection available, establishing connection first');
      try {
        // Make sure we have a valid socket connection first
        await new Promise<void>((resolve, reject) => {
          // If we already have a socket that's connecting, wait for it
          if (socketRef.current && !socketRef.current.connected) {
            logDebug('Socket exists but not connected, waiting for connection');
            const connectHandler = () => {
              logDebug('Socket connected, proceeding with camera setup');
              socketRef.current?.off('connect', connectHandler);
              resolve();
            };

            const errorHandler = (err: Error | string | Event) => {
              logDebug('Socket connection failed', err);
              socketRef.current?.off('error', errorHandler);
              reject(new Error('Failed to establish socket connection'));
            };

            socketRef.current.once('connect', connectHandler);
            socketRef.current.once('error', errorHandler);

            // Set a timeout in case the connection never resolves
            setTimeout(() => {
              socketRef.current?.off('connect', connectHandler);
              socketRef.current?.off('error', errorHandler);
              reject(new Error('Socket connection timeout'));
            }, 10000);
          } else {
            // No socket exists, create one
            logDebug('Setting up new socket connection');
            setupSocket();

            // Wait a moment for the connection attempt to start
            setTimeout(() => {
              if (socketRef.current && socketRef.current.connected) {
                logDebug('New socket connection established');
                resolve();
              } else {
                logDebug('Socket connection pending, will continue anyway');
                resolve(); // Resolve anyway to prevent blocking camera start
              }
            }, 2000);
          }
        });
      } catch (err) {
        logDebug('Failed to establish socket connection, continuing with camera anyway', err);
        // Continue with camera anyway - we'll retry socket connection later
      }
    }

    logDebug('Starting camera with options', {
      enableAudio,
      enableVideo,
      currentCameraId,
      currentMicrophoneId,
      streamQuality
    });

    try {
      // Prepare constraints based on quality setting and selected devices
      const videoConstraints = enableVideo ? {
        deviceId: currentCameraId ? { exact: currentCameraId } : undefined,
        width: deviceCapabilities.lowResourceMode
          ? { ideal: 480, max: 640 } // Lower resolution for mobile
          : streamQuality === 'high' ? { ideal: 1280 }
            : streamQuality === 'medium' ? { ideal: 720 }
              : { ideal: 480 },
        height: deviceCapabilities.lowResourceMode
          ? { ideal: 320, max: 480 }  // Lower resolution for mobile
          : streamQuality === 'high' ? { ideal: 720 }
            : streamQuality === 'medium' ? { ideal: 480 }
              : { ideal: 320 },
        facingMode: "user",
        frameRate: deviceCapabilities.lowResourceMode
          ? { ideal: 15, max: 24 }  // Lower frame rate for mobile
          : streamQuality === 'high' ? { ideal: 30 }
            : streamQuality === 'medium' ? { ideal: 24 }
              : { ideal: 15 }
      } : false;

      const audioConstraints = enableAudio ? {
        deviceId: currentMicrophoneId ? { exact: currentMicrophoneId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } : false;

      // Define complete constraints
      const constraints = {
        audio: audioConstraints,
        video: videoConstraints
      };

      logDebug('getUserMedia constraints:', constraints);

      // Request media access
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Log the obtained tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      logDebug('Stream obtained successfully', {
        videoTracks: videoTracks.map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          settings: t.getSettings()
        })),
        audioTracks: audioTracks.map(t => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled
        }))
      });

      // Update state
      setLocalStream(stream);
      setIsCameraStarted(true);

      // Update audio and video state based on stream tracks
      setIsAudioEnabled(audioTracks.length > 0 && audioTracks[0].enabled);
      setIsVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);

      // Notify server about stream start
      if (socketRef.current && socketRef.current.connected) {
        logDebug('Socket connected, emitting start-stream', { streamId });
        socketRef.current.emit("start-stream", { streamId });

        // Check if there are any pending viewers waiting for a connection
        logDebug("Checking for pending viewer signal requests");
        socketRef.current.emit("check-pending-viewers", { streamId });
      } else {
        logDebug("Socket not connected yet, waiting to emit start-stream");

        // Wait for socket to connect before trying to emit start-stream
        let connectAttempts = 0;
        const maxAttempts = 30;  // Increase maximum attempts
        const retryInterval = 1000; // 1 second between tries

        const checkInterval = setInterval(() => {
          connectAttempts++;

          // First, ensure we have a valid socket reference
          if (!socketRef.current) {
            logDebug('No socket reference, setting up new socket');
            setupSocket();
            // Skip this attempt to give the new socket time to connect
            return;
          }

          if (socketRef.current.connected) {
            logDebug("Socket now connected, emitting start-stream");
            socketRef.current.emit("start-stream", { streamId });
            socketRef.current.emit("check-pending-viewers", { streamId });
            clearInterval(checkInterval);
          } else if (connectAttempts >= maxAttempts) {
            logDebug(`Socket still not connected after ${maxAttempts} attempts. Clearing interval.`);
            clearInterval(checkInterval);

            // Try to recreate the socket with a complete reset
            try {
              clearSocketInstance(streamId);
              socketRef.current = null;
              setTimeout(() => {
                logDebug('Completely refreshing socket connection after all attempts failed');
                setupSocket();
                // Attempt to emit after a delay
                setTimeout(() => {
                  if (socketRef.current?.connected) {
                    socketRef.current.emit("start-stream", { streamId });
                    socketRef.current.emit("check-pending-viewers", { streamId });
                  }
                }, 2000);
              }, 1000);
            } catch (error) {
              logDebug('Error during socket reset:', error);
            }
          } else {
            logDebug(`Waiting for socket connection... (attempt ${connectAttempts}/${maxAttempts})`);

            // On every 5th attempt, try to reconnect the socket manually
            if (connectAttempts % 5 === 0 && socketRef.current) {
              logDebug('Attempting manual socket reconnection');
              try {
                socketRef.current.connect();
              } catch (error) {
                logDebug('Error during manual reconnection:', error);
              }
            }
          }
        }, retryInterval);
      }

      toast.success('Camera started successfully');
      return stream;
    } catch (error) {
      logDebug("Error accessing media devices:", error);
      toast.error("Could not access camera or microphone. Please check your browser permissions and try again.");
      return null;
    }
  }, [
    isStreamer,
    streamId,
    setupSocket,
    // Include these static variables to satisfy the linter
    // even though they don't actually change and wouldn't normally
    // need to trigger recreation of the callback
    enableAudio,
    enableVideo,
    currentCameraId,
    currentMicrophoneId,
    streamQuality,
    logDebug,
    deviceCapabilities
  ]);

  // Stop camera for streamer
  const stopCamera = useCallback(() => {
    if (!isStreamer || !localStream) return;

    console.debug('Stopping camera');

    // Stop all tracks
    localStream.getTracks().forEach((track) => {
      console.debug(`Stopping track: ${track.kind} (${track.id})`);
      track.stop();
    });

    setLocalStream(null);
    setIsCameraStarted(false);

    // Notify server that we've stopped streaming
    if (socketRef.current && isConnected) {
      console.debug('Emitting end-stream and camera-stopped events');
      socketRef.current.emit("end-stream", { streamId });
      socketRef.current.emit("camera-stopped", { streamId });
    }

    // Clean up peer connections
    console.debug(`Cleaning up ${viewers.size} peer connections`);
    viewers.forEach((viewer, id) => {
      if (viewer.peer) {
        console.debug(`Destroying peer for viewer ${id}`);
        destroyPeer(viewer.peer);
      }
    });
    setViewers(new Map());

    toast.success('Camera stopped');
  }, [isStreamer, localStream, streamId, isConnected, viewers, destroyPeer]);

  // Add a resetConnection function inside the component with enhanced recovery
  const resetConnection = useCallback(() => {
    logDebug('Manually resetting all connections');

    // Set resetting state to block new connection attempts
    setIsResetting(true);

    // First disconnect and clean up current socket
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
        socketRef.current = null;
      } catch (error) {
        logConnectionError('Error disconnecting socket during reset:', error);
      }
    }

    // Reset all connection state
    resetAllConnections();

    // Explicitly clear rate limit for this stream
    clearRateLimitForStream(streamId);

    // Reset local error count
    setConnectionErrorCount(0);

    // Clear any error messages
    setConnectionErrors([]);

    // Add a reset success message to the logs
    logDebug('Connection reset successful, reconnecting in 5 seconds...');

    // Use a longer delay after reset (5 seconds) to ensure server state is cleared
    setTimeout(() => {
      if (!socketRef.current?.connected) {
        resetAttemptedRef.current = true;
        logDebug('Attempting reconnection after reset');
        setIsResetting(false); // Clear reset state to allow connections
        setupSocket();
      }
    }, 5000);

    toast.success('Connections reset. Reconnecting...');
  }, [logDebug, logConnectionError, setupSocket, streamId]);

  // Define initializeSocketOnce at the component level
  const initializeSocketOnce = useCallback(() => {
    // If we're already rate limited, don't try to connect
    if (connectionState.isRateLimited && connectionState.rateLimitedUntil > Date.now()) {
      const waitTime = Math.ceil((connectionState.rateLimitedUntil - Date.now()) / 1000);
      logDebug(`Still rate limited, will retry in ${waitTime}s`);
      setIsConnected(false);

      // Schedule a retry after the rate limit expires
      if (!retryTimeoutRef.current) {
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          logDebug('Rate limit expired, trying to connect again');
          initializeSocketOnce();
        }, waitTime * 1000 + 1000); // Add 1s buffer
      }
      return;
    }

    // Clear existing socket and timeout
    if (socketRef.current) {
      logDebug('Socket already exists, not initializing again');
      return;
    }

    // Now we know we need to create a new connection
    logDebug('Starting socket initialization...');
    setIsConnecting(true);

    // Use a connection flag to prevent duplicate connection attempts
    if (isInitializingRef.current) {
      logDebug('Already initializing, skipping duplicate request');
      return;
    }

    isInitializingRef.current = true;

    // Single connection attempt with proper error handling
    try {
      setupSocket();

      // Set a timeout to check connection status
      setTimeout(() => {
        if (socketRef.current && socketRef.current.connected) {
          logDebug('Socket connected successfully');
        } else {
          logDebug('Socket failed to connect within timeout');
        }
        isInitializingRef.current = false;
        setIsConnecting(false);
      }, 5000);
    } catch (err) {
      logDebug('Error during socket initialization', err);
      isInitializingRef.current = false;
      setIsConnecting(false);

      // Schedule a retry with exponential backoff
      if (!retryTimeoutRef.current) {
        const delay = retryCount.current * 2000 + 1000; // Exponential backoff
        logDebug(`Will retry in ${delay / 1000}s`);

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          retryCount.current += 1;
          if (retryCount.current <= 5) { // Max 5 retries
            logDebug(`Retry attempt ${retryCount.current}/5`);
            initializeSocketOnce();
          } else {
            logDebug('Max retries reached, giving up');
            setHasError(true);
          }
        }, delay);
      }
    }
  }, [
    connectionState.isRateLimited,
    connectionState.rateLimitedUntil,
    setupSocket,
    logDebug,
    setIsConnected,
    setIsConnecting,
    setHasError
  ]);

  // Main effect for setting up socket and camera
  useEffect(() => {
    console.log(`Setting up socket connection for stream ${streamId} as ${isStreamer ? 'streamer' : 'viewer'}`);

    let isComponentMounted = true;
    const setupAttempted = false;

    // Initialize with a short delay to avoid race conditions
    const initialSetupTimeout = setTimeout(() => {
      if (isComponentMounted) {
        initializeSocketOnce();
      }
    }, 300);

    // Set up connection monitoring - but make it less aggressive
    const connectionMonitor = setInterval(() => {
      if (!isComponentMounted) return;

      if (socketRef.current) {
        if (!socketRef.current.connected && isComponentMounted) {
          console.log('Connection monitor: Socket not connected, attempting reconnect...');
          try {
            // Don't create a new socket, just try to reconnect the existing one
            socketRef.current.connect();
          } catch (error) {
            console.error('Error in connection monitor reconnect:', error);
          }
        }
      } else if (!setupAttempted && isComponentMounted) {
        // Only try to setup again if we haven't already tried
        initializeSocketOnce();
      }
    }, 20000); // Check every 20 seconds instead of 10

    // Set up receiver peer for viewers or start camera for streamers
    // But do it with a slight delay to ensure socket connection is established first
    const peerSetupTimeout = setTimeout(() => {
      if (!isComponentMounted) return;

      if (!isStreamer && isLoaded) {
        // Only call setupReceiverPeer if needed and not already called
        const existingViewer = viewers.get('viewer');
        const shouldSetupPeer = (!existingViewer || !existingViewer.peer) && !hasSetupReceiverPeer.current;

        if (shouldSetupPeer) {
          console.log("Setting up receiver peer for viewer - first time");
          hasSetupReceiverPeer.current = true; // Mark as called to prevent loops
          setupReceiverPeerRef.current();
        }
      } else if (isStreamer && isLoaded && !isCameraStarted) {
        console.log(`Auto-starting camera for streamer: ${JSON.stringify({
          isStreamer,
          isConnected,
          isCameraStarted,
          isLoaded,
          user: user?.id
        })}`);
        startCamera();
      }
    }, 1000); // 1 second delay

    // Setup socket event handlers - including viewer-joined
    if (socketRef.current) {
      if (isStreamer) {
        // Use handleViewerJoinedConnection when a viewer joins
        socketRef.current.on('viewer-joined', handleViewerJoinedConnection);
      }
    }

    // Cleanup function with memory leak prevention
    return () => {
      isComponentMounted = false;
      clearTimeout(initialSetupTimeout);
      clearTimeout(peerSetupTimeout);
      clearInterval(connectionMonitor);

      console.log(`Cleaning up socket connection on unmount`);
      hasSetupReceiverPeer.current = false; // Reset on unmount

      if (socketRef.current) {
        // Remove event listeners
        if (isStreamer) {
          socketRef.current.off('viewer-joined', handleViewerJoinedConnection);
        }

        // Stop sending any video first
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }

        // If streamer, emit end-stream
        if (isStreamer) {
          try {
            socketRef.current.emit('end-stream', { streamId });
          } catch (error) {
            console.error('Error emitting end-stream:', error);
          }
        }

        // Disconnect socket
        try {
          socketRef.current.disconnect();
        } catch (error) {
          console.error('Error disconnecting socket:', error);
        }
        socketRef.current = null;
      }

      // Clean up all peer connections
      viewers.forEach(viewer => {
        if (viewer.peer) {
          try {
            viewer.peer.destroy();
          } catch (error) {
            console.error('Error destroying peer:', error);
          }
        }
      });
    };
  }, [streamId, isStreamer, isLoaded, setupSocket, isCameraStarted, startCamera, localStream, isConnected, user?.id, viewers, initializeSocketOnce, handleViewerJoinedConnection]);

  // Add lifecycle method to periodically check connection health
  useEffect(() => {
    // Function to check socket health
    const checkSocketHealth = () => {
      if (!socketRef.current) {
        logDebug('No socket reference, reconnecting...');
        initializeSocketOnce();
        return;
      }

      if (!socketRef.current.connected && !isInitializingRef.current) {
        logDebug('Socket disconnected unexpectedly, reconnecting...');
        // Only reconnect if we're not rate limited
        if (!connectionState.isRateLimited) {
          initializeSocketOnce();
        }
      }
    };

    // Check socket health periodically
    const healthInterval = setInterval(checkSocketHealth, 10000);
    return () => clearInterval(healthInterval);
  }, [initializeSocketOnce, logDebug]);

  // Use debugMode variable in the existing useEffect
  useEffect(() => {
    // Run diagnostics when in debug mode
    if (debugMode) {
      diagnoseConnectionIssues();

      // Log more detailed information in debug mode
      logDebug('Running in debug mode with enhanced logging');

      // Periodically run diagnostics in debug mode
      const diagnosticsInterval = setInterval(() => {
        diagnoseConnectionIssues();
      }, 30000);

      return () => clearInterval(diagnosticsInterval);
    }
  }, [debugMode, diagnoseConnectionIssues, logDebug]);

  // Main render
  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
      {/* If we're not connected at all, show a connection message */}
      {!isConnected && (
        <div className="text-white text-center p-4">
          <div className="mb-4 animate-pulse">
            <svg className="h-12 w-12 mx-auto text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2">Connecting to stream...</h3>
          <p className="text-gray-300">Please wait while we establish a connection.</p>
        </div>
      )}

      {/* If we're connected but no stream yet */}
      {isConnected && !localStream && !remoteStreams.size && (
        <div className="text-white text-center p-4">
          {isStreamer ? (
            <div>
              <h3 className="text-xl font-bold mb-2">Start your stream</h3>
              <p className="text-gray-300 mb-4">Click the button below to start broadcasting.</p>
              <button
                onClick={startCamera}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full inline-flex items-center"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Go Live
              </button>

              {/* Stream quality options */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Stream Quality</h4>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setStreamQuality('low')}
                    className={`px-3 py-1 rounded text-xs ${streamQuality === 'low' ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    Low
                  </button>
                  <button
                    onClick={() => setStreamQuality('medium')}
                    className={`px-3 py-1 rounded text-xs ${streamQuality === 'medium' ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setStreamQuality('high')}
                    className={`px-3 py-1 rounded text-xs ${streamQuality === 'high' ? 'bg-blue-600' : 'bg-gray-700'}`}
                  >
                    High
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <svg className={`h-12 w-12 mx-auto ${streamActive ? "text-green-400" : "text-gray-400"} ${streamActive ? "" : "animate-pulse"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              {streamActive ? (
                <>
                  <h3 className="text-xl font-bold mb-2">Connecting to stream...</h3>
                  <p className="text-gray-300">The host is live! Establishing connection...</p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold mb-2">Waiting for stream to start</h3>
                  <p className="text-gray-300">The host hasn&apos;t started the stream yet.</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Streamer's view */}
      {isStreamer && localStream && (
        <div className="relative w-full h-full">
          <Video stream={localStream} muted={true} showDebugInfo={debugMode} />

          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <StreamControls
              streamId={streamId}
              streamStatus="LIVE"
              onCameraToggle={toggleVideo}
              onMicrophoneToggle={toggleAudio}
              onSwitchCamera={startCamera}
              isCameraOn={isVideoEnabled}
              isMicrophoneOn={isAudioEnabled}
              viewerCount={viewers.size}
              onEndStream={stopCamera}
            />
          </div>

          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
            <span className="flex items-center">
              <span className="h-2 w-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              LIVE
            </span>
          </div>

          <div className="absolute bottom-16 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
            Viewers: {viewers.size}
          </div>

          {/* Add connection status indicator */}
          <div className={`absolute top-4 right-4 px-2 py-1 rounded text-xs text-white
            ${isConnected && !hasError ? 'bg-green-500' :
              isConnecting ? 'bg-yellow-500' :
                hasError ? 'bg-red-500' : 'bg-gray-500'}`}>
            {isConnected && !hasError ? 'Connected' :
              isConnecting ? 'Connecting...' :
                hasError ? 'Connection Error' : 'Disconnected'}
          </div>
        </div>
      )}

      {/* Viewer's view */}
      {!isStreamer && remoteStreams.size > 0 && (
        <div className="relative w-full h-full">
          <Video
            stream={Array.from(remoteStreams.values())[0]}
            muted={false}
            showDebugInfo={debugMode}
          />

          {/* Add connection status indicator for viewers too */}
          <div className={`absolute top-4 right-4 px-2 py-1 rounded text-xs text-white
            ${isConnected && !hasError ? 'bg-green-500' :
              isConnecting ? 'bg-yellow-500' :
                hasError ? 'bg-red-500' : 'bg-gray-500'}`}>
            {isConnected && !hasError ? 'Connected' :
              isConnecting ? 'Connecting...' :
                hasError ? 'Connection Error' : 'Disconnected'}
          </div>

          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
            <span className="flex items-center">
              <span className="h-2 w-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              LIVE
            </span>
          </div>
        </div>
      )}

      {/* Debug toggle button */}
      <button
        className="absolute top-4 left-4 z-50 bg-gray-800 text-white px-2 py-1 rounded text-xs"
        onClick={() => setShowDebugConsole(prev => !prev)}
      >
        {connectionErrors.length > 0 ? `🔴 Debug (${connectionErrors.length})` : '🔧 Debug'}
      </button>

      {/* Debug logs panel - visible when toggled */}
      {showDebugConsole && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-90 text-white text-xs p-2 z-40 overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Debug Console</h3>
            <div className="flex items-center gap-2">
              <button
                className="bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
                onClick={resetConnection}
              >
                Reset Connection
              </button>
              <button
                className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                onClick={() => setShowDebugConsole(false)}
              >
                Close
              </button>
            </div>
          </div>

          {connectionErrors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-red-400 mb-1">Connection Errors:</h4>
              <div className="bg-red-900 bg-opacity-30 p-2 rounded max-h-40 overflow-auto">
                {connectionErrors.map((error, index) => (
                  <div key={`error-${index}`} className="mb-1 text-red-300">{error}</div>
                ))}
              </div>
            </div>
          )}

          <h4 className="font-semibold mb-1">Debug Logs:</h4>
          <div className="bg-gray-800 p-2 rounded max-h-96 overflow-auto">
            {debugLogs.map((log, index) => (
              <div key={`log-${index}`} className="mb-1 truncate">{log}</div>
            ))}
          </div>

          <div className="mt-4">
            <h4 className="font-semibold mb-1">Connection Info:</h4>
            <div className="bg-gray-800 p-2 rounded">
              <div>Stream ID: {streamId}</div>
              <div>User ID: {user?.id || 'not logged in'}</div>
              <div>Socket ID: {socketRef.current?.id || 'not connected'}</div>
              <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
              <div>Is Streamer: {isStreamer ? 'Yes' : 'No'}</div>
              <div>Camera Started: {isCameraStarted ? 'Yes' : 'No'}</div>
              <div>Viewers: {viewers.size}</div>
              <div>Remote Streams: {remoteStreams.size}</div>
              <div>Connection Errors: {connectionErrorCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Debug logs panel - only shown in development or with a toggle */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-2 max-h-40 overflow-auto hidden">
          <div className="font-bold mb-1">Debug Logs:</div>
          {debugLogs.map((log, index) => (
            <div key={index} className="truncate">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}; 
