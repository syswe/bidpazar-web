import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { initializeOptimizedWebRTC, isLikelyLoopbackConnection } from '../utils/loopbackUtils';
import { v4 as uuidv4 } from 'uuid';
import { MediaStateManager, MediaState } from '../utils/mediaStateManager';
import { logger } from '@/lib/logger';

// Create a static tracker to prevent duplicate initialization across component remounts
// This is important for development mode with React.StrictMode or when components remount
let mediaInitializationCounter = 0;
let lastMediaInitTime = 0;
// Add a global registry to prevent parallel initializations for the same stream
const activeInitializations = new Set<string>();
// Add global state tracking to maintain consistency across remounts
const globalMediaState = new Map<string, { isCameraOn: boolean; isMicrophoneOn: boolean }>();

// Add a lock mechanism for global state access
const stateLock = new Map<string, boolean>();

const acquireStateLock = (instanceId: string): boolean => {
  if (stateLock.get(instanceId)) return false;
  stateLock.set(instanceId, true);
  return true;
};

const releaseStateLock = (instanceId: string) => {
  stateLock.delete(instanceId);
};

interface LocalMediaState {
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
}

interface UseMediaProps {
  onMediaError?: (errorType: string, errorMessage: string, details?: any) => void;
  onMediaReady?: (stream: MediaStream) => void;
  initialState?: {
    isCameraOn?: boolean;
    isMicrophoneOn?: boolean;
    selectedVideoId?: string;
    selectedAudioId?: string;
  };
  isStreamer: boolean;
}

/**
 * Hook for managing media devices (camera and microphone)
 * 
 * Handles device detection, initialization, and state management with
 * improved error handling and recovery
 */
