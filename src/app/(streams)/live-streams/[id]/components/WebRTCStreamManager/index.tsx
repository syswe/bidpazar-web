"use client";
/**
 * WebRTCStreamManager
 * 
 * This is a refactored version of the original WebRTCStreamManager component.
 * The refactoring splits the ~4800 line monolithic component into
 * smaller, more maintainable parts.
 * 
 * Refactoring Structure:
 * 
 * 1. types.ts - Contains all interfaces, types, and constants
 * 2. utils/ 
 *    - logging.ts - Logging system
 *    - ice-config.ts - ICE server configurations and detection
 *    - storage.ts - LocalStorage utilities
 * 3. hooks/ (to be implemented)
 *    - useSocketConnection.ts - Socket.IO connection management
 *    - useMediasoupDevice.ts - MediaSoup device setup
 *    - useMediaTransports.ts - Producer/consumer transport handling
 *    - useMediaDevices.ts - Camera/mic device handling
 * 4. components/ (to be implemented)
 *    - VideoDisplay.tsx - Video element and related controls
 *    - ConnectionStatus.tsx - Status indicators and error messages
 *    - MediaControls.tsx - Mute/unmute and camera toggle buttons
 *    - DeviceSettings.tsx - Device selection interface
 * 
 * === REFACTORING STATUS ===
 * 
 * Completed:
 * - Created directory structure
 * - Extracted types to types.ts
 * - Extracted logging system to utils/logging.ts
 * - Extracted ICE configuration to utils/ice-config.ts
 * - Extracted localStorage utilities to utils/storage.ts
 * 
 * Next Steps:
 * 1. Extract socket connection logic to hooks/useSocketConnection.ts
 * 2. Extract media handling to hooks/useMedia.ts
 * 3. Extract UI components (video display, controls, status indicators)
 * 4. Refactor main component to use these modules
 * 5. Add documentation and finalize the refactoring
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { WebRTCStreamManagerProps } from "./types";
import { useSocketConnection } from "./hooks/useSocketConnection";
import { useMediasoupDevice } from "./hooks/useMediasoupDevice";
import { useWebRTCMedia } from "./hooks/useWebRTCMedia";
import { useMediaTransports } from "./hooks/useMediaTransports";
import { VideoDisplay } from "./components/VideoDisplay";
import { ConnectionInfo } from "./components/ConnectionInfo";
import { DeviceSelector } from "../DeviceSelector";
import { Settings } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { logInfo, logError } from "./utils/logging";
import { Button } from "@/components/ui/button";
import { PanelLeftOpen } from 'lucide-react';
import { Loader2, AlertTriangle } from "lucide-react";
import { useMedia } from '../../hooks/useMedia';

export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
  isCameraOn = true,
  isMicrophoneOn = true,
  isAnonymous = false,
  onParticipantCount,
  onConnectionError,
  onMediaError,
  className,
  onReconnectRequest,
  isLoopbackConnection,
  optimizeForLoopback,
  onLoopbackDetected,
}: WebRTCStreamManagerProps) {
  // State
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'streaming'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(isStreamer);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | undefined>(undefined);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(undefined);
  const [streamReady, setStreamReady] = useState(false);
  const [isVideoHidden, setIsVideoHidden] = useState(!isCameraOn);
  const [isMuted, setIsMuted] = useState(!isMicrophoneOn);
  
  // Add debugging flag for development issues
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const componentInstanceId = useRef(`wrtc-${Math.random().toString(36).substring(2, 10)}`).current;
  const initTimestamp = useRef(Date.now()).current;
  
  // Generate identifiers and refs
  const sessionId = useRef(uuidv4()).current;
  const anonymousId = useRef(uuidv4()).current;
  const effectiveUserId = userId || `anon-${anonymousId}`;
  const effectiveUsername = username || `viewer-${anonymousId.slice(0, 8)}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Debug mode for troubleshooting
  const DEBUG = process.env.NODE_ENV === 'development';
  const componentId = useRef(`wrtc-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Output initialization info in development
  useEffect(() => {
    if (DEBUG) {
      console.debug(`[WebRTC:${componentId}] Stream manager initialized`, {
        streamId,
        isStreamer,
        userId,
        isCameraOn,
        isMicrophoneOn,
        isAnonymous,
        isLoopback: isLoopbackConnection,
      });
    }
    
    // Cleanup for the component
    return () => {
      if (DEBUG) {
        console.debug(`[WebRTC:${componentId}] Stream manager unmounting`);
      }
    };
  }, [DEBUG, streamId, isStreamer, userId, isCameraOn, isMicrophoneOn, isAnonymous, isLoopbackConnection, componentId]);
  
  // Connection status handler
  const handleConnectionStatusChange = useCallback((status: 'disconnected' | 'connecting' | 'connected' | 'streaming') => {
    setConnectionStatus(status);
    
    // Clear error on connection
    if (status === 'connected' || status === 'streaming') {
      setError(null);
    }
  }, []);
  
  // Handle connection errors
  const handleConnectionError = useCallback((error: { type: string; message: string; canReconnect: boolean; details?: any }) => {
    setError(error.message);
    if (onConnectionError) {
      onConnectionError(error);
    }
  }, [onConnectionError]);
  
  // Set up MediaSoup device
  const { 
    deviceRef, 
    rtpCapabilitiesRef, 
    isDeviceLoaded, 
    initializeMediasoupDevice 
  } = useMediasoupDevice({
    onDeviceLoadFailed: (err) => {
      setError(`Failed to initialize MediaSoup device: ${err.message || "Unknown error"}`);
      if (onConnectionError) {
        onConnectionError({
          type: "DEVICE_ERROR",
          message: `Failed to initialize MediaSoup device: ${err.message || "Unknown error"}`,
          canReconnect: true
        });
      }
    }
  });
  
  // Set up socket connection
  const { 
    socket, 
    isRecovering, 
    reconnectionFailed, 
    triggerManualReconnect,
    isLoopback
  } = useSocketConnection({
    streamId,
    userId: effectiveUserId,
    username: effectiveUsername,
    isStreamer,
    isAnonymous,
    sessionId,
    onConnectionStatusChange: handleConnectionStatusChange,
    onError: (errorMessage) => {
      setError(errorMessage);
    },
    deviceRef,
    rtpCapabilitiesRef,
    onDeviceInitialized: initializeMediasoupDevice,
    onParticipantCount: (count) => {
      setParticipantCount(count);
      if (onParticipantCount) {
        onParticipantCount(count);
      }
    },
    onConnectionError: handleConnectionError,
    isLoopbackConnection,
    optimizeForLoopback,
    onLoopbackDetected
  });
  
  // Set up media handling with our new useMedia hook
  const {
    stream: localStream,
    isCameraOn: isCameraEnabled,
    isMicrophoneOn: isMicrophoneEnabled,
    isLoading: isMediaLoading,
    error: mediaError,
    devices,
    selectedDevices,
    toggleCamera,
    toggleMicrophone,
    selectDevice,
    reinitialize
  } = useMedia({
    isStreamer,
    initialState: {
      isCameraOn,
      isMicrophoneOn,
      selectedVideoId: selectedVideoDevice,
      selectedAudioId: selectedAudioDevice
    },
    onMediaError: (errorType, errorMessage, details) => {
      if (errorType === 'critical') {
        setError(errorMessage);
      }
      if (onMediaError) {
        onMediaError(errorType, errorMessage, details);
      }
    },
    onMediaReady: (stream) => {
      setStreamReady(true);
      localStreamRef.current = stream;
    }
  });
  
  // Update local stream ref when stream changes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  
  // Update device selection state
  useEffect(() => {
    if (selectedDevices.videoId !== selectedVideoDevice) {
      setSelectedVideoDevice(selectedDevices.videoId || undefined);
    }
    if (selectedDevices.audioId !== selectedAudioDevice) {
      setSelectedAudioDevice(selectedDevices.audioId || undefined);
    }
  }, [selectedDevices]);
  
  // Update video/mic state
  useEffect(() => {
    setIsVideoHidden(!isCameraEnabled);
    setIsMuted(!isMicrophoneEnabled);
  }, [isCameraEnabled, isMicrophoneEnabled]);
  
  // Handle media initialization errors
  const handleMediaError = useCallback((errorType: string, message: string, details?: any) => {
    if (errorType === 'critical') {
      setError(message);
    }
    if (onMediaError) {
      onMediaError(errorType, message, details);
    }
  }, [onMediaError]);
  
  // Handle device selection
  const handleDeviceChange = useCallback((type: "video" | "audio", deviceId: string) => {
    selectDevice(type, deviceId);
  }, [selectDevice]);
  
  // Set up media transports
  const {
    transportRef,
    producersRef,
    consumersRef,
    produceLocalMedia,
    transportReady
  } = useMediaTransports({
    socket,
    deviceRef,
    isStreamer,
    streamId,
    localStreamRef,
    videoRef,
    onTransportConnected: () => {
      logInfo("Transport connected successfully");
      if (isStreamer && localStreamRef.current) {
        produceLocalMedia(localStreamRef.current);
      }
    },
    onProducerCreated: (kind, producer) => {
      logInfo(`${kind} producer created`, { producerId: producer?.id });
      // Update UI or trigger additional logic if needed
    },
    onConsumerCreated: (kind, consumer) => {
      logInfo(`${kind} consumer created`, { consumerId: consumer?.id });
      setStreamReady(true);
    },
    onStreamReady: () => {
      setStreamReady(true);
    },
    onConnectionError: (error) => {
      setError(error.message);
      if (onConnectionError) {
        onConnectionError({
          type: error.type,
          message: error.message,
          canReconnect: true,
          details: error.details
        });
      }
    },
    onAutoplayBlocked: (blocked) => {
      setAutoplayBlocked(blocked);
      if (blocked) {
        setError("Autoplay blocked. Please click to play.");
      }
    }
  });
  
  // Handle reconnection
  const handleReconnect = useCallback(() => {
    if (onReconnectRequest) {
      onReconnectRequest(() => {
        // Reconnection callback
        setError(null);
        setConnectionStatus('connecting');
        reinitialize();
      });
    } else {
      // If no callback provided, just reinitialize
      setError(null);
      setConnectionStatus('connecting');
      reinitialize();
    }
  }, [onReconnectRequest, reinitialize]);
  
  // Add diagnostic information
  const diagnosticInfo = {
    instanceId: componentInstanceId,
    sessionId,
    streamId,
    userId: effectiveUserId,
    connectionStatus,
    error,
    isStreamer,
    isAnonymous,
    isCameraOn,
    isMicrophoneOn,
    isDeviceLoaded,
    streamReady,
    transportReady,
    isLoopback,
    initTime: new Date(initTimestamp).toISOString(),
    uptime: `${((Date.now() - initTimestamp) / 1000).toFixed(1)}s`,
    browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    videoTracks: localStreamRef.current?.getVideoTracks().length || 0,
    audioTracks: localStreamRef.current?.getAudioTracks().length || 0
  };

  // Collect and display diagnostic information
  const logDiagnostics = useCallback(() => {
    logInfo("WebRTCStreamManager Diagnostics", diagnosticInfo);
    return diagnosticInfo;
  }, [
    diagnosticInfo
  ]);

  // Add an effect to log diagnostics on failure
  useEffect(() => {
    if (error || reconnectionFailed) {
      logDiagnostics();
    }
  }, [error, reconnectionFailed, logDiagnostics]);
  
  // Reset on unmount (important for cleanup)
  useEffect(() => {
    mountedRef.current = true;
    
    // Print initialization message for debugging
    console.debug(`[WebRTCStreamManager] Initialized with ID: ${componentInstanceId}`, {
      streamId,
      isStreamer,
      isLoopbackConnection
    });
    
    return () => {
      mountedRef.current = false;
      console.debug(`[WebRTCStreamManager] Unmounting instance: ${componentInstanceId}`);
      
      // Additional cleanup logic
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn("Error stopping track during cleanup:", e);
          }
        });
      }
    };
  }, [streamId, isStreamer, componentInstanceId, isLoopbackConnection]);

  return (
    <div
      className={cn(
        "relative flex flex-col bg-black min-h-[200px] h-full w-full rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Video element container */}
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={true}
          className={`w-full h-full object-cover ${
            isVideoHidden ? "invisible" : "visible"
          }`}
        />
        
        {/* Loading or error states */}
        {connectionStatus !== "connected" && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-2" />
              <div className="text-white font-medium">
                {connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
              </div>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="absolute top-0 left-0 right-0 bg-red-500/80 text-white p-2 text-sm text-center flex items-center justify-center z-20">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {error.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </div>
        )}
        
        {/* Stream info overlay */}
        {connectionStatus === "connected" && (
          <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2 z-10">
            <div
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            ></div>
            <span className="text-xs font-medium">
              {participantCount > 0
                ? `${participantCount} viewer${participantCount !== 1 ? "s" : ""}`
                : "Live"}
            </span>
          </div>
        )}
        
        {/* Recovering connection indicator */}
        {isRecovering && (
          <div className="absolute bottom-4 left-4 right-4 bg-yellow-600 bg-opacity-90 text-white p-2 rounded-md text-center text-sm z-30">
            Connection lost. Attempting to recover your session...
          </div>
        )}
      </div>
      
      {/* Connection status bar */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center space-x-2">
        <div className={`h-3 w-3 rounded-full ${
          isLoopback ? "bg-purple-500" : 
          connectionStatus === "connected" ? "bg-green-500" : 
          connectionStatus === "connecting" ? "bg-yellow-500" : 
          "bg-red-500"
        }`} />
        <div className="text-white text-xs bg-black/60 px-2 py-1 rounded">
          {isLoopback ? "Loopback" : connectionStatus}
        </div>
        
        {reconnectionFailed && (
          <button 
            onClick={handleReconnect}
            className="text-white text-xs bg-blue-600 px-2 py-1 rounded"
          >
            Reconnect
          </button>
        )}
      </div>
      
      {/* Show diagnostic button in corner */}
      <div className="absolute bottom-2 right-2 z-50 opacity-50 hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full bg-black/20 p-0"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          title="Stream diagnostics"
        >
          <PanelLeftOpen className="h-3 w-3 text-white" />
        </Button>
      </div>
      
      {/* Diagnostic panel */}
      {showDiagnostics && (
        <div className="absolute right-0 bottom-8 bg-black/80 text-white text-xs p-2 rounded-md z-50 max-w-xs overflow-auto max-h-[300px]">
          <h4 className="font-bold">Stream Diagnostics</h4>
          <div className="mt-1 space-y-1 text-[10px]">
            <div><span className="opacity-70">ID:</span> {componentInstanceId}</div>
            <div><span className="opacity-70">Status:</span> {connectionStatus}</div>
            <div><span className="opacity-70">Loopback:</span> {isLoopback ? 'Yes' : 'No'}</div>
            <div><span className="opacity-70">Stream Ready:</span> {streamReady ? 'Yes' : 'No'}</div>
            <div><span className="opacity-70">Transport Ready:</span> {transportReady ? 'Yes' : 'No'}</div>
            <div><span className="opacity-70">Video Tracks:</span> {localStreamRef.current?.getVideoTracks().length || 0}</div>
            <div><span className="opacity-70">Audio Tracks:</span> {localStreamRef.current?.getAudioTracks().length || 0}</div>
            <div><span className="opacity-70">Participants:</span> {participantCount}</div>
            <div><span className="opacity-70">Uptime:</span> {((Date.now() - initTimestamp) / 1000).toFixed(1)}s</div>
            {error && (
              <div className="text-red-400">
                <span className="opacity-70">Error:</span> {error}
              </div>
            )}
          </div>
          <button 
            className="mt-2 text-[10px] bg-blue-600 px-2 py-1 rounded-sm"
            onClick={handleReconnect}
          >
            Force Reconnect
          </button>
        </div>
      )}
      
      {/* Device selector (only for streamers) */}
      {isStreamer && showDeviceSelector && (
        <div className="absolute inset-0 bg-black/80 z-50 p-4 flex flex-col">
          <h2 className="text-white font-bold mb-4">Device Settings</h2>
          
          <div className="space-y-4 flex-1 overflow-auto">
            {/* Video device selection */}
            <div>
              <label className="text-white block mb-2">Camera</label>
              <select 
                className="w-full bg-gray-800 text-white p-2 rounded"
                value={selectedVideoDevice || ""}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
              >
                <option value="">Select camera...</option>
                {localStreamRef.current && (
                  <option value="current">Current camera</option>
                )}
              </select>
            </div>
            
            {/* Audio device selection */}
            <div>
              <label className="text-white block mb-2">Microphone</label>
              <select 
                className="w-full bg-gray-800 text-white p-2 rounded"
                value={selectedAudioDevice || ""}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
              >
                <option value="">Select microphone...</option>
                {localStreamRef.current && (
                  <option value="current">Current microphone</option>
                )}
              </select>
            </div>
          </div>
          
          <div className="pt-4 flex justify-between">
            <button 
              className="bg-gray-700 text-white px-4 py-2 rounded"
              onClick={() => setShowDeviceSelector(false)}
            >
              Cancel
            </button>
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={() => {
                reinitialize();
                setShowDeviceSelector(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
      <DeviceSelector
        devices={{
          video: devices.video,
          audio: devices.audio
        }}
        selectedDevices={{
          videoId: selectedVideoDevice || null,
          audioId: selectedAudioDevice || null
        }}
        onDeviceChange={handleDeviceChange}
        isLoading={isMediaLoading}
        error={mediaError}
      />
    </div>
  );
}