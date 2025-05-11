import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { MediaStateManager } from '../utils/mediaStateManager';
import { initializeOptimizedWebRTC, isLikelyLoopbackConnection } from '../utils/loopbackUtils';

// Local logging functions
interface LogContext {
  [key: string]: any;
}

function logInfo(message: string, context?: LogContext) {
  console.info(`[MediaManager] ${message}`, context || '');
}

function logError(message: string, context?: LogContext) {
  console.error(`[MediaManager] ${message}`, context || '');
}

function logWarn(message: string, context?: LogContext) {
  console.warn(`[MediaManager] ${message}`, context || '');
}

function logDebug(message: string, context?: LogContext) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[MediaManager] ${message}`, context || '');
  }
}

interface MediaManagerState {
  isCameraOn: boolean;
  isMicrophoneOn: boolean;
  isLoading: boolean;
  error: string | null;
  devices: {
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
  };
  selectedDevices: {
    videoId: string | null;
    audioId: string | null;
  };
  stream: MediaStream | null;
  isInitialized: boolean;
  isMuted: boolean;
  isVideoHidden: boolean;
  streamReady: boolean;
}

interface UseMediaManagerProps {
  isStreamer: boolean;
  isAnonymous?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  initialState?: {
    isCameraOn?: boolean;
    isMicrophoneOn?: boolean;
    selectedVideoId?: string;
    selectedAudioId?: string;
  };
  onMediaError?: (errorType: string, errorMessage: string, details?: any) => void;
  onMediaReady?: (stream: MediaStream) => void;
}

// Global state to prevent duplicate initialization
const activeInitializations = new Set<string>();
const stateLock = new Map<string, boolean>();

export function useMediaManager({
  isStreamer,
  isAnonymous = false,
  videoRef: externalVideoRef,
  initialState = {},
  onMediaError,
  onMediaReady
}: UseMediaManagerProps) {
  const instanceId = useRef(`media-${uuidv4().slice(0, 8)}`).current;
  const [state, setState] = useState<MediaManagerState>({
    isCameraOn: initialState.isCameraOn ?? true,
    isMicrophoneOn: initialState.isMicrophoneOn ?? true,
    isLoading: true,
    error: null,
    devices: {
      video: [],
      audio: []
    },
    selectedDevices: {
      videoId: initialState.selectedVideoId ?? null,
      audioId: initialState.selectedAudioId ?? null
    },
    stream: null,
    isInitialized: false,
    isMuted: !initialState.isMicrophoneOn,
    isVideoHidden: !initialState.isCameraOn,
    streamReady: false
  });

  const mediaStateManagerRef = useRef<MediaStateManager | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const attemptCountRef = useRef<number>(0);
  const maxAttempts = 3;
  const hasInitializedRef = useRef<boolean>(false);
  const isLoopbackRef = useRef<boolean>(false);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastAttemptTimestampRef = useRef<number>(0);

  // Use external videoRef if provided, otherwise use internal one
  const videoRef = externalVideoRef || internalVideoRef;

  // Initialize media state manager
  useEffect(() => {
    const initialState = {
      isCameraOn: state.isCameraOn,
      isMicrophoneOn: state.isMicrophoneOn,
      isInitialized: state.isInitialized,
      error: state.error,
      lastInitializationAttempt: 0,
      retryCount: 0
    };

    const onStateUpdate = (newState: any) => {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isCameraOn: newState.isCameraOn,
          isMicrophoneOn: newState.isMicrophoneOn,
          isInitialized: newState.isInitialized,
          error: newState.error ?? null
        }));
      }
    };

    mediaStateManagerRef.current = new MediaStateManager(instanceId, initialState, onStateUpdate);

    return () => {
      mountedRef.current = false;
      mediaStateManagerRef.current?.cleanup();
    };
  }, [instanceId]);

  // Helper to set video element reference
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    if (!externalVideoRef) {
      internalVideoRef.current = element;
    }
    
    if (element && streamRef.current) {
      element.srcObject = streamRef.current;
      element.muted = true;
      
      try {
        element.play().catch(err => {
          logWarn("Could not autoplay video preview", { error: err.message });
        });
      } catch (err) {
        logWarn("Error playing video", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }, [externalVideoRef]);

  // Safely access video element
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    return videoRef?.current || null;
  }, [videoRef]);

  // Clean up media stream
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          logWarn("Error stopping track", { error: e instanceof Error ? e.message : String(e) });
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Initialize or update media stream
  const initializeMediaStream = useCallback(async (forceReinitialize = false) => {
    // Skip for non-streamers unless forced
    if (!isStreamer && hasInitializedRef.current && !forceReinitialize) {
      return;
    }

    // Skip for anonymous viewers
    if (isAnonymous && !isStreamer) {
      logInfo("Skipping media capture for anonymous viewer");
      setState(prev => ({ ...prev, streamReady: true }));
      return null;
    }

    // Prevent excessive attempts
    const now = Date.now();
    if (now - lastAttemptTimestampRef.current < 2000 && attemptCountRef.current > 0 && !forceReinitialize) {
      logWarn("Throttling media setup attempts - too frequent");
      return;
    }
    lastAttemptTimestampRef.current = now;

    // Check attempt limits
    if (attemptCountRef.current >= maxAttempts && !forceReinitialize) {
      logWarn(`Max media initialization attempts (${maxAttempts}) reached`);
      if (onMediaError) {
        onMediaError(
          'initialization',
          `Failed to initialize media after ${maxAttempts} attempts`,
          { attemptCount: attemptCountRef.current }
        );
      }
      return;
    }

    try {
      // Set loading state
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      attemptCountRef.current++;

      // Cleanup existing stream
      cleanupStream();

      // Check for loopback
      isLoopbackRef.current = isLikelyLoopbackConnection();

      // Initialize WebRTC environment
      const webrtcInit = await initializeOptimizedWebRTC();
      if (!webrtcInit.initialized) {
        throw new Error(webrtcInit.errorMessage || 'Failed to initialize WebRTC environment');
      }

      // Update device lists
      setState(prev => ({
        ...prev,
        devices: webrtcInit.devices,
        isLoading: false
      }));

      // Get media constraints
      const constraints = getMediaConstraints();

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Update state and refs
      streamRef.current = stream;
      hasInitializedRef.current = true;
      
      setState(prev => ({
        ...prev,
        stream,
        isInitialized: true,
        isLoading: false,
        error: null,
        streamReady: true
      }));

      // Attach to video element if available
      const videoElement = getVideoElement();
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
      }

      // Notify success
      onMediaReady?.(stream);
      return stream;

    } catch (err) {
      logError("Media initialization failed", { error: err instanceof Error ? err.message : String(err) });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to initialize media',
        isInitialized: false
      }));

      if (onMediaError) {
        onMediaError(
          'initialization',
          err instanceof Error ? err.message : 'Failed to initialize media',
          { error: err }
        );
      }

      return null;
    }
  }, [
    isStreamer,
    isAnonymous,
    onMediaError,
    onMediaReady,
    cleanupStream,
    getVideoElement
  ]);

  // Get optimized media constraints
  const getMediaConstraints = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    const videoConstraints = isLoopbackRef.current ? {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15, max: 24 }
    } : {
      width: isMobile ? { ideal: 720 } : { ideal: 1280 },
      height: isMobile ? { ideal: 480 } : { ideal: 720 },
      frameRate: { ideal: 30, max: 30 }
    };

    return {
      video: state.selectedDevices.videoId
        ? {
            deviceId: { exact: state.selectedDevices.videoId },
            ...videoConstraints
          }
        : state.isCameraOn ? {
            ...videoConstraints,
            facingMode: "user",
          } : false,
      audio: state.selectedDevices.audioId
        ? {
            deviceId: { exact: state.selectedDevices.audioId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : state.isMicrophoneOn ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } : false,
    };
  }, [state.selectedDevices, state.isCameraOn, state.isMicrophoneOn]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    const manager = mediaStateManagerRef.current;
    if (!manager) return;

    const newState = !state.isCameraOn;
    manager.setCameraEnabled(newState);
    
    setState(prev => ({
      ...prev,
      isCameraOn: newState,
      isVideoHidden: !newState
    }));

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = newState;
      });
    }
  }, [state.isCameraOn]);

  // Toggle microphone
  const toggleMicrophone = useCallback(() => {
    const manager = mediaStateManagerRef.current;
    if (!manager) return;

    const newState = !state.isMicrophoneOn;
    manager.setMicrophoneEnabled(newState);
    
    setState(prev => ({
      ...prev,
      isMicrophoneOn: newState,
      isMuted: !newState
    }));

    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = newState;
      });
    }
  }, [state.isMicrophoneOn]);

  // Select device
  const selectDevice = useCallback((type: 'video' | 'audio', deviceId: string) => {
    setState(prev => ({
      ...prev,
      selectedDevices: {
        ...prev.selectedDevices,
        [type === 'video' ? 'videoId' : 'audioId']: deviceId
      },
      [type === 'video' ? 'isCameraOn' : 'isMicrophoneOn']: true
    }));

    initializeMediaStream(true);
  }, [initializeMediaStream]);

  // Initialize on mount
  useEffect(() => {
    if (isStreamer) {
      initializeMediaStream();
    }
    
    return () => {
      cleanupStream();
    };
  }, [isStreamer, initializeMediaStream, cleanupStream]);

  // Monitor device changes
  useEffect(() => {
    const handleDeviceChange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        setState(prev => ({
          ...prev,
          devices: {
            video: devices.filter(d => d.kind === 'videoinput'),
            audio: devices.filter(d => d.kind === 'audioinput')
          }
        }));

        // Check if selected devices still exist
        const videoExists = devices.some(
          d => d.kind === 'videoinput' && d.deviceId === state.selectedDevices.videoId
        );
        
        const audioExists = devices.some(
          d => d.kind === 'audioinput' && d.deviceId === state.selectedDevices.audioId
        );

        if ((state.selectedDevices.videoId && !videoExists) || 
            (state.selectedDevices.audioId && !audioExists)) {
          initializeMediaStream(true);
        }
      } catch (err) {
        logError("Error handling device change", { error: err instanceof Error ? err.message : String(err) });
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [state.selectedDevices, initializeMediaStream]);

  return {
    ...state,
    videoRef,
    setVideoRef,
    toggleCamera,
    toggleMicrophone,
    selectDevice,
    reinitialize: () => initializeMediaStream(true)
  };
} 