/**
 * MediaSoup Fix Utility
 * 
 * This script provides utilities to diagnose and fix MediaSoup initialization issues
 * in development environments. It helps troubleshoot common issues with WebRTC
 * connections and MediaSoup worker initialization.
 */

export interface DiagnosticResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

/**
 * Detect environment-specific issues related to WebRTC connections
 */
export function detectEnvironmentIssues(): DiagnosticResult {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        success: false,
        message: 'Not running in a browser environment'
      };
    }

    // Check for WebRTC support
    const hasRTCPeerConnection = typeof window.RTCPeerConnection !== 'undefined';
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (!hasRTCPeerConnection || !hasGetUserMedia) {
      return {
        success: false,
        message: 'WebRTC not fully supported in this browser',
        details: {
          hasRTCPeerConnection,
          hasGetUserMedia
        }
      };
    }

    // Check for localhost/loopback connection
    const isLoopback = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.');

    // Browser detection for compatibility warnings
    const userAgent = navigator.userAgent;
    const isFirefox = userAgent.indexOf('Firefox') !== -1;
    const isChrome = userAgent.indexOf('Chrome') !== -1 && userAgent.indexOf('Edge') === -1;
    const isSafari = userAgent.indexOf('Safari') !== -1 && userAgent.indexOf('Chrome') === -1;
    const isEdge = userAgent.indexOf('Edg') !== -1;

    // Browser-specific warnings
    if (isSafari) {
      return {
        success: true,
        message: 'WebRTC detected, but Safari has known WebRTC limitations',
        details: {
          browser: 'Safari',
          isLoopback,
          recommendation: 'Consider using Chrome or Firefox for better WebRTC support'
        }
      };
    }

    // For loopback connections, provide potential solutions
    if (isLoopback) {
      return {
        success: true,
        message: 'Local development environment detected',
        details: {
          isLoopback: true,
          browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'Unknown',
          suggestions: [
            'If experiencing connection issues, try using 127.0.0.1 instead of localhost',
            'Disable Chrome Web Security for local testing (ONLY in a dedicated testing profile)',
            'Ensure your .env file has WEBRTC_SERVER and TURN_SERVER configurations'
          ]
        }
      };
    }

    // All checks passed
    return {
      success: true,
      message: 'WebRTC environment looks healthy',
      details: {
        browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'Unknown',
        isLoopback
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error checking WebRTC environment',
      details: { error: String(error) }
    };
  }
}

/**
 * Check MediaSoup initialization status on the client side
 */
export function checkMediasoupClientStatus(): DiagnosticResult {
  try {
    // Check if MediaSoup client is available
    let mediasoupClient;
    try {
      // Using dynamic import since this is client-side only
      mediasoupClient = require('mediasoup-client');
    } catch (error) {
      return {
        success: false,
        message: 'mediasoup-client module not found',
        details: { error: String(error) }
      };
    }

    if (!mediasoupClient) {
      return {
        success: false,
        message: 'mediasoup-client could not be imported'
      };
    }

    // Check if Device constructor is available
    if (!mediasoupClient.Device) {
      return {
        success: false,
        message: 'mediasoup-client.Device constructor not found'
      };
    }

    // Create a test device (will not actually load)
    try {
      const testDevice = new mediasoupClient.Device();
      return {
        success: true,
        message: 'mediasoup-client successfully imported',
        details: {
          version: mediasoupClient.version || 'unknown'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creating MediaSoup Device',
        details: { error: String(error) }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error checking MediaSoup client status',
      details: { error: String(error) }
    };
  }
}

/**
 * Optimize WebRTC settings for different environments
 */
export function getOptimizedRtcConfiguration(isLoopback = false): RTCConfiguration {
  // Base configuration
  const baseConfig: RTCConfiguration = {
    iceServers: [
      {
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
      }
    ],
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10
  };

  // Get environment-specific TURN configurations
  if (typeof window !== 'undefined') {
    const turnServer = process.env.TURN_SERVER_URL || '';
    const turnUsername = process.env.TURN_USERNAME || '';
    const turnPassword = process.env.TURN_PASSWORD || '';
    
    // Add TURN server if credentials are available
    if (turnServer && turnUsername && turnPassword && !isLoopback) {
      baseConfig.iceServers?.push({
        urls: turnServer,
        username: turnUsername,
        credential: turnPassword
      });
    }
  }

  // For loopback connections, use simpler configuration
  if (isLoopback) {
    return {
      ...baseConfig,
      iceCandidatePoolSize: 0, // Reduce resources for local connections
      iceTransportPolicy: 'all'
    };
  }

  return baseConfig;
}

/**
 * Get optimized media constraints for different environments
 */
export function getOptimizedMediaConstraints(options: {
  isCameraOn: boolean;
  isMicrophoneOn: boolean;
  isLoopback?: boolean;
  selectedVideoDevice?: string;
  selectedAudioDevice?: string;
  isMobile?: boolean;
}): MediaStreamConstraints {
  const { 
    isCameraOn, 
    isMicrophoneOn, 
    isLoopback = false,
    selectedVideoDevice,
    selectedAudioDevice,
    isMobile = false
  } = options;

  // For loopback connections (local development), reduce quality to avoid performance issues
  if (isLoopback) {
    return {
      video: isCameraOn ? {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15, max: 24 },
        ...(selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : {})
      } : false,
      audio: isMicrophoneOn ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : {})
      } : false
    };
  }

  // Mobile devices should use lower resolution
  if (isMobile) {
    return {
      video: isCameraOn ? {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 },
        facingMode: 'user',
        ...(selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : {})
      } : false,
      audio: isMicrophoneOn ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : {})
      } : false
    };
  }
  
  // Desktop devices use higher quality
  return {
    video: isCameraOn ? {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      ...(selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : {})
    } : false,
    audio: isMicrophoneOn ? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : {})
    } : false
  };
}

/**
 * Detect if running in a loopback connection (localhost)
 */
export function isLoopbackConnection(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.')
  );
}

/**
 * Generates troubleshooting instructions based on diagnostic results
 */
export function getTroubleshootingSteps(diagnostics: DiagnosticResult[]): string[] {
  const steps: string[] = [];
  const hasWebRTCIssue = diagnostics.some(d => !d.success && d.message.includes('WebRTC'));
  const hasMediasoupIssue = diagnostics.some(d => !d.success && d.message.includes('mediasoup'));
  const isLoopback = diagnostics.some(d => d.details?.isLoopback);
  
  if (hasWebRTCIssue) {
    steps.push('Try using Chrome or Firefox for best WebRTC compatibility');
    steps.push('Ensure camera and microphone permissions are granted to the site');
  }
  
  if (hasMediasoupIssue) {
    steps.push('Check that MediaSoup packages are properly installed (npm install mediasoup mediasoup-client)');
    steps.push('Verify your server.js is correctly initializing the MediaSoup worker');
  }
  
  if (isLoopback) {
    steps.push('For local development, try accessing via 127.0.0.1 instead of localhost');
    steps.push('Make sure your environment has STUN/TURN server configurations');
  }
  
  if (steps.length === 0) {
    steps.push('No specific issues detected. If problems persist, try clearing browser cache and cookies');
  }
  
  return steps;
} 