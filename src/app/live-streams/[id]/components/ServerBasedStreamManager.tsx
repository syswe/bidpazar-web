import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/components/AuthProvider";
import {
  getSocketForStream,
  clearSocketInstance,
} from "@/socket-io-client";
import StreamControls from "./StreamControls";
import { toast } from "sonner";
import { StreamDiagnostics } from './StreamDiagnostics';

interface ServerBasedStreamManagerProps {
  streamId: string;
  isStreamer: boolean;
}

/**
 * Video component for rendering server-streamed video
 */
interface VideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  showDebugInfo?: boolean;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  playsInline?: boolean;
}

/**
 * Safari-specific video element interface for accessing codec-specific stats
 */
interface SafariVideoElement extends HTMLVideoElement {
  webkitDecodedFrameCount?: number;
  webkitDroppedFrameCount?: number;
}

// Export the Video component so it can be used in other components
export const Video: React.FC<VideoProps> = ({
  videoRef,
  muted = false,
  showDebugInfo = false,
  width,
  height,
  autoPlay = true,
  playsInline = true
}) => {
  const [videoStats, setVideoStats] = useState<{
    width: number;
    height: number;
    frameRate?: number;
    decodedFrames?: number;
    droppedFrames?: number;
    playbackRate: number;
    readyState: number;
    networkState: number;
    totalBytes?: number;
    error?: string;
  }>({
    width: 0,
    height: 0,
    playbackRate: 1,
    readyState: 0,
    networkState: 0,
  });

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleMetadataLoaded = () => {
      setVideoStats((prev) => ({
        ...prev,
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
      }));
    };

    const handleVideoError = () => {
      const error = videoElement.error;
      setVideoStats((prev) => ({
        ...prev,
        error: error?.message || "Unknown video error"
      }));
      console.error("Video error:", error);
    };

    // Update video statistics periodically if debug info is enabled
    let statsInterval: NodeJS.Timeout | null = null;
    if (showDebugInfo) {
      statsInterval = setInterval(() => {
        if (!videoElement) return;

        // Get Safari-specific stats if available
        const safariVideo = videoElement as SafariVideoElement;
        const decodedFrames = safariVideo.webkitDecodedFrameCount;
        const droppedFrames = safariVideo.webkitDroppedFrameCount;

        setVideoStats((prev) => ({
          ...prev,
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
          playbackRate: videoElement.playbackRate,
          readyState: videoElement.readyState,
          networkState: videoElement.networkState,
          ...(decodedFrames !== undefined && { decodedFrames }),
          ...(droppedFrames !== undefined && { droppedFrames }),
        }));
      }, 1000);
    }

    videoElement.addEventListener("loadedmetadata", handleMetadataLoaded);
    videoElement.addEventListener("error", handleVideoError);

    return () => {
      videoElement.removeEventListener("loadedmetadata", handleMetadataLoaded);
      videoElement.removeEventListener("error", handleVideoError);
      if (statsInterval) clearInterval(statsInterval);
    };
  }, [videoRef, showDebugInfo]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        muted={muted}
        autoPlay={autoPlay}
        playsInline={playsInline}
        controls={false}
        width={width}
        height={height}
        className="w-full h-full object-contain bg-black"
      />
      {showDebugInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 font-mono">
          <div>Resolution: {videoStats.width}x{videoStats.height}</div>
          <div>Ready: {videoStats.readyState} | Network: {videoStats.networkState}</div>
          {videoStats.decodedFrames !== undefined && (
            <div>
              Frames: {videoStats.decodedFrames} decoded, {videoStats.droppedFrames} dropped
              ({videoStats.droppedFrames && videoStats.decodedFrames
                ? ((videoStats.droppedFrames / videoStats.decodedFrames) * 100).toFixed(1)
                : 0}% drop rate)
            </div>
          )}
          {videoStats.error && <div className="text-red-400">Error: {videoStats.error}</div>}
        </div>
      )}
    </div>
  );
};

// Buffer class for handling media source streaming
class StreamBuffer {
  private mediaSource: MediaSource;
  private sourceBuffer: SourceBuffer | null = null;
  private queue: Array<ArrayBuffer> = [];
  private isUpdating = false;
  private mimeType: string;
  private onError: (error: Error) => void;
  private lastChunkId = -1;
  private missedChunks = 0;

  constructor(mimeType: string, onError: (error: Error) => void) {
    this.mediaSource = new MediaSource();
    this.mimeType = mimeType;
    this.onError = onError;

    this.mediaSource.addEventListener('sourceopen', this.handleSourceOpen);
  }

