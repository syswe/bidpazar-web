/**
 * Enhanced utilities for detecting and handling loopback connections
 * 
 * This file provides improved detection and handling for localhost connections,
 * addressing WebRTC connectivity issues in development environments.
 */

// Local logging functions
interface LogContext {
  [key: string]: any;
}

function logInfo(message: string, context?: LogContext) {
  console.info(`[LoopbackUtils] ${message}`, context || '');
}

function logError(message: string, context?: LogContext) {
  console.error(`[LoopbackUtils] ${message}`, context || '');
}

function logWarn(message: string, context?: LogContext) {
  console.warn(`[LoopbackUtils] ${message}`, context || '');
}

function logDebug(message: string, context?: LogContext) {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[LoopbackUtils] ${message}`, context || '');
  }
}

interface WebRTCInitResult {
  initialized: boolean;
  errorMessage?: string;
  devices: {
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
  };
}

/**
 * Check if a given address is a loopback address
 */
export const isLoopbackAddress = (address?: string): boolean => {
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
};

/**
 * Detect loopback connections with high accuracy
 */
export const isLikelyLoopbackConnection = (): boolean => {
  // Only run in browser environment
  if (typeof window === "undefined") return false;
  
  // Check hostname
  const hostname = window.location.hostname;
  if (isLoopbackAddress(hostname)) return true;

  // Check for localhost variations
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname === "[::1]" ||
    hostname.includes(".local")
  ) {
    return true;
  }

  return false;
};

/**
 * Get optimized configuration for loopback connections
 */
export const getLoopbackOptimizedConfig = () => {
  return {
    iceTransportPolicy: "all" as RTCIceTransportPolicy,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    mediaConstraints: {
      // Reduced quality for loopback connections to minimize resource usage
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15, max: 24 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    },
    // Prevent infinite reconnection loops
    connectionTimeout: 15000, 
    skipIceGatheringTest: true
  };
};

/**
 * Check if WebRTC is properly supported by the browser
 */
export const checkWebRTCSupport = (): { 
  supported: boolean; 
  issues: string[]
} => {
  const issues: string[] = [];
  
  // Basic WebRTC API check
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    issues.push("WebRTC API is not supported in this browser");
    return { supported: false, issues };
  }
  
  // RTCPeerConnection check
  if (!window.RTCPeerConnection) {
    issues.push("RTCPeerConnection is not supported");
    return { supported: false, issues };
  }
  
  // Check if permissions API is available
  if (!navigator.permissions) {
    issues.push("Permissions API not fully supported (may affect device detection)");
  }
  
  // Detect potential browser-specific issues
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes("firefox") && parseInt(userAgent.split("firefox/")[1]) < 80) {
    issues.push("Firefox version may have WebRTC compatibility issues. Please update.");
  }
  
  if (userAgent.includes("edge") && !userAgent.includes("edg/")) {
    issues.push("Legacy Edge browser has limited WebRTC support. Consider using Edge Chromium.");
  }
  
  return {
    supported: true,
    issues
  };
};

/**
 * Initialize WebRTC environment with optimizations for the detected context
 */
export async function initializeOptimizedWebRTC(): Promise<WebRTCInitResult> {
  try {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API not supported');
    }

    // Initial enumeration (might not have labels yet)
    let devices = await navigator.mediaDevices.enumerateDevices();
    let videoDevices = devices.filter(d => d.kind === 'videoinput');
    let audioDevices = devices.filter(d => d.kind === 'audioinput');

    // Request minimal permissions to ensure we have access and to populate device labels
    // Only request what's available to avoid errors if no video/audio devices exist
    const hasVideo = videoDevices.length > 0;
    const hasAudio = audioDevices.length > 0;

    if (!hasVideo && !hasAudio) {
      // This case might already be caught by an earlier check in useMedia, 
      // but good to have a specific error here if no devices are found at all before permission prompt.
      logWarn('No media devices (video or audio) were found even before attempting to get user media.');
      // We might still want to return initialized: true but with empty devices if the API is supported.
      // For now, let's proceed to see if getUserMedia clarifies or if it fails.
    }
    
    const constraints: MediaStreamConstraints = {};
    if (hasVideo) constraints.video = { width: 1, height: 1 }; // Minimal video constraint
    if (hasAudio) constraints.audio = { echoCancellation: true }; // Minimal audio constraint

    if (!constraints.video && !constraints.audio) {
        // This means no devices were found by the initial enumerateDevices. Browser/system might have no media inputs.
        throw new Error("No video or audio input devices found on this system.");
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Stop the test stream immediately as it's only for permission and device label population
    stream.getTracks().forEach(track => track.stop());

    // IMPORTANT: Re-enumerate devices AFTER getUserMedia to get updated list with labels
    const finalDevices = await navigator.mediaDevices.enumerateDevices();
    const finalVideoDevices = finalDevices.filter(d => d.kind === 'videoinput');
    const finalAudioDevices = finalDevices.filter(d => d.kind === 'audioinput');
    
    logDebug('Final video devices after getUserMedia:', finalVideoDevices.map(d => ({ id: d.deviceId, label: d.label, kind: d.kind })));
    logDebug('Final audio devices after getUserMedia:', finalAudioDevices.map(d => ({ id: d.deviceId, label: d.label, kind: d.kind })));

    return {
      initialized: true,
      devices: {
        video: finalVideoDevices,
        audio: finalAudioDevices
      }
    };

  } catch (err) {
    logError('WebRTC initialization failed', { error: err instanceof Error ? err.message : String(err) });
    
    return {
      initialized: false,
      errorMessage: err instanceof Error ? err.message : 'Failed to initialize WebRTC',
      devices: {
        video: [],
        audio: []
      }
    };
  }
} 