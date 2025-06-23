// WebRTC configuration for better cross-browser compatibility
export const webrtcConfig = {
  iceServers: [
    // Google STUN servers (most reliable)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },

    // Alternative STUN servers for redundancy
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle" as RTCBundlePolicy,
  rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
};

// LiveKit room options for better connectivity
export const livekitRoomOptions = {
  // Enable adaptive stream for better cross-browser compatibility
  adaptiveStream: true,
  // Enable dynacast for better bandwidth management
  dynacast: true,
  // Disable experimental web audio mix (can cause issues)
  webAudioMix: false,
  // Enable simulcast for better quality adaptation
  simulcast: true,
};

// LiveKit connect options
export const livekitConnectOptions = {
  // Enable auto-subscribe for all tracks
  autoSubscribe: true,
  // Use our WebRTC configuration
  rtcConfig: webrtcConfig,
  // Set connection timeouts
  maxRetries: 3,
  retryDelayMs: 1000,
};

// Browser detection utility
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;

  if (userAgent.includes("Firefox")) {
    return { name: "Firefox", isFirefox: true };
  } else if (userAgent.includes("Chrome") && !userAgent.includes("Edge")) {
    return { name: "Chrome", isChrome: true };
  } else if (userAgent.includes("Edge")) {
    return { name: "Edge", isEdge: true };
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    return { name: "Safari", isSafari: true };
  }

  return { name: "Unknown", isUnknown: true };
};

// Check WebRTC support
export const checkWebRTCSupport = () => {
  const hasRTCPeerConnection = !!(
    window.RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection
  );

  const hasGetUserMedia = !!(
    navigator.mediaDevices?.getUserMedia ||
    (navigator as any).getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia
  );

  return {
    supported: hasRTCPeerConnection && hasGetUserMedia,
    rtcPeerConnection: hasRTCPeerConnection,
    getUserMedia: hasGetUserMedia,
  };
};

// Audio context helper to handle autoplay restrictions
export const initializeAudioContext = async () => {
  try {
    // Create audio context if it doesn't exist
    if (typeof window !== "undefined" && "AudioContext" in window) {
      const audioContext = new AudioContext();

      // Resume if suspended (required for autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      return audioContext;
    }
  } catch (error) {
    console.warn("AudioContext initialization failed:", error);
  }

  return null;
};
