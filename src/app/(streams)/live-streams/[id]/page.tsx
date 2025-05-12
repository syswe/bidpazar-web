// src/app/(streams)/live-streams/[id]/page.tsx
"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/frontend-auth";
import { toast } from "sonner";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
import { Cpu, Loader2, X } from "lucide-react";
import dynamic from "next/dynamic";

// Import components
import { StreamDiagnostics } from "./components/StreamDiagnostics";
import StreamChat from "./components/StreamChat";
import StreamControls from "./components/StreamControls";
import StreamHeader from "./components/StreamHeader";
import StreamActions from "./components/StreamActions";
import ProductSection from "./components/ProductSection";
import { StreamLoadingState, StreamErrorState, StreamNotFoundState } from "./components/StreamStates";
import MediaErrorDisplay from "./components/MediaErrorDisplay";

// Import custom hooks
import { useStreamDetails } from "./hooks/useStreamDetails";
import { useStreamControls } from "./hooks/useStreamControls";
import { useStreamLogging } from "./hooks/useStreamLogging";
import { useActiveBid } from "./hooks/useActiveBid";
import { useMedia } from "./hooks/useMedia";
import { useReconnection } from "./hooks/useReconnection";

// Import CSS
import "./styles/streamStyles.css";

// Use dynamic import with no SSR for WebRTCStreamManager
const WebRTCStreamManager = dynamic(
  () => import("./components/WebRTCStreamManager"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-2" />
          <div className="text-white text-sm">Loading stream...</div>
        </div>
      </div>
    ),
  }
);

// Add the WebRTC diagnostic tool (dynamically loaded)
const WebRTCDiagnostics = dynamic(
  () => import("./components/WebRTCDiagnostics"),
  { ssr: false }
);

