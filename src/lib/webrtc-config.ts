// WebRTC configuration for better cross-browser compatibility
// Dynamically add TURN server from environment variables (if provided)
const envTurnUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL;
const envTurnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
const envTurnPassword = process.env.NEXT_PUBLIC_TURN_PASSWORD;

const dynamicIceServers: RTCIceServer[] = [];

if (envTurnUrl) {
  dynamicIceServers.push({
    urls: envTurnUrl.split(","),
    ...(envTurnUsername ? { username: envTurnUsername } : {}),
    ...(envTurnPassword ? { credential: envTurnPassword } : {}),
  });
}

export const webrtcConfig = {
  iceServers: [
    ...dynamicIceServers,
    // Google STUN servers (most reliable) - multiple for redundancy
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },

    // Alternative STUN servers for better connectivity
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun.services.mozilla.com:3478" },
    
    // More public STUN servers for fallback
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "stun:openrelay.metered.ca:80" },
  ],
  iceCandidatePoolSize: 30, // Increased for better connectivity
  bundlePolicy: "max-bundle" as RTCBundlePolicy,
  rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
  iceTransportPolicy: "all" as RTCIceTransportPolicy, // Allow both UDP and TCP
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
  // Audio only mode for better initial connectivity
  audioOnly: false,
  // Video resolution constraints for better performance
  videoCaptureDefaults: {
    resolution: {
      width: 1280,
      height: 720,
      frameRate: 30,
    },
  },
};

// LiveKit connect options with aggressive retry and timeout settings
export const livekitConnectOptions = {
  // Enable auto-subscribe for all tracks
  autoSubscribe: true,
  // NOTE: Do NOT pass a custom rtcConfig here; LiveKit server sends optimal
  // STUN/TURN list (including temporary TURN credentials). Overriding it
  // breaks connectivity.

  // Aggressive connection settings
  maxRetries: 10,
  retryDelayMs: 500,
  publishDefaults: {
    audioPreset: "music",
    videoCodec: "vp8",
    backupCodec: {
      codec: "h264",
    },
  },
  connectTimeout: 15000,
};

// Browser detection and compatibility checking
export function getBrowserInfo() {
  if (typeof window === "undefined") return { name: "Unknown", version: "0" };
  
  const userAgent = window.navigator.userAgent;
  let name = "Unknown";
  let version = "0";
  let isFirefox = false;
  let isChrome = false;
  let isSafari = false;
  let isEdge = false;

  if (userAgent.includes("Firefox")) {
    name = "Firefox";
    isFirefox = true;
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : "0";
  } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    name = "Chrome";
    isChrome = true;
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : "0";
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    name = "Safari";
    isSafari = true;
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : "0";
  } else if (userAgent.includes("Edg")) {
    name = "Edge";
    isEdge = true;
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match ? match[1] : "0";
  }

  return { name, version, isFirefox, isChrome, isSafari, isEdge };
}

// WebRTC support detection with detailed capabilities
export function checkWebRTCSupport() {
  if (typeof window === "undefined") {
    return { supported: false, features: [] };
  }

  const features = [];
  let supported = true;

  // Basic WebRTC API check
  try {
    const testPc = new RTCPeerConnection();
    testPc.close();
    features.push("RTCPeerConnection");
  } catch (e) {
    supported = false;
  }

  // Media devices API check
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    features.push("getUserMedia");
  } else {
    console.warn("getUserMedia not supported - media capture may fail");
  }

  // DataChannel support
  try {
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel("test");
    if (dc) {
      features.push("DataChannel");
    }
    pc.close();
  } catch (e) {
    console.warn("DataChannel not supported");
  }

  return { supported, features };
}

// Initialize audio context to handle autoplay restrictions
export async function initializeAudioContext(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // Create audio context to unlock audio
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const audioContext = new AudioContext();
      
      // Resume if suspended (common in browsers with autoplay restrictions)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
        console.log("AudioContext resumed successfully");
      }
      
      // Create a short silent audio buffer to fully initialize
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      
      console.log("AudioContext initialized:", audioContext.state);
    }
  } catch (error) {
    console.warn("AudioContext initialization failed:", error);
    throw error;
  }
}

// ICE gathering test function
export async function testICEGathering(): Promise<{
  localCandidates: RTCIceCandidate[];
  gatheringState: RTCIceGatheringState;
  success: boolean;
}> {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection(webrtcConfig);
    const localCandidates: RTCIceCandidate[] = [];
    let resolved = false;

    const resolveTest = () => {
      if (!resolved) {
        resolved = true;
        pc.close();
        resolve({
          localCandidates,
          gatheringState: pc.iceGatheringState,
          success: localCandidates.length > 0,
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        localCandidates.push(event.candidate);
        console.log("ICE candidate gathered:", event.candidate.candidate);
      } else {
        // ICE gathering complete
        resolveTest();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.iceGatheringState);
      if (pc.iceGatheringState === "complete") {
        resolveTest();
      }
    };

    // Create a data channel to start ICE gathering
    pc.createDataChannel("test");
    
    // Create offer to start the process
    pc.createOffer().then((offer) => {
      return pc.setLocalDescription(offer);
    }).catch((error) => {
      console.error("Failed to create offer:", error);
      resolveTest();
    });

    // Timeout after 10 seconds
    setTimeout(resolveTest, 10000);
  });
}

// Media constraints for different quality levels
export const mediaConstraints = {
  low: {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15, max: 30 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
    },
  },
  medium: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
    },
  },
  high: {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
    },
  },
};