export function useMedia({
  onMediaError,
  onMediaReady,
  initialState = {},
  isStreamer
}: UseMediaProps) {
  const instanceId = useRef(`media-${uuidv4().slice(0, 8)}`).current;
  const [state, setState] = useState<LocalMediaState>({
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
    isInitialized: false
  });
  
  const mediaStateManagerRef = useRef<MediaStateManager | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  // Initialize media state manager
  useEffect(() => {
    const initialState = {
      isCameraOn: state.isCameraOn,
      isMicrophoneOn: state.isMicrophoneOn,
      isInitialized: state.isInitialized,
      error: state.error,
      lastInitializationAttempt: 0,
      retryCount: 0
    } as MediaState;

    const onStateUpdate = (newState: MediaState) => {
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
  }, [instanceId, state.isCameraOn, state.isMicrophoneOn, state.isInitialized, state.error]);

  // Track number of initialization attempts to prevent endless loops
  const attemptCountRef = useRef<number>(0);
  const maxAttempts = 2; // Reduced from 3 to prevent excessive retries
  const hasInitializedRef = useRef<boolean>(false);
  const isLoopbackRef = useRef<boolean>(false);
  
  // Debug initialization to help identify duplicate hooks
  useEffect(() => {
    mediaInitializationCounter++;
    const now = Date.now();
    const timeSinceLastInit = now - lastMediaInitTime;
    lastMediaInitTime = now;
    
    console.debug(`[useMedia-${instanceId}] Hook initialized (total count: ${mediaInitializationCounter}, time since last: ${timeSinceLastInit}ms)`);
    
    return () => {
      console.debug(`[useMedia-${instanceId}] Hook unmounting`);
      // Remove from active initializations on unmount
      activeInitializations.delete(instanceId);
    };
  }, []);
  
  // Clean up media stream
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      console.debug(`[useMedia-${instanceId}] Cleaning up media stream with ${streamRef.current.getTracks().length} tracks`);
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[useMedia] Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Initialize media stream
  const initializeMediaStream = useCallback(async (forceReinitialize = false) => {
    // Don't initialize for non-streamers to conserve resources
    if (!isStreamer && hasInitializedRef.current && !forceReinitialize) {
      return;
    }
    
    // Check if this instance is already initializing
    if (activeInitializations.has(instanceId) && !forceReinitialize) {
      console.debug(`[useMedia-${instanceId}] Initialization already in progress, skipping`);
      return;
    }

    // Acquire state lock
    if (!acquireStateLock(instanceId)) {
      console.debug(`[useMedia-${instanceId}] Another initialization is in progress, skipping`);
      return;
    }

    try {
      // Add guard for excessive initialization attempts
      const now = Date.now();
      if (now - lastMediaInitTime < 1000 && attemptCountRef.current > 0 && !forceReinitialize) {
        console.warn(`[useMedia-${instanceId}] Throttling media initialization - too frequent (${now - lastMediaInitTime}ms)`);
        return;
      }
      lastMediaInitTime = now;
      
      // Prevent excessive initialization attempts
      if (attemptCountRef.current >= maxAttempts && !forceReinitialize) {
        console.warn(`[useMedia-${instanceId}] Max media initialization attempts (${maxAttempts}) reached`);
        if (onMediaError) {
          onMediaError(
            'initialization',
            `Failed to initialize media after ${maxAttempts} attempts`,
            { attemptCount: attemptCountRef.current }
          );
        }
        return;
      }

      // Mark this instance as initializing
      activeInitializations.add(instanceId);
      attemptCountRef.current++;

      // Set loading state
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current state
      const currentState = state;
      
      // If streamers need at least one media type
      if (isStreamer && !currentState.isCameraOn && !currentState.isMicrophoneOn) {
        throw new Error('At least one media type (video or audio) is required for streaming');
      }
      
      // Cleanup existing stream
      cleanupStream();
      
      // Check if this is a loopback connection
      isLoopbackRef.current = isLikelyLoopbackConnection();
      
      // Initialize WebRTC environment and get devices
      const webrtcInit = await initializeOptimizedWebRTC();
      
      // If initialization failed
      if (!webrtcInit.initialized) {
        throw new Error(webrtcInit.errorMessage || 'Failed to initialize WebRTC environment');
      }
      
      // Update device lists first
      setState(prev => ({
        ...prev,
        devices: webrtcInit.devices,
        isLoading: false
      }));

      // Get media constraints
      const constraints: MediaStreamConstraints = {
        video: currentState.isCameraOn ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false,
        audio: currentState.isMicrophoneOn ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Update state and refs
      streamRef.current = stream;
      hasInitializedRef.current = true;
      
      // Update state with stream
      setState(prev => ({
        ...prev,
        stream,
        isInitialized: true,
        isLoading: false,
        error: null
      }));

      // Notify success
      onMediaReady?.(stream);
      
    } catch (error) {
      console.error(`[useMedia-${instanceId}] Media initialization failed:`, error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize media',
        isInitialized: false
      }));

      if (onMediaError) {
        onMediaError(
          'initialization',
          error instanceof Error ? error.message : 'Failed to initialize media',
          { error }
        );
      }
    } finally {
      // Cleanup
      activeInitializations.delete(instanceId);
      releaseStateLock(instanceId);
    }
  }, [state.isCameraOn, state.isMicrophoneOn, isStreamer, onMediaError, onMediaReady, cleanupStream]);

  // Update camera toggle to persist state globally
  const toggleCamera = useCallback(() => {
    const manager = mediaStateManagerRef.current;
    if (!manager) return;

    const newState = !state.isCameraOn;
    manager.setCameraEnabled(newState);
    
    // Reinitialize media if needed
    if (newState && !streamRef.current?.getVideoTracks().length) {
      initializeMediaStream(true);
    } else if (!newState && streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => track.stop());
    }
  }, [state.isCameraOn, initializeMediaStream]);

  // Handle microphone toggle with global state persistence
  const toggleMicrophone = useCallback(() => {
    const manager = mediaStateManagerRef.current;
    if (!manager) return;

    const newState = !state.isMicrophoneOn;
    manager.setMicrophoneEnabled(newState);
    
    // Reinitialize media if needed
    if (newState && !streamRef.current?.getAudioTracks().length) {
      initializeMediaStream(true);
    } else if (!newState && streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => track.stop());
    }
  }, [state.isMicrophoneOn, initializeMediaStream]);

  // Handle device selection
  const selectDevice = useCallback((type: 'video' | 'audio', deviceId: string) => {
    // Check if device exists in our list
    const deviceExists = type === 'video' 
      ? state.devices.video.some(d => d.deviceId === deviceId)
      : state.devices.audio.some(d => d.deviceId === deviceId);
    
    if (!deviceId || deviceId === '') {
      console.warn(`[useMedia-${instanceId}] Empty ${type} device ID provided`);
      // Set state to indicate device is disabled
      setState(prev => ({
        ...prev,
        [type === 'video' ? 'isCameraOn' : 'isMicrophoneOn']: false,
        selectedDevices: {
          ...prev.selectedDevices,
          [type === 'video' ? 'videoId' : 'audioId']: null
        }
      }));
      return;
    }
    
    if (!deviceExists && deviceId !== '') {
      console.warn(`[useMedia-${instanceId}] Selected ${type} device not found in device list: ${deviceId}`);
    }
    
    // Update the device selection
    setState(prev => ({
      ...prev,
      // Ensure the corresponding input is enabled when selecting a device
      [type === 'video' ? 'isCameraOn' : 'isMicrophoneOn']: true,
      selectedDevices: {
        ...prev.selectedDevices,
        [type === 'video' ? 'videoId' : 'audioId']: deviceId
      }
    }));
    
    // Reinitialize the stream with the new device
    initializeMediaStream(true);
    
    // Log device selection
    console.debug(`[useMedia-${instanceId}] Selected ${type} device: ${deviceId}`);
  }, [state.devices, initializeMediaStream]);

  // Initialize media on mount and when selection changes
  useEffect(() => {
    // Use a one-time flag with a short delay to handle React.StrictMode double-mounting
    const strictModeDelay = process.env.NODE_ENV === 'development' ? 100 : 0;
    
    console.debug(`[useMedia-${instanceId}] Mount effect, hasInitialized=${hasInitializedRef.current}, attempts=${attemptCountRef.current}`);
    
    // Use a timeout to prevent double initialization in StrictMode
    const initTimeout = setTimeout(() => {
      if (!hasInitializedRef.current || attemptCountRef.current === 0) {
        initializeMediaStream();
      }
    }, strictModeDelay);
    
    // Cleanup on unmount
    return () => {
      clearTimeout(initTimeout);
      cleanupStream();
    };
  }, [initializeMediaStream, cleanupStream]);

  // Monitor for device changes
  useEffect(() => {
    const handleDeviceChange = async () => {
      console.log(`[useMedia-${instanceId}] Media devices changed, updating...`);
      
      try {
        // Get updated device list without reinitializing stream
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        setState(prev => ({
          ...prev,
          devices: {
            video: devices.filter(d => d.kind === 'videoinput'),
            audio: devices.filter(d => d.kind === 'audioinput')
          }
        }));
      } catch (error) {
        console.error(`[useMedia-${instanceId}] Error updating device list:`, error);
      }
    };

    // Add device change listener
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  // Store the state on unmount
  useEffect(() => {
    return () => {
      // Save current state when unmounting
      globalMediaState.set(instanceId, {
        isCameraOn: state.isCameraOn,
        isMicrophoneOn: state.isMicrophoneOn
      });
    };
  }, [instanceId, state.isCameraOn, state.isMicrophoneOn]);

  // Add reinitialize function
  const reinitialize = useCallback(() => {
    console.debug(`[useMedia-${instanceId}] Reinitializing media stream`);
    hasInitializedRef.current = false;
    initializeMediaStream(true);
  }, [initializeMediaStream]);

  // Return state and actions
  return {
    isLoading: state.isLoading,
    error: state.error,
    isCameraOn: state.isCameraOn,
    isMicrophoneOn: state.isMicrophoneOn,
    devices: state.devices,
    selectedDevices: state.selectedDevices,
    stream: state.stream,
    toggleCamera,
    toggleMicrophone,
    selectDevice,
    reinitialize
  };
} 