"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import { Volume2, VolumeX, Video, VideoOff, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoDisplayProps {
  isStreamer: boolean;
  isMuted: boolean;
  isVideoHidden: boolean;
  streamReady: boolean;
  autoplayBlocked: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'streaming';
  error: string | null;
  participantCount: number;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onManualPlay: () => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isRecovering?: boolean;
  reconnectionFailed?: boolean;
  onReconnect?: () => void;
  className?: string;
}

export function VideoDisplay({
  isStreamer,
  isMuted,
  isVideoHidden,
  streamReady,
  autoplayBlocked,
  connectionStatus,
  error,
  participantCount,
  onToggleMute,
  onToggleVideo,
  onManualPlay,
  videoRef,
  isRecovering = false,
  reconnectionFailed = false,
  onReconnect,
  className,
}: VideoDisplayProps) {
  // Detect reconnection failure in error message if not explicitly provided
  const [internalReconnectionFailed, setInternalReconnectionFailed] = useState(false);
  
  // Only use internal state if reconnectionFailed prop is not provided
  const effectiveReconnectionFailed = reconnectionFailed || internalReconnectionFailed;
  
  // Detect reconnection failure in error message
  useEffect(() => {
    if (!reconnectionFailed && error && error.includes("Failed to reconnect")) {
      setInternalReconnectionFailed(true);
    } else if (!reconnectionFailed && !error) {
      setInternalReconnectionFailed(false);
    }
  }, [error, reconnectionFailed]);
  
  return (
    <div className={cn("webrtc-stream-manager relative", className)}>
      {/* Video element */}
      <video
        ref={videoRef?.current !== undefined ? videoRef : null}
        autoPlay
        playsInline
        muted={isStreamer || isMuted}
        className={`w-full h-full object-cover ${
          isVideoHidden ? "invisible" : "visible"
        }`}
      />

      {/* Loading indicator */}
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

      {/* Autoplay blocked overlay */}
      {autoplayBlocked && streamReady && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 cursor-pointer"
          onClick={onManualPlay}
        >
          <div className="text-center bg-black/70 p-5 rounded-lg shadow-lg flex flex-col items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-white mb-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            <div className="text-white font-medium text-lg mb-1">
              Click to Play
            </div>
            <div className="text-gray-300 text-sm">
              Autoplay was blocked by your browser
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !autoplayBlocked && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/80 text-white p-2 text-sm text-center flex items-center justify-center z-20">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error.split("\\n").map((line, i) => (
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

      {/* Media controls */}
      <div className="absolute bottom-4 left-4 flex space-x-2 z-10">
        {/* Audio toggle button */}
        <button
          onClick={onToggleMute}
          className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Video toggle button (for streamers only) */}
        {isStreamer && (
          <button
            onClick={onToggleVideo}
            className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            aria-label={isVideoHidden ? "Show video" : "Hide video"}
            title={isVideoHidden ? "Show video" : "Hide video"}
          >
            {isVideoHidden ? (
              <VideoOff className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Not ready overlay */}
      {!streamReady && !error && connectionStatus === "connected" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <div className="font-medium">
              {isStreamer ? "Setting up camera..." : "Waiting for stream..."}
            </div>
          </div>
        </div>
      )}
      
      {/* Recovering connection indicator */}
      {isRecovering && (
        <div className="absolute bottom-4 left-4 right-4 bg-yellow-600 bg-opacity-90 text-white p-2 rounded-md text-center text-sm">
          Connection lost. Attempting to recover your session...
        </div>
      )}

      {/* Reconnection failed UI */}
      {effectiveReconnectionFailed && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-800 bg-opacity-90 text-white p-3 rounded-md text-center">
          <p className="mb-2">
            Connection lost. Unable to reconnect automatically.
          </p>
          <button
            onClick={onReconnect || (() => window.location.reload())}
            className="bg-white text-red-800 px-4 py-1 rounded-md font-medium hover:bg-gray-100 transition-colors"
          >
            {onReconnect ? "Try Again" : "Refresh Page"}
          </button>
        </div>
      )}
    </div>
  );
} 