  private handleSourceOpen = () => {
    try {
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);

      if (this.sourceBuffer) {
        this.sourceBuffer.mode = 'segments';
        this.sourceBuffer.addEventListener('updateend', this.handleUpdateEnd);
      } else {
        this.onError(new Error(`Failed to create source buffer with MIME type: ${this.mimeType}`));
      }
    } catch (error) {
      console.error('Error in handleSourceOpen:', error);
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  private handleUpdateEnd = () => {
    this.isUpdating = false;
    this.processQueue();
  };

  private processQueue = () => {
    if (this.queue.length > 0 && !this.isUpdating && this.sourceBuffer && !this.mediaSource.readyState.match(/closed/i)) {
      this.isUpdating = true;
      const chunk = this.queue.shift();
      if (chunk) {
        try {
          this.sourceBuffer.appendBuffer(chunk);
        } catch (error) {
          console.error('Error appending buffer:', error);
          this.isUpdating = false;
          this.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  };

  public addChunk = (chunkId: number, chunk: ArrayBuffer) => {
    // Check for missing chunks
    if (this.lastChunkId >= 0 && chunkId > this.lastChunkId + 1) {
      const missed = chunkId - this.lastChunkId - 1;
      this.missedChunks += missed;
      console.warn(`Missed ${missed} chunks. Last: ${this.lastChunkId}, Current: ${chunkId}`);
    }
    this.lastChunkId = chunkId;

    this.queue.push(chunk);

    // Avoid buffer overflow by removing oldest chunks if queue gets too large
    if (this.queue.length > 60) { // Keep at most 60 chunks (about 6 seconds at 10 chunks/sec)
      console.warn(`Buffer overflow. Dropping ${this.queue.length - 60} old chunks.`);
      this.queue = this.queue.slice(-60);
    }

    if (!this.isUpdating && this.sourceBuffer && !this.mediaSource.readyState.match(/closed/i)) {
      this.processQueue();
    }
  };

  public getURL(): string {
    return URL.createObjectURL(this.mediaSource);
  }

  public close() {
    try {
      if (this.sourceBuffer) {
        this.sourceBuffer.removeEventListener('updateend', this.handleUpdateEnd);
      }

      if (this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream();
      }
    } catch (error) {
      console.error('Error closing stream buffer:', error);
    }
  }

  public getMissedChunks(): number {
    return this.missedChunks;
  }
};

// Update stream controls props to match component expectations
export interface StreamControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isStreaming: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onStopStream: () => void;
}

// Add a User type extension at the top of the file, right after the imports
// This will fix the token property error
declare module "@/components/AuthProvider" {
  interface User {
    token?: string;
  }
}

export const ServerBasedStreamManager: React.FC<ServerBasedStreamManagerProps> = ({
  streamId,
  isStreamer,
}) => {
  // Socket reference for server communication
  const [socket, setSocket] = useState<Socket | null>(null);

  // Stream recording state
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Stream state and controls
  const [streamBuffer, setStreamBuffer] = useState<StreamBuffer | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // Video element and debugging
  const [framesSent, setFramesSent] = useState(0);
  const [framesReceived, setFramesReceived] = useState(0);
  const [connectionErrors, setConnectionErrors] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{
    connectionType: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    lastChecked: Date;
  }>({
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    lastChecked: new Date()
  });

  // Video resources
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const { user } = useAuth();

  // Add a debug logging function
  const logDebug = useCallback((message: string, data?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${timestamp} - ${message}`, data || '');
  }, []);

  // Initialize socket connection with better error handling
  const initializeSocket = useCallback(async () => {
    if (initializing) {
      logDebug("Already initializing, skipping duplicate request");
      return;
    }

    if (socket?.connected) {
      logDebug("Socket already connected, skipping initialization");
      return;
    }

    try {
      setInitializing(true);
      setIsTimedOut(false);
      logDebug("Starting socket initialization...");

      // Check backend health before attempting connection
      try {
        const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (healthResponse.ok) {
          logDebug("API health check: OK");
        } else {
          logDebug(`API health check failed: ${healthResponse.status}`);
          // Continue anyway, don't throw an error
          console.warn(`API health check failed: ${healthResponse.status}`);
        }

        // Check rate limit status
        const rateLimitResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/diagnostics/rate-limit-status`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        }).catch(() => null);

        if (rateLimitResponse?.ok) {
          const rateLimitData = await rateLimitResponse.json();
          logDebug(`Rate limit status: ${JSON.stringify(rateLimitData)}`);

          if (rateLimitData.isRateLimited) {
            logDebug(`Connection is rate limited until ${new Date(rateLimitData.rateLimitedUntil).toLocaleTimeString()}`);
            // Don't throw an error, just log it
            console.warn(`Connection is rate limited until ${new Date(rateLimitData.rateLimitedUntil).toLocaleTimeString()}`);
          }
        }
      } catch (healthCheckError) {
        console.error("Health check failed:", healthCheckError);
        // Continue anyway - the API health endpoint might not exist
      }

      // Get authenticated user info
      const username = user?.username || 'Anonymous';
      const userId = user?.id || 'anonymous';
      const token = user ? user.token as string : undefined;

      logDebug(`Initializing socket connection for server-based streaming: ${streamId}`);

      // Create socket with proper authentication
      const socketInstance = getSocketForStream(
        streamId,
        { id: userId, username: username },
        token
      );

      if (!socketInstance) {
        logDebug("Failed to create socket instance");
        setConnectionErrors(prev => prev + 1);
        setReconnectAttempts(prev => prev + 1);
        // Schedule a reconnection attempt
        setTimeout(() => {
          setInitializing(false);
        }, 2000);
        return;
      }

      setSocket(socketInstance);

      // Set up connection timeout - BUT DON'T THROW ERROR
      const connectionTimeout = setTimeout(() => {
        if (!socketInstance.connected) {
          logDebug("Socket failed to connect within timeout");
          setConnectionErrors(prev => prev + 1);
          setIsTimedOut(true);

          // Try to reconnect after a delay instead of throwing an error
          setTimeout(() => {
            setInitializing(false);
            // Force socket cleanup so we create a fresh connection
            try {
              socketInstance.disconnect();
              clearSocketInstance(`${streamId}:${!!token}`);
              setSocket(null); // Clear the socket state to ensure a fresh start

              // Display message to user
              toast.warning("Connection timed out. Attempting to reconnect...", {
                id: "connection-timeout",
                duration: 3000
              });
            } catch (e) {
              console.error("Error disconnecting timed out socket:", e);
            }
          }, 1000);
        }
      }, 10000); // Increase timeout to 10 seconds (from 8s)

      // Connection events
      socketInstance.on('connect', () => {
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setReconnectAttempts(0);
        setIsTimedOut(false);
        logDebug("Socket connected successfully");

        // Delay the join operation to ensure socket is fully established
        setTimeout(() => {
          // Join stream room based on role
          if (isStreamer) {
            socketInstance.emit('start-server-stream', { streamId });
            logDebug(`Started server stream as streamer: ${streamId}`);
          } else {
            socketInstance.emit('join-server-stream', { streamId });
            logDebug(`Joined server stream as viewer: ${streamId}`);
          }
        }, 500); // 500ms delay to ensure connection is fully established
      });

      socketInstance.on('connect_error', (error) => {
        clearTimeout(connectionTimeout);
        logDebug(`Socket connection error: ${error.message}`);
        setConnectionErrors(prev => prev + 1);
      });

      socketInstance.on('disconnect', (reason) => {
        logDebug(`Socket disconnected: ${reason}`);
        setIsConnected(false);
      });

      socketInstance.on('viewer-count', (count) => {
        setViewerCount(count);
      });

      // Handle stream-specific events
      if (isStreamer) {
        // Handle streamer-specific events
        logDebug("Setting up streamer event handlers");
      } else {
        // Handle viewer-specific events
        logDebug("Setting up viewer event handlers");

        // Video chunk reception
        socketInstance.on('video-chunk', (data) => {
          if (streamBuffer && data.chunk) {
            const arrayBuffer = new Uint8Array(data.chunk).buffer;
            streamBuffer.addChunk(data.id, arrayBuffer);
            setFramesReceived(prev => prev + 1);
          }
        });

        // Stream configuration event
        socketInstance.on('stream-config', (config) => {
          logDebug(`Received stream configuration: ${JSON.stringify(config)}`);
          setupStreamPlayback(config.mimeType || 'video/webm;codecs=vp8,opus');
        });
      }

    } catch (error) {
      console.error("Socket initialization error:", error);
      logDebug(`Socket initialization error: ${error instanceof Error ? error.message : String(error)}`);
      setConnectionErrors(prev => prev + 1);
      setReconnectAttempts(prev => prev + 1);

      // Schedule reconnection with backoff
      const backoffDelay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
      setTimeout(() => {
        setInitializing(false);
        logDebug("Reconnection attempt scheduled");
        // Next reconnect attempt will be triggered by the useEffect
      }, backoffDelay);

    } finally {
      // Allow new initialization attempts after a short delay
      setTimeout(() => {
        if (!socket?.connected) {
          setInitializing(false);
        }
      }, 3000);
    }
  }, [streamId, isStreamer, socket, initializing, reconnectAttempts, user, logDebug]);

  // Function to set up media playback for viewers
  const setupStreamPlayback = useCallback((mimeType: string) => {
    try {
      logDebug(`Setting up stream playback with MIME type: ${mimeType}`);

      // Clean up existing stream buffer if any
      if (streamBuffer) {
        streamBuffer.close();
      }

      // Create new stream buffer
      const newStreamBuffer = new StreamBuffer(mimeType, (error) => {
        logDebug(`Stream buffer error: ${error.message}`);
      });

      setStreamBuffer(newStreamBuffer);

      // Set video source
      if (videoRef.current) {
        videoRef.current.src = newStreamBuffer.getURL();
        videoRef.current.load();

        // Attempt to play the video
        const playPromise = videoRef.current.play();
        if (playPromise) {
          playPromise.catch(error => {
            logDebug(`Video play error: ${error.message}`);
            if (error.name === 'NotAllowedError') {
              toast.error("Video playback requires user interaction. Please tap the video to play.");
            }
          });
        }
      }
    } catch (error) {
      logDebug(`Error setting up playback: ${error instanceof Error ? error.message : String(error)}`);
      toast.error("Failed to set up video playback. Your browser may not support the required features.");
    }
  }, [streamBuffer, logDebug]);

  // Function to start camera for streamer
  const startCamera = useCallback(async () => {
    if (!isStreamer || mediaStream) return;

    try {
      logDebug("Requesting camera and microphone access");

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Mute local preview to prevent feedback
      }

      logDebug("Camera started successfully");
      setIsCameraStarted(true);

      // Notify server that we have started our camera
      if (socket?.connected) {
        socket.emit('camera-ready', { streamId });
      }

    } catch (error) {
      logDebug(`Camera start error: ${error instanceof Error ? error.message : String(error)}`);
      toast.error("Could not access camera or microphone. Please check permissions.");
    }
  }, [isStreamer, mediaStream, socket, streamId, logDebug]);

  // Function to start recording/streaming for streamer
  const startRecording = useCallback(() => {
    if (!isStreamer || !mediaStream || isRecording) return;

    try {
      logDebug("Starting media recording");

      // Configure MediaRecorder with appropriate settings for streaming
      // Reduce bitrate and use smaller chunks for more reliable transmission
      const options = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 800000 // Reduced to 800kbps (from 1.5 Mbps)
      };

      const recorder = new MediaRecorder(mediaStream, options);

      // Notify configuration to viewers
      if (socket?.connected) {
        socket.emit('stream-config', {
          streamId,
          mimeType: options.mimeType,
          width: 1280,
          height: 720,
          frameRate: 30
        });
      }

      // Send video chunks to server
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);

          // Send to server if connected
          if (socket?.connected) {
            event.data.arrayBuffer().then(buffer => {
              // Break large chunks into smaller ones to avoid PayloadTooLargeError
              const maxChunkSize = 64 * 1024; // 64KB chunks

              if (buffer.byteLength <= maxChunkSize) {
                // Small enough to send directly
                socket.emit('video-chunk', {
                  streamId,
                  chunk: buffer,
                  id: framesSent
                });
                setFramesSent(prev => prev + 1);
              } else {
                // Break into smaller chunks
                const totalChunks = Math.ceil(buffer.byteLength / maxChunkSize);
                logDebug(`Breaking large chunk (${buffer.byteLength} bytes) into ${totalChunks} pieces`);

                for (let i = 0; i < totalChunks; i++) {
                  const start = i * maxChunkSize;
                  const end = Math.min(start + maxChunkSize, buffer.byteLength);
                  const chunkPart = buffer.slice(start, end);

                  socket.emit('video-chunk', {
                    streamId,
                    chunk: chunkPart,
                    id: framesSent + i,
                    isMultipart: true,
                    partIndex: i,
                    totalParts: totalChunks
                  });
                }

                setFramesSent(prev => prev + totalChunks);
              }
            });
          }
        }
      };

      // Set chunk interval (150ms instead of 100ms = fewer chunks per second)
      recorder.start(150);

      setMediaRecorder(recorder);
      setIsRecording(true);
      logDebug("Recording started, sending video chunks to server");

    } catch (error) {
      logDebug(`Recording start error: ${error instanceof Error ? error.message : String(error)}`);
      toast.error("Failed to start streaming. Your browser may not support the required features.");
    }
  }, [isStreamer, mediaStream, isRecording, socket, streamId, framesSent, logDebug]);

  // Function to stop recording/streaming
  const stopRecording = useCallback(() => {
    if (!mediaRecorder || !isRecording) return;

    try {
      logDebug("Stopping recording");
      mediaRecorder.stop();
      setIsRecording(false);

      // Notify server
      if (socket?.connected) {
        socket.emit('stop-server-stream', { streamId });
      }

      logDebug(`Recording stopped after sending ${framesSent} chunks`);

    } catch (error) {
      logDebug(`Recording stop error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [mediaRecorder, isRecording, socket, streamId, framesSent, logDebug]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (!mediaStream) return;

    const audioTracks = mediaStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !isAudioEnabled;
    });

    setIsAudioEnabled(!isAudioEnabled);
    logDebug(`Audio ${!isAudioEnabled ? 'enabled' : 'disabled'}`);
  }, [mediaStream, isAudioEnabled, logDebug]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!mediaStream) return;

    const videoTracks = mediaStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !isVideoEnabled;
    });

    setIsVideoEnabled(!isVideoEnabled);
    logDebug(`Video ${!isVideoEnabled ? 'enabled' : 'disabled'}`);
  }, [mediaStream, isVideoEnabled, logDebug]);

  // Handle user interaction for iOS playback
  const handleUserInteraction = () => {
    const video = videoRef.current;
    if (!video) return;

    // Restart video playback if it's paused
    if (video.paused) {
      video.play().catch(err => {
        logDebug(`Error trying to play video after interaction: ${err.message}`);
      });
    }

    // For iOS Safari, we need to reattach MediaStream after user interaction
    if (isStreamer && mediaStream && !isCameraStarted) {
      video.srcObject = mediaStream;
      video.muted = true;
      setIsCameraStarted(true);
    }
  };

  // Function to run network diagnostics
  const runNetworkDiagnostics = useCallback(() => {
    logDebug("Running network diagnostics");

    // Update network info
    try {
      const connection = (navigator as {
        connection?: {
          type?: string;
          effectiveType?: string;
          downlink: number;
          rtt: number;
        }
      }).connection;
      if (connection) {
        setNetworkInfo({
          connectionType: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          lastChecked: new Date()
        });
        logDebug(`Network info: ${connection.effectiveType}, downlink: ${connection.downlink}Mbps, RTT: ${connection.rtt}ms`);
      }
    } catch (_unused) {
      // Network API not supported, continue silently
    }

    // Test backend connection
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/diagnostics/health`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(res => res.json())
      .then(data => {
        logDebug(`API health check: ${JSON.stringify(data)}`);
      })
      .catch(err => {
        logDebug(`API health check failed: ${err.message}`);
      });

  }, [logDebug]);

  // Initialize socket when component mounts
  useEffect(() => {
    logDebug(`ServerBasedStreamManager mounted. Streamer: ${isStreamer}, Stream ID: ${streamId}`);

    if (!socket && !initializing) {
      initializeSocket();
    }

    return () => {
      logDebug("ServerBasedStreamManager unmounting, cleaning up resources");

      // Stop recording if active
      if (mediaRecorder && isRecording) {
        try {
          mediaRecorder.stop();
        } catch (error) {
          console.error("Error stopping media recorder:", error);
        }
      }

      // Close stream buffer
      if (streamBuffer) {
        streamBuffer.close();
      }

      // Clean up media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }

      // Clean up socket
      if (socket) {
        socket.disconnect();
        // Use a safe value for the cache key
        const token = user ? user.token as string : undefined;
        clearSocketInstance(`${streamId}:${!!token}`);
      }
    };
  }, [isStreamer, streamId, socket, initializing, mediaRecorder, isRecording,
    mediaStream, streamBuffer, user, initializeSocket, logDebug]);

  // Start camera automatically for streamers
  useEffect(() => {
    if (isStreamer && isConnected && !isCameraStarted) {
      startCamera();
    }
  }, [isStreamer, isConnected, isCameraStarted, startCamera]);

  // Start recording automatically once camera is ready for streamers
  useEffect(() => {
    if (isStreamer && isConnected && isCameraStarted && !isRecording && mediaStream) {
      startRecording();
    }
  }, [isStreamer, isConnected, isCameraStarted, isRecording, mediaStream, startRecording]);

  // Reconnection logic
  useEffect(() => {
    if (!isConnected && !initializing && reconnectAttempts < 10) {
      const reconnectTimer = setTimeout(() => {
        logDebug("No socket reference, reconnecting...");
        initializeSocket();
      }, Math.min(reconnectAttempts * 1000, 5000));

      return () => clearTimeout(reconnectTimer);
    }

    // Periodic connection status check
    const diagInterval = setInterval(() => {
      if (!socket) {
        logDebug("No socket reference available");
      }

      if (!isConnected && !initializing) {
        logDebug("Diagnosing connection issues...");
        if (connectionErrors > 5) {
          logDebug(`Multiple connection failures (${connectionErrors}), may need to reload page`);
        }

        // Try to reconnect
        if (!initializing) {
          initializeSocket();
        } else {
          logDebug("Connection attempt already in progress");
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(diagInterval);
  }, [isConnected, initializing, reconnectAttempts, socket, connectionErrors, initializeSocket, logDebug]);

  // Create a video element with appropriate styling
  const createVideoElement = () => {
    return (
      <div className="relative w-full h-full" onClick={handleUserInteraction}>
        <Video
          videoRef={videoRef}
          muted={isStreamer} // Mute own video if streamer
          showDebugInfo={true} // Always show debug info
          autoPlay={true}
          playsInline={true}
        />

        {/* Connection status indicator */}
        <div className="absolute top-2 left-2 px-2 py-1 rounded text-xs text-white bg-black/50 flex items-center">
          {isConnected ? (
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              {isStreamer
                ? `Broadcasting (${framesSent} frames sent)`
                : `Connected (${framesReceived} frames received)`}
            </span>
          ) : (
            <span className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></span>
              {isTimedOut ? "Connection timed out. Retrying..." : "Reconnecting..."}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDiagnostics(!showDiagnostics);
            }}
            className="ml-2 bg-gray-700 hover:bg-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-xs"
          >
            {showDiagnostics ? "✕" : "ⓘ"}
          </button>
        </div>

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <div className="absolute top-10 left-2 right-2 z-10">
            <StreamDiagnostics
              networkStats={networkInfo}
              videoStats={{
                width: videoRef.current?.videoWidth || 0,
                height: videoRef.current?.videoHeight || 0,
                readyState: videoRef.current?.readyState || 0,
                networkState: videoRef.current?.networkState || 0,
                playbackRate: videoRef.current?.playbackRate || 1,
                // Use Safari-specific properties if available
                decodedFrames: (videoRef.current as SafariVideoElement)?.webkitDecodedFrameCount,
                droppedFrames: (videoRef.current as SafariVideoElement)?.webkitDroppedFrameCount,
              }}
              socketStats={{
                connected: isConnected,
                id: socket?.id,
                reconnectAttempts,
                errors: connectionErrors,
              }}
              framesSent={framesSent}
              framesReceived={framesReceived}
              streamId={streamId}
              userId={user?.id}
              isStreamer={isStreamer}
              onRunTest={runNetworkDiagnostics}
            />
          </div>
        )}

        {/* Log display (optional, can be removed in production) */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 overflow-hidden max-h-32">
          <div className="text-sm font-bold mb-1">Connection Info:</div>
          <div>Stream ID: {streamId}</div>
          <div>User ID: {user?.id || 'anonymous'}</div>
          <div>Socket ID: {socket?.id || 'not connected'}</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Is Streamer: {isStreamer ? 'Yes' : 'No'}</div>
          <div>Camera Started: {isCameraStarted ? 'Yes' : 'No'}</div>
          <div>Viewers: {viewerCount}</div>
          <div>Remote Streams: {framesReceived}</div>
          <div>Connection Errors: {connectionErrors}</div>
          <div>Reconnect Attempts: {reconnectAttempts}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-black flex flex-col">
      {/* Main video container */}
      <div className="flex-1 relative">
        {createVideoElement()}
      </div>

      {/* Streamer controls */}
      {isStreamer && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent">
          <StreamControls
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            isStreaming={isRecording}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onStopStream={stopRecording}
          />
        </div>
      )}
    </div>
  );
};

export { StreamControls }; 