// Create a unique ID to prevent duplicate initialization
const INITIALIZATION_ID = Math.random().toString(36).substring(2, 15);

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.id as string;
  const { user } = useAuth();
  const { token } = getAuth();
  const userId = user?.id;
  const username = user?.username;
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const [mediaError, setMediaError] = useState<any>(null);
  
  // Track media initialization to prevent double initialization
  const mediaInitializedRef = useRef<boolean>(false);

  // Local UI state
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [isDeviceSetupComplete, setIsDeviceSetupComplete] = useState<boolean>(false);
  const [isCurrentUserStreamer, setIsCurrentUserStreamer] = useState<boolean>(false);

  // Initialize custom hooks
  const { 
    logs, 
    logMessage, 
    connectionState, 
    optimizedForLoopback,
    handleLoopbackDetected
  } = useStreamLogging(streamId);

  const { 
    streamDetails, 
    isLoading: isStreamDetailsLoading, 
    error: streamDetailsError, 
    fetchStreamDetails 
  } = useStreamDetails({
    streamId,
    token: token || undefined,
    logMessage: logMessage as (message: string, level?: string, data?: any) => void,
    runtimeConfig,
    isConfigLoading
  });

  // Update isCurrentUserStreamer when stream details are loaded
  useEffect(() => {
    if (streamDetails) {
      const isStreamer = userId === streamDetails.creatorId;
      setIsCurrentUserStreamer(isStreamer);
      logMessage("Streamer status updated", "info", { isStreamer, userId, creatorId: streamDetails.creatorId });
    }
  }, [streamDetails, userId, logMessage]);

  // Define helper function for media errors
  const handleMediaError = useCallback((errorType: string, errorMessage: string, details?: any) => {
    logMessage(`Media Error: ${errorType} - ${errorMessage}`, "error", { errorDetails: details });
    
    // Avoid showing duplicate error messages
    if (mediaError?.message !== errorMessage) {
      toast.error(`Media issue (${errorType}): ${errorMessage}`, { duration: 7000 });
      setMediaError({ type: errorType, message: errorMessage, details });
    }
    
    // Auto-reset device setup flag if it's a critical error
    if (errorType === 'initialization' || errorType === 'permission') {
      setIsDeviceSetupComplete(false);
    }
    
    // If it's a recoverable error, don't reset the flag
    if (errorType === 'temporary' || errorType === 'network') {
      // Don't reset device setup for temporary issues
      return;
    }
  }, [logMessage, mediaError]);

  // Clear media error function
  const clearMediaError = useCallback(() => {
    setMediaError(null);
  }, []);

  // Media controls hook with improved initialization
  const {
    isLoading: mediaLoading,
    error: mediaHookError,
    isCameraOn,
    isMicrophoneOn,
    devices,
    selectedDevices,
    stream,
    toggleCamera: handleCameraToggle,
    toggleMicrophone: handleMicrophoneToggle,
    selectDevice,
    reinitialize
  } = useMedia({ 
    onMediaError: handleMediaError,
    onMediaReady: (stream) => {
      if (mediaInitializedRef.current) return; // Prevent duplicate callbacks
      mediaInitializedRef.current = true;
      
      const hasVideo = !!stream.getVideoTracks().length;
      const hasAudio = !!stream.getAudioTracks().length;
      
      logMessage("Media stream ready", "info", { 
        hasVideo,
        hasAudio,
        initId: INITIALIZATION_ID,
        isCurrentUserStreamerValue: isCurrentUserStreamer
      });
      
      // Mark device setup as complete when media is available
      if (hasVideo || hasAudio) {
        setIsDeviceSetupComplete(true);
        logMessage("Device setup marked as complete.", "info", { isCurrentUserStreamer, hasVideo, hasAudio });
      } else {
        // If no media tracks are available, show an error
        handleMediaError(
          "setup", 
          "No camera or microphone detected. Please ensure at least one device is enabled.",
          { missingMedia: true }
        );
      }
    },
    isStreamer: isCurrentUserStreamer,
    initialState: {
      isCameraOn: true,
      isMicrophoneOn: true
    }
  });

  // Reinitialize media when streamer status changes
  useEffect(() => {
    if (!isStreamDetailsLoading && streamDetails) {
      reinitialize();
    }
  }, [isStreamDetailsLoading, streamDetails, reinitialize]);

  // Handle device selection - this is our centralized handler
  const handleDeviceSelect = useCallback((kind: 'audio' | 'video', deviceId: string) => {
    selectDevice(kind, deviceId);
    logMessage(`Selected ${kind} device: ${deviceId}`, "info");
  }, [selectDevice, logMessage]);
  
  // Improved stream initialization
  const initializeStream = useCallback(async () => {
    if (!streamDetails || !userId) return;
    
    // Don't proceed if we're already in a live state
    if (streamDetails.status === "LIVE") {
      logMessage("Stream is already LIVE, no need to initialize", "info");
      return;
    }
    
    // If stream is not in STARTING state, attempt to start it first
    // Type assertion to fix TS error with union types
    const currentStatus = streamDetails.status as string;
    if (currentStatus !== "STARTING" && currentStatus !== "SCHEDULED") {
      try {
        logMessage("Streamer attempting to start the stream", "info", {
          streamId,
          isStreamer: isCurrentUserStreamer
        });
        
        // Call the start API endpoint to transition stream to STARTING
        const response = await fetch(`${runtimeConfig?.apiUrl}/live-streams/${streamId}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        logMessage("Stream started successfully via API", "info", data);
        
        // Refresh stream details after starting
        await fetchStreamDetails();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logMessage(`Failed to start stream: ${errorMessage}`, "error");
        toast.error("Failed to start stream. Please try again.");
        return;
      }
    }
    
    // At this point stream should be in STARTING or LIVE state - ready for WebRTC connection
    logMessage("Yayın başlatıldı", "info");
  }, [streamDetails, userId, streamId, isCurrentUserStreamer, runtimeConfig, token, fetchStreamDetails, logMessage]);

  // Handle connection errors
  const handleConnectionError = useCallback((errorData: {
    type: string;
    message: string;
    canReconnect: boolean;
    isLoopback?: boolean;
    canCreateNewStream?: boolean;
    details?: any;
  }) => {
    // Create an enhanced message for stream ended errors
    let errorMessage = errorData.message;
    
    // For stream ended errors, add guidance on creating a new stream
    if (errorData.type === 'STREAM_ENDED' || errorMessage.includes('stream has already ended')) {
      if (isCurrentUserStreamer) {
        errorMessage = 'This stream has ended. To start a new stream, please go to your dashboard and click "Start New Stream".';
      } else {
        errorMessage = 'This stream has ended. Please check for other available streams.';
      }
    }
    
    // Log the error with context
    logMessage(
      `Connection error: ${errorData.type} - ${errorMessage}`,
      'error',
      { 
        originalMessage: errorData.message,
        canReconnect: errorData.canReconnect,
        isLoopback: errorData.isLoopback,
        canCreateNewStream: errorData.canCreateNewStream,
        details: errorData.details
      }
    );
    
    // Show a toast with the error message
    toast.error(errorMessage, { duration: 7000 });
    
    // Set the connection state (if we have a connectionState object)
    if (connectionState) {
      connectionState.lastError = errorMessage;
    }
  }, [logMessage, connectionState, isCurrentUserStreamer]);

  // Reconnection hook
  const {
    webRtcKey,
    handleReconnectRequest,
    handleReconnect,
    handleConnectionReset
  } = useReconnection({
    streamId,
    logMessage: logMessage as (message: string, level?: string, data?: any) => void,
    fetchStreamDetails
  });

  const { 
    isControlsLoading, 
    handleStartStream: executeStartStream,
    handleEndStream 
  } = useStreamControls({
    streamId,
    token: token || undefined,
    isStreamer: isCurrentUserStreamer,
    logMessage: logMessage as (message: string, level?: string, data?: any) => void,
    runtimeConfig,
    fetchStreamDetails
  });

  const { 
    activeProductBid, 
    fetchActiveBid 
  } = useActiveBid({
    streamId,
    token: token || undefined,
    isStreamer: isCurrentUserStreamer,
    isConfigLoading,
    logMessage: logMessage as (message: string, level?: string, data?: any) => void
  });

  // Handle start stream with device setup check
  const handleStreamStart = useCallback(async () => {
    if (!isDeviceSetupComplete) {
      toast.warning("Lütfen kamera ve mikrofonunuzu ayarlayın", { duration: 5000 });
      return;
    }
    
    if (!stream) {
      toast.error("Kamera akışı hazır değil. Lütfen bir süre bekleyip tekrar deneyin.", { duration: 5000 });
      return;
    }
    
    // Verify that stream actually has tracks
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    if (videoTracks.length === 0 && audioTracks.length === 0) {
      toast.error("Aktif bir kamera veya mikrofon seçmelisiniz.", { duration: 5000 });
      setIsDeviceSetupComplete(false); // Reset setup flag to force reconfiguration
      logMessage("Stream start failed - no active tracks", "error");
      return;
    }
    
    // Proceed with starting the stream
    await executeStartStream();
    logMessage("Yayın başlatıldı", "info");
  }, [executeStartStream, isDeviceSetupComplete, stream, logMessage]);

  // Helper function to generate random ID for anonymous users
  const generateRandomId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  // Prepare username and userId for anonymous users
  const effectiveUsername = username || "Anonymous Viewer";
  const effectiveUserId = userId || `anonymous-${generateRandomId()}`;

  // Handle like button
  const handleLike = useCallback(() => {
    setIsLiked(prevLiked => {
      if (!prevLiked) {
        setLikeCount((prev) => prev + 1);
      } else {
        setLikeCount((prev) => prev - 1);
      }
      
      logMessage(`User ${prevLiked ? "unliked" : "liked"} the stream`, "info");
      return !prevLiked;
    });
  }, [logMessage]);

  // Handle share button
  const handleShare = useCallback(() => {
    logMessage("User attempted to share stream", "info");
    toast.info("Share functionality coming soon!");
  }, [logMessage]);

  // Handle navigation back to home
  const handleBackToHome = useCallback(() => {
    logMessage("User navigating back to home", "info");
    router.push("/live-streams");
  }, [logMessage, router]);

  // Handle WebRTC reconnection request
  const onReconnectRequest = useCallback(() => {
    handleReconnectRequest({
      type: "connection_error",
      message: "Connection lost, attempting to reconnect",
      canReconnect: true
    });
  }, [handleReconnectRequest]);

  // Check if we can render the stream
  const canRenderStreamManager = !isStreamDetailsLoading && !!streamDetails && !!streamId;

  // Debug mode for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        "%c[BIDPAZAR LIVESTREAM DEBUG]%c\n" +
        "If you're experiencing connection issues:\n" +
        "1. Try using Chrome for best WebRTC support\n" +
        "2. Check your browser's camera/mic permissions\n" +
        "3. In localhost, try 127.0.0.1 instead of localhost\n" +
        "4. Use the WebRTC Diagnostics tool below\n" +
        "5. Check Console for detailed logs",
        "color: white; background: #0070f3; padding: 2px 6px; border-radius: 4px; font-weight: bold;",
        "color: #666; font-size: 11px;"
      );
    }
  }, []);

  // Render appropriate states
  if (isStreamDetailsLoading) {
    return <StreamLoadingState />;
  }

  if (streamDetailsError) {
    return <StreamErrorState errorMessage={streamDetailsError} onBackToHome={handleBackToHome} />;
  }

  if (!streamDetails) {
    return <StreamNotFoundState onBackToHome={handleBackToHome} />;
  }

  // Main stream view
  return (
    <div className="vertical-stream-container">
      <div className="stream-content-wrapper">
        {/* Main video container */}
        <div className="video-container">
          {canRenderStreamManager ? (
            <div className="relative w-full h-full">
              {/* Improved: Show start button for streamers with non-LIVE streams */}
              {isCurrentUserStreamer && 
               streamDetails.status !== "LIVE" && 
               isDeviceSetupComplete && 
               !mediaError && (
                <div className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center">
                  <div className="p-6 rounded-lg bg-black/50 max-w-lg text-center">
                    <h3 className="text-2xl font-semibold text-white mb-2">Ready to Go Live?</h3>
                    <p className="text-gray-300 mb-4">
                      Your device setup is complete. Start your stream when you're ready.
                    </p>
                    <button
                      onClick={initializeStream}
                      className="mt-2 py-3 px-6 rounded-lg bg-rose-600 hover:bg-rose-700 transition-colors text-white font-medium"
                    >
                      Start Streaming
                    </button>
                  </div>
                </div>
              )}
              
              <WebRTCStreamManager
                key={webRtcKey}
                streamId={streamId}
                userId={effectiveUserId}
                username={effectiveUsername}
                isStreamer={isCurrentUserStreamer}
                isCameraOn={isCameraOn}
                isMicrophoneOn={isMicrophoneOn}
                onParticipantCount={(count) => logMessage(`Stream participants: ${count}`, "info")}
                onConnectionError={handleConnectionError}
                onMediaError={handleMediaError}
                isAnonymous={!user}
                onReconnectRequest={onReconnectRequest}
                isLoopbackConnection={connectionState.isLoopback}
                optimizeForLoopback={optimizedForLoopback}
                onLoopbackDetected={handleLoopbackDetected}
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {/* Show loopback connection indicator if detected */}
          {connectionState.isLoopback && (
            <div className="absolute top-20 right-4 bg-amber-500/80 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-md z-50">
              <Cpu className="h-3 w-3 mr-1" />
              <span>Local Connection</span>
            </div>
          )}

          {/* Video overlay elements */}
          <div className="video-overlay">
            {/* Stream header */}
            <StreamHeader 
              streamDetails={streamDetails} 
              onBackClick={handleBackToHome} 
            />

            {/* Stream actions - only show for authenticated users */}
            {user && (
              <StreamActions 
                isLiked={isLiked}
                onLike={handleLike}
                onShare={handleShare}
                onShowDiagnostics={() => setShowDiagnostics(!showDiagnostics)}
              />
            )}

            {/* Product and controls */}
            <div className="product-and-controls-row">
              <ProductSection 
                streamId={streamId}
                isStreamer={isCurrentUserStreamer}
                activeProductBid={activeProductBid}
                fetchActiveBid={fetchActiveBid}
                user={user}
              />

              {isCurrentUserStreamer && (
                <StreamControls
                  streamId={streamId}
                  isStreamer={isCurrentUserStreamer}
                  streamStatus={streamDetails.status}
                  onStartStream={handleStreamStart}
                  onEndStream={handleEndStream}
                  isLoading={isControlsLoading}
                  isCameraOn={isCameraOn}
                  isMicrophoneOn={isMicrophoneOn}
                  onCameraToggle={handleCameraToggle}
                  onMicrophoneToggle={handleMicrophoneToggle}
                  devices={devices}
                  selectedDevices={{
                    videoId: selectedDevices.videoId || undefined,
                    audioId: selectedDevices.audioId || undefined
                  }}
                  onDeviceSelect={handleDeviceSelect}
                  isDeviceSetupComplete={isDeviceSetupComplete}
                />
              )}
            </div>

            {/* Chat container */}
            <div className="chat-container">
              <StreamChat
                streamId={streamId}
                currentUserId={userId || "anonymous"}
                currentUsername={username || "Anonymous Viewer"}
                className="w-full h-full"
              />
            </div>

            {/* Show login prompt for anonymous users */}
            {!user && (
              <div className="absolute bottom-4 left-0 right-0 text-center z-50">
                <div className="bg-black/70 mx-auto max-w-md px-4 py-2 rounded-lg text-white">
                  <p>Sign in to chat, bid, and interact with this stream</p>
                  <button
                    onClick={() => router.push("/login")}
                    className="mt-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white z-50 h-1/2 overflow-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Stream Diagnostics</h3>
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <StreamDiagnostics
                streamId={streamId}
                streamInfo={streamDetails}
                connectionState={connectionState}
                logs={logs}
                onReset={handleConnectionReset}
              />
            </div>
          </div>
        )}

        {/* Display a toast message for media errors but allow continuing */}
        {mediaError && isCurrentUserStreamer && (
          <MediaErrorDisplay 
            mediaError={mediaError} 
            onDismiss={clearMediaError}
            onRetry={() => {
              clearMediaError();
              // Force media reinitialization
              if (reinitialize) {
                reinitialize();
                logMessage('User triggered media recovery', 'info');
              }
            }} 
          />
        )}

        {/* Add the diagnostics tool in development mode */}
        {process.env.NODE_ENV === 'development' && mediaError && (
          <div className="fixed bottom-4 right-4 z-50">
            <WebRTCDiagnostics />
          </div>
        )}
      </div>
    </div>
  );
}
