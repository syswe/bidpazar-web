import { useCallback, useEffect, useRef, useState } from "react";
import { logInfo, logError, logWarn } from "../utils/logging";
import { LogData } from "../types";

interface UseWebRTCMediaProps {
  isCameraOn?: boolean;
  isMicrophoneOn?: boolean;
  selectedVideoDevice?: string;
  selectedAudioDevice?: string;
  isStreamer: boolean;
  isAnonymous?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onMediaError?: (errorType: string, errorMessage: string, details?: any) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export function useWebRTCMedia({
  isCameraOn = true,
  isMicrophoneOn = true, 
  selectedVideoDevice,
  selectedAudioDevice,
  isStreamer,
  isAnonymous = false,
  videoRef: externalVideoRef,
  onMediaError,
  onStreamReady
}: UseWebRTCMediaProps) {
  const [isMuted, setIsMuted] = useState(!isMicrophoneOn);
  const [isVideoHidden, setIsVideoHidden] = useState(!isCameraOn);
  const [streamReady, setStreamReady] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaSetupAttemptRef = useRef<number>(0);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaInitTimestampRef = useRef<number>(Date.now());
  const lastAttemptTimestampRef = useRef<number>(0);
  
  // Use external videoRef if provided, otherwise use internal one
  const videoRef = externalVideoRef || internalVideoRef;
  
  // Helper to set video element reference (for backward compatibility)
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    if (!externalVideoRef) {
      internalVideoRef.current = element;
    }
    
    // If we already have a stream, attach it to the new video element
    if (element && localStreamRef.current) {
      element.srcObject = localStreamRef.current;
      element.muted = true; // Always mute local preview
      
      // Try to play the video
      try {
        element.play().catch(err => {
          logWarn("Could not autoplay video preview", { 
            error: err instanceof Error ? err.message : String(err) 
          } as LogData);
        });
      } catch (err) {
        logWarn("Error playing video", { 
          error: err instanceof Error ? err.message : String(err) 
        } as LogData);
      }
    }
  }, [externalVideoRef]);

  // Safely access the video element, handling nulls properly
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    return videoRef?.current || null;
  }, [videoRef]);

  /**
   * Capture local media with selected devices
   */
  const captureLocalMedia = useCallback(async () => {
    // Skip media capture for anonymous viewers
    if (isAnonymous && !isStreamer) {
      logInfo("Skipping media capture for anonymous viewer");
      setStreamReady(true);
      return null;
    }
    
    // Prevent excessive attempts in short time periods
    const now = Date.now();
    if (now - lastAttemptTimestampRef.current < 2000 && mediaSetupAttemptRef.current > 0) {
      logWarn("Throttling media setup attempts - too many attempts in short period");
      // Wait at least 2 seconds between attempts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    lastAttemptTimestampRef.current = Date.now();
    
    try {
      logInfo("Capturing local media", {
        selectedVideoDevice,
        selectedAudioDevice,
        isStreamer,
        isAnonymous,
        attemptNumber: mediaSetupAttemptRef.current + 1
      });

      // Stop any existing streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            logWarn("Error stopping track", {
              error: e instanceof Error ? e.message : String(e)
            });
          }
        });
        localStreamRef.current = null;
      }

      // Track local media setup attempts to prevent excessive retries
      if (mediaSetupAttemptRef.current >= 3) {
        // Instead of immediately failing, try to continue with audio-only or video-only
        logWarn("Multiple media setup attempts, trying fallback with reduced requirements");

        // First try simple constraints without device IDs
        try {
          logInfo("Attempting simplified constraints fallback");
          const simpleConstraints = {
            video: isCameraOn ? true : false,
            audio: isMicrophoneOn ? true : false
          };
          
          const simpleStream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
          
          logInfo("Simplified constraints fallback successful");
          localStreamRef.current = simpleStream;

          if (getVideoElement()) {
            getVideoElement()!.srcObject = simpleStream;
            getVideoElement()!.muted = true; // Mute local preview
          }

          setStreamReady(true);
          if (onStreamReady) onStreamReady(simpleStream);
          return simpleStream;
        } catch (simpleErr) {
          logWarn("Simplified constraints fallback failed", {
            error: simpleErr instanceof Error ? simpleErr.message : String(simpleErr)
          });
          
          // Attempt audio-only as fallback
          try {
            logInfo("Attempting audio-only fallback");
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });

            logInfo("Audio-only fallback successful");
            setIsVideoHidden(true); // Hide video UI since we don't have video
            localStreamRef.current = audioOnlyStream;

            if (getVideoElement()) {
              getVideoElement()!.srcObject = audioOnlyStream;
              getVideoElement()!.muted = true; // Mute local preview
            }

            setStreamReady(true);
            if (onStreamReady) onStreamReady(audioOnlyStream);
            return audioOnlyStream;
          } catch (audioErr) {
            // Last resort - try to continue without media for debugging purposes
            logError("All media fallbacks failed", {
              error: audioErr instanceof Error ? audioErr.message : String(audioErr)
            } as LogData);

            // If we're a streamer, we need media but can provide a strong error message
            if (isStreamer) {
              // Create an empty stream as last resort (better than nothing)
              const emptyStream = new MediaStream();
              localStreamRef.current = emptyStream;

              if (getVideoElement()) {
                getVideoElement()!.srcObject = emptyStream;
              }

              // Report the error through the callback but don't stop the connection
              if (onMediaError) {
                onMediaError(
                  "setup",
                  "Failed to access any media devices after multiple attempts. Please check your browser settings and ensure camera/microphone permissions are granted."
                );
              }
              
              // For streamers, we still need to report "ready" to allow connection to continue
              // even if it might not be fully functional
              setStreamReady(true);
              return emptyStream;
            } else {
              // For viewers, we can continue without media
              setStreamReady(true);
              return null;
            }
          }
        }
      }

      mediaSetupAttemptRef.current++; // Increment the attempt counter

      // Detect platform for optimal constraints
      const isFirefox = navigator.userAgent.includes("Firefox");
      const isChrome = navigator.userAgent.includes("Chrome");
      const isSafari =
        navigator.userAgent.includes("Safari") &&
        !navigator.userAgent.includes("Chrome");
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
        
      // Check if we're in a loopback connection (localhost)
      const isLikelyLoopback = 
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168.");
      
      // Use optimized constraints for loopback to avoid performance issues
      const videoConstraints = isLikelyLoopback ? {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15, max: 24 }
      } : {
        width: isMobile ? { ideal: 720 } : { ideal: 1280 },
        height: isMobile ? { ideal: 480 } : { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      };

      // Configure constraints based on selected devices and platform
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice
          ? {
              deviceId: { exact: selectedVideoDevice },
              ...videoConstraints
            }
          : isCameraOn ? {
              ...videoConstraints,
              facingMode: "user",
            } : false,
        audio: selectedAudioDevice
          ? {
              deviceId: { exact: selectedAudioDevice },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : isMicrophoneOn ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } : false,
      };
      
      // Add progressive fallback attempts within the initial try
      try {
        // First attempt with full constraints
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Display the local stream in the video element when available
        localStreamRef.current = stream;
            
        if (getVideoElement()) {
          getVideoElement()!.srcObject = stream;
          getVideoElement()!.muted = true; // Always mute local preview
            
          // Try to play the video immediately
          try {
            getVideoElement()!.play().catch(playErr => {
              // This often happens due to autoplay policies
              logWarn("Could not autoplay video preview, user may need to interact", {
                error: playErr instanceof Error ? playErr.message : String(playErr)
              });
            });
          } catch (playErr) {
            logWarn("Error playing video", {
              error: playErr instanceof Error ? playErr.message : String(playErr)
            });
          }
        }
        
        // Set local mute state based on props
        setIsMuted(!isMicrophoneOn);
        setIsVideoHidden(!isCameraOn);
        
        // Apply initial mute state to tracks
        if (!isMicrophoneOn) {
          stream.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
        }
        
        if (!isCameraOn) {
          stream.getVideoTracks().forEach(track => {
            track.enabled = false;
          });
        }
        
        logInfo("Local media captured successfully", {
          hasAudio: stream.getAudioTracks().length > 0,
          hasVideo: stream.getVideoTracks().length > 0,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length
        });
        
        // Reset attempt counter on success
        mediaSetupAttemptRef.current = 0;
        
        setStreamReady(true);
        if (onStreamReady) onStreamReady(stream);
        return stream;
      } catch (err) {
        // First attempt failed, log and try fallback approach
        logWarn("Primary media capture attempt failed, trying fallback approach", {
          error: err instanceof Error ? err.message : String(err),
          constraints
        });
        
        // Try with simpler constraints
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: isCameraOn ? true : false,
          audio: isMicrophoneOn ? true : false
        });
        
        localStreamRef.current = fallbackStream;
        
        if (getVideoElement()) {
          getVideoElement()!.srcObject = fallbackStream;
          getVideoElement()!.muted = true;
        }
        
        logInfo("Fallback media capture succeeded", {
          hasAudio: fallbackStream.getAudioTracks().length > 0,
          hasVideo: fallbackStream.getVideoTracks().length > 0
        });
        
        setStreamReady(true);
        if (onStreamReady) onStreamReady(fallbackStream);
        return fallbackStream;
      }
    } catch (err) {
      // All capture attempts failed
      logError("All media capture attempts failed", {
        error: err instanceof Error ? err.message : String(err),
        attemptsMade: mediaSetupAttemptRef.current
      });
      
      if (onMediaError) {
        onMediaError(
          "capture",
          "Failed to access media devices. Please check your browser permissions.",
          { error: err instanceof Error ? err.message : String(err) }
        );
      }
      
      // If we're not a streamer, we can proceed without media
      if (!isStreamer) {
        setStreamReady(true);
      }
      
      return null;
    }
  }, [
    isCameraOn,
    isMicrophoneOn,
    selectedVideoDevice,
    selectedAudioDevice,
    isStreamer,
    isAnonymous,
    getVideoElement,
    onMediaError,
    onStreamReady,
  ]);

  /**
   * Toggle audio mute state
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      const newMutedState = !prevMuted;
      
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = !newMutedState;
        });
      }
      
      return newMutedState;
    });
  }, []);

  /**
   * Toggle video visibility
   */
  const toggleVideo = useCallback(() => {
    setIsVideoHidden((prevHidden) => {
      const newHiddenState = !prevHidden;
      
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((track) => {
          track.enabled = !newHiddenState;
        });
      }
      
      return newHiddenState;
    });
  }, []);

  // Effect to handle changes to selected devices
  useEffect(() => {
    // Only recapture if we already have a stream and isStreamer is true
    if (localStreamRef.current && isStreamer && streamReady) {
      captureLocalMedia();
    }
  }, [selectedVideoDevice, selectedAudioDevice, isStreamer, captureLocalMedia, streamReady]);

  // Effect to handle explicit control from parent for camera/mic
  useEffect(() => {
    if (localStreamRef.current) {
      // Handle camera state
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const shouldBeEnabled = !isVideoHidden;
        if (videoTracks[0].enabled !== shouldBeEnabled) {
          videoTracks.forEach(track => {
            track.enabled = shouldBeEnabled;
          });
        }
      }
      
      // Handle microphone state
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const shouldBeEnabled = !isMuted;
        if (audioTracks[0].enabled !== shouldBeEnabled) {
          audioTracks.forEach(track => {
            track.enabled = shouldBeEnabled;
          });
        }
      }
    }
  }, [isMuted, isVideoHidden]);

  // Initial media capture for streamer
  useEffect(() => {
    if (isStreamer) {
      captureLocalMedia();
    }
    
    return () => {
      // Stop all tracks when component unmounts
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        localStreamRef.current = null;
      }
    };
  }, [isStreamer, captureLocalMedia]);

  return {
    localStreamRef,
    videoRef,
    setVideoRef,
    isMuted,
    isVideoHidden,
    streamReady,
    captureLocalMedia,
    toggleMute,
    toggleVideo,
  };
} 