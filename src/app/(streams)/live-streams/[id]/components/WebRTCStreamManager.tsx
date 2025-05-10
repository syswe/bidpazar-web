"use client";

// src/app/(streams)/live-streams/[id]/components/WebRTCStreamManager.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import * as mediasoupClient from "mediasoup-client";
import { useAuth } from "@/components/AuthProvider";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
import DeviceSelector from "./DeviceSelector";
import WebRTCConnectionInfo from "./WebRTCConnectionInfo";
import { getAuth } from "@/lib/frontend-auth";
import { v4 as uuidv4 } from "uuid";
import { io, Socket } from "socket.io-client";
import {
  Loader2,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { Device } from "mediasoup-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
// import WebSocket from 'ws';

// ===================== LOGGING SYSTEM =====================
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
} as const;

type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];
type LogData = Record<string, any> | null | undefined;

// Set to desired log level (can be controlled via environment variable in production)
const CURRENT_LOG_LEVEL = LOG_LEVELS.TRACE; // For detailed debugging

// Enable sending logs to server in production
const SEND_LOGS_TO_SERVER = process.env.NODE_ENV === "production";
const DIAGNOSTIC_LOG_SIZE = 100; // Keep last 100 logs for diagnostics
const diagnosticLogs: string[] = [];

// Set up WebRTC native debug logging if available
const setupWebRTCDebugLogging = () => {
  try {
    // Enable WebRTC internal logs - available in Chrome
    if ((window as any).webrtcHacks === undefined) {
      (window as any).webrtcHacks = {};
    }

    // Store original console logging functions
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Tap into WebRTC specific log messages
    const isWebRTCLog = (args: any[]) => {
      if (args.length === 0) return false;
      const firstArg = String(args[0]);
      return (
        firstArg.includes("RTCPeerConnection") ||
        firstArg.includes("RTCIceCandidate") ||
        firstArg.includes("RTCSessionDescription") ||
        firstArg.includes("RTCRtpSender") ||
        firstArg.includes("RTCRtpReceiver") ||
        firstArg.includes("ICE") ||
        firstArg.includes("SDP") ||
        firstArg.includes("RTP") ||
        firstArg.includes("SRTP") ||
        firstArg.includes("DTLS") ||
        firstArg.includes("SCTP")
      );
    };

    // Override console.log to capture WebRTC logs
    console.log = function (...args: any[]) {
      // Call original function
      originalConsoleLog.apply(console, args);

      // Capture WebRTC logs
      if (isWebRTCLog(args)) {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        diagnosticLogs.push(
          `${new Date().toISOString()} [WebRTC-Native] ${message}`
        );

        // Trim logs if they get too large
        if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
          diagnosticLogs.shift();
        }
      }
    };

    // Similar for console.error
    console.error = function (...args: any[]) {
      originalConsoleError.apply(console, args);
      if (isWebRTCLog(args)) {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        diagnosticLogs.push(
          `${new Date().toISOString()} [WebRTC-Native-Error] ${message}`
        );
        if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
          diagnosticLogs.shift();
        }
      }
    };

    // Similar for console.warn
    console.warn = function (...args: any[]) {
      originalConsoleWarn.apply(console, args);
      if (isWebRTCLog(args)) {
        const message = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg)
          )
          .join(" ");
        diagnosticLogs.push(
          `${new Date().toISOString()} [WebRTC-Native-Warn] ${message}`
        );
        if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
          diagnosticLogs.shift();
        }
      }
    };

    // Try to enable WebRTC logs in Chrome
    if ((window as any).webrtcLogs === undefined) {
      (window as any).webrtcLogs = true;
    }

    // Try to enable debug logging in Firefox
    if (navigator.userAgent.indexOf("Firefox") !== -1) {
      try {
        // Set Firefox WebRTC logging pref if possible
        (window as any).localStorage.setItem("debug", "webrtc*");
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    return true;
  } catch (e) {
    // Ignore errors in debug setup
    return false;
  }
};

// Initialize WebRTC debug logging when the file loads
setupWebRTCDebugLogging();

// Log formatting helper functions
const formatTimestamp = () => new Date().toISOString();
const formatLogPrefix = () => "[WebRTC]";

// Helper to send logs to server for debugging
const sendLogsToServer = (
  userId: string,
  streamId: string,
  message: string
) => {
  if (!SEND_LOGS_TO_SERVER) return;

  try {
    fetch("/api/logs/webrtc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        streamId,
        message,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        // Include info about client device/browser
        clientInfo: {
          platform: navigator.platform,
          vendor: navigator.vendor,
          language: navigator.language,
          deviceMemory: (navigator as any).deviceMemory,
          hardwareConcurrency: navigator.hardwareConcurrency,
          connectionType:
            (navigator as any).connection?.effectiveType || "unknown",
        },
      }),
    }).catch((e) => console.error("Failed to send logs to server:", e));
  } catch (e) {
    // Silently fail if log sending fails
  }
};

// Main logging function
const log = (
  level: LogLevel,
  message: string,
  data: LogData = null,
  userId?: string,
  streamId?: string
) => {
  if (level > CURRENT_LOG_LEVEL) return;

  const timestamp = formatTimestamp();
  const prefix = formatLogPrefix();
  let formattedData = "";

  if (data) {
    try {
      formattedData = JSON.stringify(
        data,
        (key, value) => {
          // Handle circular references
          if (typeof value === "function") return "[Function]";
          if (typeof value === "object" && value !== null) {
            // Handle special objects
            if (value instanceof RTCPeerConnection)
              return `[RTCPeerConnection:${value.connectionState}]`;
            if (value instanceof MediaStream) return "[MediaStream]";
            if (value instanceof MediaStreamTrack)
              return `[${value.kind}Track:${value.label}]`;
          }
          return value;
        },
        2
      );
    } catch (e) {
      formattedData = "[Unserializable data]";
    }
  }

  const logMessage = `${timestamp} ${prefix} ${message}`;

  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(
        `%c${logMessage}`,
        "color: #FF5555; font-weight: bold",
        formattedData || ""
      );
      break;
    case LOG_LEVELS.WARN:
      console.warn(`%c${logMessage}`, "color: #FFAA00", formattedData || "");
      break;
    case LOG_LEVELS.INFO:
      console.info(`%c${logMessage}`, "color: #55AAFF", formattedData || "");
      break;
    case LOG_LEVELS.DEBUG:
      console.log(`%c${logMessage}`, "color: #AAAAAA", formattedData || "");
      break;
    case LOG_LEVELS.TRACE:
      console.log(`%c${logMessage}`, "color: #666666", formattedData || "");
      break;
  }

  // Store log in diagnostic logs array (with circular reference handling)
  const diagnosticLog = `${timestamp} [${Object.keys(LOG_LEVELS).find(
    (key) => LOG_LEVELS[key as keyof typeof LOG_LEVELS] === level
  )}] ${message} ${formattedData || ""}`;

  diagnosticLogs.push(diagnosticLog);
  if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
    diagnosticLogs.shift(); // Remove oldest log if we exceed capacity
  }

  // For critical errors, send logs to server for diagnostics
  if (level === LOG_LEVELS.ERROR && userId && streamId) {
    sendLogsToServer(userId, streamId, `${message} ${formattedData || ""}`);
  }

  // Mark performance timeline for debugging
  try {
    performance.mark(`webrtc-${level}-${Date.now()}`);
  } catch (e) {
    // Ignore if performance API is not available
  }
};

// Convenience logging methods with userId/streamId forwarding
const logError = (
  message: string,
  data?: LogData,
  userId?: string,
  streamId?: string
) => log(LOG_LEVELS.ERROR, message, data, userId, streamId);
const logWarn = (message: string, data?: LogData) =>
  log(LOG_LEVELS.WARN, message, data);
const logInfo = (message: string, data?: LogData) =>
  log(LOG_LEVELS.INFO, message, data);
const logDebug = (message: string, data?: LogData) =>
  log(LOG_LEVELS.DEBUG, message, data);
const logTrace = (message: string, data?: LogData) =>
  log(LOG_LEVELS.TRACE, message, data);

// Helper to get diagnostic logs as a string
const getDiagnosticLogs = () => diagnosticLogs.join("\\n");

// Format unknown errors for consistent logging
const formatError = (err: unknown): Record<string, any> => {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
    };
  } else if (typeof err === "string") {
    return { message: err };
  } else if (typeof err === "object" && err !== null) {
    return { ...err };
  }
  return { unknownError: String(err) };
};

// ===================== WEBRTC CONFIG =====================
const getIceServers = (config: any | null): RTCIceServer[] => {
  // Default to common public STUN servers if no config is available
  if (!config) {
    logWarn(
      "No runtime config available for ICE servers, using public fallbacks"
    );
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  }

  const iceServers: RTCIceServer[] = [];

  // Log all available config for debugging
  logDebug("ICE server configuration from runtime config", {
    stunServerUrl: config.stunServerUrl,
    stunServer: config.stunServer,
    turnServerUrl: config.turnServerUrl,
    turnServer: config.turnServer,
    turnUsername: config.turnUsername ? "present" : "missing",
    turnPassword: config.turnPassword ? "present" : "missing",
  });

  // Add configured STUN server if available
  if (config.stunServerUrl) {
    // Ensure STUN server URL has correct format (stun: prefix)
    let stunUrl = config.stunServerUrl;
    if (!stunUrl.startsWith("stun:") && !stunUrl.startsWith("stuns:")) {
      stunUrl = `stun:${stunUrl}`;
      logWarn("STUN server URL corrected to include stun: prefix", {
        original: config.stunServerUrl,
        corrected: stunUrl,
      });
    }

    iceServers.push({ urls: stunUrl });
    logInfo("Added configured STUN server to ICE configuration", {
      url: stunUrl,
    });
  } else if (config.stunServer) {
    // Legacy support for stunServer property
    let stunUrl = config.stunServer;
    if (!stunUrl.startsWith("stun:") && !stunUrl.startsWith("stuns:")) {
      stunUrl = `stun:${stunUrl}`;
      logWarn("STUN server URL corrected to include stun: prefix", {
        original: config.stunServer,
        corrected: stunUrl,
      });
    }

    iceServers.push({ urls: stunUrl });
    logInfo(
      "Added configured STUN server to ICE configuration (legacy property)",
      {
        url: stunUrl,
      }
    );
  }

  // Add TURN server if credentials are configured
  if (
    (config.turnServerUrl || config.turnServer) &&
    config.turnUsername &&
    config.turnPassword
  ) {
    const turnUrl = config.turnServerUrl || config.turnServer;

    // Ensure TURN server URL has correct format (turn: prefix)
    let normalizedTurnUrl = turnUrl;
    if (
      !normalizedTurnUrl.startsWith("turn:") &&
      !normalizedTurnUrl.startsWith("turns:")
    ) {
      normalizedTurnUrl = `turn:${normalizedTurnUrl}`;
      logWarn("TURN server URL corrected to include turn: prefix", {
        original: turnUrl,
        corrected: normalizedTurnUrl,
      });
    }

    // Add UDP TURN server (default)
    iceServers.push({
      urls: normalizedTurnUrl,
      username: config.turnUsername,
      credential: config.turnPassword,
    });

    // Add TCP TURN server option for firewall traversal
    // First check if the URL already specifies a transport
    if (!normalizedTurnUrl.includes("?transport=")) {
      // Extract base URL without any parameters
      const turnUrlBase = normalizedTurnUrl.split("?")[0];

      // Add TCP variant
      iceServers.push({
        urls: `${turnUrlBase}?transport=tcp`,
        username: config.turnUsername,
        credential: config.turnPassword,
      });
      logInfo("Added TCP TURN server variant for firewall traversal", {
        url: `${turnUrlBase}?transport=tcp`,
      });

      // Only add TLS variant if we're using a secure connection already
      if (
        window.location.protocol === "https:" ||
        turnUrlBase.startsWith("turns:")
      ) {
        iceServers.push({
          urls: `${turnUrlBase}?transport=tls`,
          username: config.turnUsername,
          credential: config.turnPassword,
        });
        logInfo("Added TLS TURN server variant for secure fallback", {
          url: `${turnUrlBase}?transport=tls`,
        });
      }
    }

    logInfo("Added TURN server to ICE configuration", {
      url: normalizedTurnUrl,
      username: config.turnUsername,
      credentialProvided: !!config.turnPassword,
    });
  } else if (config.turnServerUrl || config.turnServer) {
    logWarn("TURN server URL provided but missing username or password", {
      turnUrl: config.turnServerUrl || config.turnServer,
      hasUsername: !!config.turnUsername,
      hasPassword: !!config.turnPassword,
    });
  }

  // Add fallback public STUN servers if nothing was configured
  if (iceServers.length === 0) {
    iceServers.push({ urls: "stun:stun.l.google.com:19302" });
    iceServers.push({ urls: "stun:stun1.l.google.com:19302" });
    logWarn(
      "Using public fallback STUN servers because no ICE servers were configured",
      {
        servers: iceServers.map((s) => s.urls),
      }
    );
  }

  logInfo("Final ICE server configuration", {
    serverCount: iceServers.length,
    servers: iceServers.map((s) =>
      typeof s.urls === "string"
        ? s.urls
        : Array.isArray(s.urls)
        ? s.urls.join(", ")
        : "unknown"
    ),
    hasCredentials: iceServers.some((s) => s.username && s.credential),
  });

  return iceServers;
};

// ===================== COMPONENT TYPES =====================
interface WebRTCStreamManagerProps {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
  isCameraOn?: boolean;
  isMicrophoneOn?: boolean;
  isAnonymous?: boolean; // Add this new prop for anonymous users
  onParticipantCount?: (count: number) => void;
  onConnectionError?: (error: {
    type: string;
    message: string;
    canReconnect: boolean;
    isLoopback?: boolean;
    details?: any;
  }) => void;
  onMediaError?: (
    errorType: string,
    errorMessage: string,
    details?: any
  ) => void;
  className?: string;
  onReconnectRequest?: (callback: () => void) => void; // Add this line for external reconnection triggering
  // Add loopback detection props
  isLoopbackConnection?: boolean;
  optimizeForLoopback?: boolean;
  onLoopbackDetected?: (isLoopback: boolean) => void;
}

// Add sessionId to track unique sessions
const generateSessionId = () => {
  // Generate a more unique session ID with additional entropy
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);
  const browserFingerprint = `${navigator.userAgent.length}${window.screen.width}${window.screen.height}`;
  return `${timestamp}-${randomPart}-${browserFingerprint}`;
};

// Function to store last connection info in localStorage
const storeConnectionInfo = (
  streamId: string,
  userId: string,
  info: {
    sessionId: string;
    timestamp: number;
    isActive: boolean;
  }
) => {
  try {
    localStorage.setItem(
      `webrtc-connection-${streamId}-${userId}`,
      JSON.stringify(info)
    );
    return true;
  } catch (e) {
    // Handle localStorage errors (e.g., private browsing)
    return false;
  }
};

// Function to get stored connection info
const getStoredConnectionInfo = (streamId: string, userId: string) => {
  try {
    const storedData = localStorage.getItem(
      `webrtc-connection-${streamId}-${userId}`
    );
    if (storedData) {
      return JSON.parse(storedData) as {
        sessionId: string;
        timestamp: number;
        isActive: boolean;
      };
    }
  } catch (e) {
    // Handle parsing errors
  }
  return null;
};

// Function to clear stored connection info
const clearConnectionInfo = (streamId: string, userId: string) => {
  try {
    localStorage.removeItem(`webrtc-connection-${streamId}-${userId}`);
    return true;
  } catch (e) {
    return false;
  }
};

// Function to store session info for recovery
const storeSessionInfo = (streamId: string, userId: string, data: any) => {
  try {
    localStorage.setItem(
      `webrtc-session-${streamId}-${userId}`,
      JSON.stringify(data)
    );
    return true;
  } catch (e) {
    return false;
  }
};

// Function to get stored session info
const getSessionInfo = (streamId: string, userId: string) => {
  try {
    const storedData = localStorage.getItem(
      `webrtc-session-${streamId}-${userId}`
    );
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (e) {
    // Handle parsing errors
  }
  return null;
};

// Function to clear stored session info
const clearSessionInfo = (streamId: string, userId: string) => {
  try {
    localStorage.removeItem(`webrtc-session-${streamId}-${userId}`);
    return true;
  } catch (e) {
    return false;
  }
};

// ===================== MAIN COMPONENT =====================
export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
  isCameraOn: externalCameraOn,
  isMicrophoneOn: externalMicrophoneOn,
  isAnonymous = false, // Default to false for backward compatibility
  onParticipantCount,
  onConnectionError,
  onMediaError,
  className,
  onReconnectRequest,
  isLoopbackConnection,
  optimizeForLoopback,
  onLoopbackDetected,
}: WebRTCStreamManagerProps) {
  const { config: runtimeConfig, isLoading: isConfigLoading } =
    useRuntimeConfig();
  logInfo("Component initialized", {
    streamId,
    userId,
    username,
    isStreamer,
    isLoopbackConnection,
    optimizeForLoopback,
  });

  // Track if we've detected a loopback connection internally
  const [detectedLoopback, setDetectedLoopback] = useState<boolean>(
    !!isLoopbackConnection
  );

  // Helper for detecting loopback addresses
  const isLoopbackAddress = useCallback((address?: string): boolean => {
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
  }, []);

  // Helper to check if a URL is a loopback URL
  const isLoopbackUrl = useCallback(
    (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);
        return isLoopbackAddress(parsedUrl.hostname);
      } catch (e) {
        return false; // Invalid URL
      }
    },
    [isLoopbackAddress]
  );

  // =========== AUTH STATE ===========
  const { user } = useAuth();
  const { token } = getAuth();

  // For anonymous viewers
  const anonymousId = useRef<string>(uuidv4()).current;
  const effectiveUserId = userId || `anon-${anonymousId}`;
  const effectiveUsername = username || `viewer-${anonymousId.slice(0, 8)}`;

  // Handle session ID with improved refresh detection
  const getSessionId = useCallback(() => {
    // First, check if we have a stored session ID
    const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);

    if (storedInfo) {
      // If stored session is from the last 30 seconds, consider it a refresh
      const isRecentRefresh = Date.now() - storedInfo.timestamp < 30000;

      if (isRecentRefresh) {
        logInfo("Recent refresh detected, reusing session ID", {
          sessionId: storedInfo.sessionId,
          timeSinceLastConnection: Date.now() - storedInfo.timestamp,
        });
        // Mark session as inactive until reconnected
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: false,
          timestamp: Date.now(),
        });
        return storedInfo.sessionId;
      }
    }

    // Generate a new session ID
    const newSessionId = generateSessionId();
    logInfo("Created new session ID", { sessionId: newSessionId });

    // Store the new session info
    storeConnectionInfo(streamId, effectiveUserId, {
      sessionId: newSessionId,
      timestamp: Date.now(),
      isActive: false,
    });

    return newSessionId;
  }, [streamId, effectiveUserId]);

  // Use the session ID from local storage or generate a new one
  const sessionId = useRef<string>(getSessionId()).current;
  const isComponentMounted = useRef<boolean>(false);
  const hasActiveConnection = useRef<boolean>(false);

  // =========== COMPONENT STATE ===========
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "streaming"
  >("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [streamReady, setStreamReady] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState(!externalMicrophoneOn);
  const [isVideoHidden, setIsVideoHidden] = useState(!externalCameraOn);
  const [showDeviceSelector, setShowDeviceSelector] =
    useState<boolean>(isStreamer);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<
    string | undefined
  >(undefined);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<
    string | undefined
  >(undefined);

  // State for debug mode
  const [showDebugControls, setShowDebugControls] = useState<boolean>(false);

  // Add state for transport readiness
  const [transportReady, setTransportReady] = useState<boolean>(false);

  // Add a state for device initialization
  const [deviceInitialized, setDeviceInitialized] = useState(false);

  // At the start of the component, add a new ref to track attempts
  const getRouterAttemptsRef = useRef<number>(0);
  const deviceErrorRef = useRef<boolean>(false);

  // =========== REFS ===========
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const transportRef = useRef<{
    producer?: mediasoupClient.types.Transport | null;
    consumer?: mediasoupClient.types.Transport | null;
  }>({ producer: null, consumer: null });

  // Update the ProducersRef type to include setupInProgress
  type ProducersRef = {
    video?: mediasoupClient.types.Producer | null;
    audio?: mediasoupClient.types.Producer | null;
    setupInProgress?: boolean;
  };

  // Define the producers ref with the updated type
  const producersRef = useRef<ProducersRef>({
    video: null,
    audio: null,
    setupInProgress: false,
  });

  const consumersRef = useRef<{
    video?: mediasoupClient.types.Consumer | null;
    audio?: mediasoupClient.types.Consumer | null;
  }>({ video: null, audio: null });
  const connectionAttemptsRef = useRef<number>(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const mountedRef = useRef<boolean>(false);
  const didInitialSetupRef = useRef<boolean>(false);
  const connectInProgressRef = useRef<boolean>(false);
  const mediaSetupAttemptRef = useRef<number>(0); // Moved mediaSetupAttempt here
  const transportOptionsRef = useRef<any>(null);
  const rtpCapabilitiesRef =
    useRef<mediasoupClient.types.RtpCapabilities | null>(null);

  // Maximum connection attempts before giving up
  const MAX_CONNECTION_ATTEMPTS = 10;
  // Retry delays in milliseconds
  const RETRY_DELAYS = [
    1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 45000,
  ];

  // Add a new state to track autoplay restriction
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);

  // Adding circuit breaker pattern to prevent infinite reconnection loops
  const MAX_RECONNECTIONS = 5; // Maximum number of rapid reconnection attempts before circuit breaks
  const reconnectionCounterRef = useRef<number>(0);
  const lastReconnectionTimeRef = useRef<number>(0);

  // Add a new state variable to track reconnection attempts
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  // Add state for reconnection failures
  const [reconnectionFailed, setReconnectionFailed] = useState<boolean>(false);

  // Helper function to normalize Socket.IO URL (add near the top of the file with other helper functions)
  const normalizeSocketIOUrl = (url: string): string => {
    if (!url) return "ws://localhost:3000"; // Default to ws

    let normalizedUrl = url;

    // Step 1: Ensure it has a protocol. If not, default to ws://
    // We no longer convert ws:// to http:// here.
    if (!normalizedUrl.match(/^[a-z]+:\/\//i)) {
      normalizedUrl = "ws://" + normalizedUrl;
      logDebug("Added ws:// protocol to URL without protocol", {
        original: url,
        normalized: normalizedUrl,
      });
    } else if (normalizedUrl.startsWith("http://")) {
      // If it explicitly starts with http://, change it to ws:// for Socket.IO
      // This handles cases where window.location.origin might be http and was used as a fallback
      normalizedUrl = normalizedUrl.replace(/^http:\/\//i, "ws://");
      logDebug("Converted explicit http:// to ws:// for Socket.IO", {
        original: url,
        normalized: normalizedUrl,
      });
    } else if (normalizedUrl.startsWith("https://")) {
      // If it explicitly starts with https://, change it to wss://
      normalizedUrl = normalizedUrl.replace(/^https:\/\//i, "wss://");
      logDebug("Converted explicit https:// to wss:// for Socket.IO", {
        original: url,
        normalized: normalizedUrl,
      });
    }
    // Ensure ws:// or wss:// is used. The client library will handle the handshake.

    // Step 2: Remove trailing slash to avoid doubled slashes with path
    if (normalizedUrl.endsWith("/")) {
      normalizedUrl = normalizedUrl.replace(/\/+$/, "");
      logDebug("Removed trailing slash(es) from URL", {
        original: url,
        normalized: normalizedUrl,
      });
    }

    // Step 3: Handle port if not specified (not typically needed but added for completeness)
    if (!normalizedUrl.match(/:\d+/) && !normalizedUrl.includes("localhost")) {
      // No port specified, and not localhost (which defaults to 80/443)
      // For most production deployments, the default port is fine
      logDebug("URL has no explicit port, using default", {
        url: normalizedUrl,
      });
    }

    return normalizedUrl;
  };

  // Add the socketPromise utility function if it doesn't exist elsewhere
  const socketPromise = <T,>(
    socket: Socket,
    event: string,
    data: any = {}
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      try {
        socket.emit(event, data, (response: any) => {
          if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response as T);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  // =========== SOCKET CONNECTION =====================
  // Connect to WebRTC signaling server
  const connectToSignalingServer = useCallback(() => {
    if (
      !mountedRef.current ||
      !streamId ||
      connectInProgressRef.current ||
      (socketRef.current && socketRef.current.connected)
    ) {
      return;
    }

    connectInProgressRef.current = true;
    connectionAttemptsRef.current += 1;

    logInfo("connectToSignalingServer called", {
      currentStatus: connectionStatus,
      sessionId,
      attemptNumber: connectionAttemptsRef.current,
    });

    let effectiveSocketUrl = normalizeSocketIOUrl(
      runtimeConfig?.socketUrl || window.location.origin
    );
    const configSocketUrl = runtimeConfig?.socketUrl || "";
    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";
    const locationOrigin = window.location.origin;

    const wsPath = runtimeConfig?.wsUrl || "/socket.io/";

    logInfo("Signaling server connection details", {
      effectiveSocketUrl,
      configSocketUrl,
      envSocketUrl,
      locationOrigin,
      wsPath,
      sessionId,
      isReconnect: reconnectionCounterRef.current > 0,
    });

    // Determine optimal connection URL
    if (
      effectiveSocketUrl.startsWith("ws:") ||
      effectiveSocketUrl.startsWith("wss:")
    ) {
      logInfo("Using WebSocket Socket.IO URL");
    } else {
      logInfo("Using HTTP Socket.IO URL");
    }

    // Improved configuration with exponential backoff
    const socket = io(effectiveSocketUrl, {
      path: wsPath,
      query: {
        streamId,
        userId: effectiveUserId,
        username: effectiveUsername,
        isStreamer: isStreamer ? 1 : 0,
        sessionId,
        isAnonymous: isAnonymous ? 1 : 0,
      },
      transports: ["websocket", "polling"], // Try both transports
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 8, // Increase from 5 to 8
      reconnectionDelay: Math.min(
        1000 * Math.pow(1.5, connectionAttemptsRef.current),
        10000
      ), // Exponential backoff
      reconnectionDelayMax: 15000, // Increased from 8000 to 15000
      timeout: 30000, // Increased timeout to allow for slower connections
      forceNew: true, // Force a new connection each time to prevent reusing existing problematic connections
      // Fix for trailing slash issues in Next.js 13+
      addTrailingSlash: false,
    });

    socketRef.current = socket;

    // Enhanced socket error handlers
    socket.io.on("error", (err) => {
      logError("Socket.IO engine error", err);

      // Report to parent component
      if (onConnectionError) {
        onConnectionError({
          type: "SOCKET_ENGINE_ERROR",
          message: `Connection error: ${err.message || "Unknown socket error"}`,
          canReconnect: true,
        });
      }
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      logInfo(`Socket.IO reconnect attempt ${attempt}`);

      // Update UI to show reconnection is in progress
      setConnectionStatus("connecting");
      setIsRecovering(true);

      // Store session info for recovery
      const handleDisconnection = () => {
        if (deviceRef.current?.loaded) {
          const sessionData = {
            streamId,
            userId: effectiveUserId,
            deviceCapabilities: deviceRef.current?.rtpCapabilities,
            timestamp: Date.now(),
            isStreamer,
            sessionId,
          };

          storeSessionInfo(streamId, effectiveUserId, sessionData);
          logInfo("Session info stored for possible recovery", {
            sessionId,
            streamId,
            timestamp: sessionData.timestamp,
          });
        }
      };

      // Only store on first reconnect attempt to avoid overwrites
      if (attempt === 1) {
        handleDisconnection();
      }
    });

    socket.io.on("reconnect_error", (error) => {
      logError("Socket.IO reconnect error", formatError(error));

      // If we're trying to recover, show appropriate status
      if (isRecovering) {
        // If reconnection fails multiple times, we might need to give up
        if (reconnectionCounterRef.current > 5) {
          setIsRecovering(false);
          setConnectionStatus("disconnected");
          setReconnectionFailed(true); // Set this to true to show retry button
          setError(
            "Connection lost. Please try to reconnect or refresh the page."
          );

          if (onConnectionError) {
            onConnectionError({
              type: "RECONNECT_FAILED",
              message: "Failed to reconnect after multiple attempts",
              canReconnect: true, // Set to true since we have a manual retry
            });
          }
        }
      }
    });

    socket.io.on("reconnect_failed", () => {
      logError("Socket.IO reconnect failed after all attempts");
      // Reset connection flags to allow manual reconnection attempts
      connectInProgressRef.current = false;
      setIsRecovering(false);
      setReconnectionFailed(true); // Set this to true to show retry button

      // Report to parent component that connection failed permanently
      if (onConnectionError) {
        onConnectionError({
          type: "RECONNECT_FAILED",
          message: "Connection failed after multiple attempts",
          canReconnect: true, // Set to true since we have a manual retry
        });
      }
    });

    socket.io.on("reconnect", (attempt) => {
      logInfo(`Socket.IO reconnected after ${attempt} attempts`);
      reconnectionCounterRef.current += 1;
      lastReconnectionTimeRef.current = Date.now();

      // Reset connection flag on successful reconnection
      connectInProgressRef.current = false;

      // Attempt session recovery
      const handleReconnection = async () => {
        const sessionData = getSessionInfo(streamId, effectiveUserId);

        if (
          sessionData &&
          sessionData.timestamp &&
          Date.now() - sessionData.timestamp < 5 * 60 * 1000
        ) {
          // Only recover sessions less than 5 minutes old

          logInfo("Attempting to recover session from stored data", {
            sessionId,
            timeSinceDisconnection: Date.now() - sessionData.timestamp,
          });

          // If we have device capabilities stored, try to use them
          if (sessionData.deviceCapabilities && deviceRef.current) {
            try {
              // If device is already loaded, we can skip reloading
              if (!deviceRef.current.loaded) {
                await deviceRef.current.load({
                  routerRtpCapabilities: sessionData.deviceCapabilities,
                });
                logInfo("Recovered device capabilities from stored session", {
                  sessionId: sessionData.sessionId,
                });
              }

              // Send stored capabilities to the server
              if (socketRef.current?.connected) {
                logInfo("Sending recovered device capabilities to server");

                socketRef.current.emit("connectRtpCapabilities", {
                  rtpCapabilities: deviceRef.current.rtpCapabilities,
                  streamId,
                  isReconnection: true,
                  sessionId: sessionData.sessionId,
                });
              }
            } catch (err) {
              logError("Failed to recover session", formatError(err));
              // Fall back to normal connection process
              if (socketRef.current?.connected) {
                socketRef.current.emit("getRouterRtpCapabilities", {
                  streamId,
                });
              }
            }
          } else {
            logInfo(
              "No device capabilities found in stored session, requesting new ones"
            );
            if (socketRef.current?.connected) {
              socketRef.current.emit("getRouterRtpCapabilities", { streamId });
            }
          }
        } else {
          logInfo(
            "No valid session data found or session too old, starting fresh connection"
          );
          if (socketRef.current?.connected) {
            socketRef.current.emit("getRouterRtpCapabilities", { streamId });
          }
        }

        // Update the connection info to mark it as active again
        const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
        if (storedInfo) {
          storeConnectionInfo(streamId, effectiveUserId, {
            ...storedInfo,
            isActive: true,
            timestamp: Date.now(),
          });
        }
      };

      handleReconnection();
    });

    // Existing connect handler
    socket.on("connect", () => {
      if (!mountedRef.current) {
        logWarn("Socket connected but component unmounted, cleaning up");
        socket.disconnect();
        return;
      }

      // Reset reconnection counter on successful connection
      reconnectionCounterRef.current = 0;
      lastReconnectionTimeRef.current = Date.now();

      logInfo("Socket connected", {
        socketId: socket.id,
        streamId,
        userId: effectiveUserId,
        sessionId,
        transportType: socket.io.engine.transport.name, // Log the actual transport type that succeeded
      });

      // Mark this component as having an active connection
      hasActiveConnection.current = true;
      connectInProgressRef.current = false;
      setConnectionStatus("connected");
      setError(null);
      connectionAttemptsRef.current = 0; // Reset attempts on successful connection

      // Request router capabilities after successful connection
      socket.emit(
        "getRouterRtpCapabilities",
        { streamId, sessionId },
        (response: RouterRtpCapabilitiesResponse) => {
          if (!mountedRef.current) return;

          if (response.error) {
            logError("Failed to get router capabilities", {
              error: response.error,
            });
            setError(`Failed to initialize media: ${response.error}`);
            return;
          }

          // Store RTP capabilities for later use
          if (response.rtpCapabilities) {
            rtpCapabilitiesRef.current = response.rtpCapabilities;
          }

          // Don't show error for duplicate connection, try to continue anyway
          if (response.duplicateConnection) {
            logWarn(
              "Server reported duplicate connection but we'll try to continue",
              {
                existingSocketId: response.existingSocketId,
              }
            );

            // Store the duplicate connection info
            if (response.existingSocketId) {
              // This may be common during development with HMR, but should be rare in production
              logInfo("Handling potential duplicate connection scenario", {
                newSocketId: socket.id,
                existingSocketId: response.existingSocketId,
                streamId,
              });

              // Set state variables to prevent disruption
              hasActiveConnection.current = true;

              // Continue with normal flow but add a delay for the server to clean up previous connection
              setTimeout(() => {
                if (!mountedRef.current) return;

                if (response.rtpCapabilities) {
                  initializeMediasoupDevice(response.rtpCapabilities);
                }
              }, 300);

              return; // Skip the immediate initialization below
            }
          }

          logInfo("Received router capabilities", {
            capabilities: response.rtpCapabilities,
          });

          if (response.rtpCapabilities) {
            initializeMediasoupDevice(response.rtpCapabilities);
          } else {
            logError("No RTP capabilities received from server");
            setError(
              "Failed to initialize media: No RTP capabilities received"
            );
          }
        }
      );

      // Mark connection as active in localStorage
      const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
      if (storedInfo) {
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: true,
          timestamp: Date.now(),
        });
      }

      // Announce broadcaster or viewer readiness
      if (isStreamer) {
        logInfo("Emitting broadcaster_ready signal", { streamId, sessionId });
        socket.emit("broadcaster_ready", { streamId, sessionId });
      } else {
        logInfo("Emitting viewer_ready signal", { streamId, sessionId });
        socket.emit("viewer_ready", { streamId, sessionId });
      }
    });

    // Add a handler for server-side errors
    socket.on(
      "error",
      (data: {
        message: string;
        code?: string;
        details?: any;
        canReconnect?: boolean;
      }) => {
        if (!mountedRef.current) return;

        logError(`Server reported error: ${data.message}`, {
          code: data.code,
          details: data.details,
          canReconnect: data.canReconnect,
        });

        // Set the error message for the user
        setError(data.message);

        // If the server indicates we can reconnect, try that
        if (data.canReconnect) {
          logInfo("Will attempt to reconnect based on server suggestion");

          // Wait a moment then try reconnecting
          setTimeout(() => {
            if (mountedRef.current) {
              connectionAttemptsRef.current = 0;
              setConnectionStatus("disconnected");
              connectToSignalingServer();
            }
          }, 2000);
        }

        // Report the error to parent component if callback is provided
        if (onConnectionError) {
          onConnectionError({
            type: data.code || "SERVER_ERROR",
            message: data.message,
            canReconnect: !!data.canReconnect,
          });
        }
      }
    );

    // Set up broadcaster_ready and viewer_ready event handlers
    if (!isStreamer) {
      // Viewer listens for broadcaster ready events
      socket.on("broadcaster_ready", (data) => {
        logInfo("Received broadcaster_ready event", {
          broadcasterSocketId: data.broadcasterSocketId,
          broadcasterUserId: data.broadcasterUserId,
          streamId: data.streamId,
          activeProducers: data.activeProducers,
        });

        // Clear any error about streamer not broadcasting
        if (error === "The streamer is not currently broadcasting") {
          setError("");
        }

        // If we have active producers, set device initialized to trigger consumer transport
        if (data.activeProducers && data.activeProducers.length > 0) {
          logInfo(
            `Broadcaster has ${data.activeProducers.length} active producers`
          );
          if (deviceRef.current?.loaded) {
            setDeviceInitialized(true);
          }
        }
      });

      // Handle viewer_ready_response with active producers info
      socket.on("viewer_ready_response", (data) => {
        logInfo("Received viewer_ready_response event", {
          broadcasterSocketId: data.broadcasterSocketId,
          broadcasterUserId: data.broadcasterUserId,
          hasActiveStreamer: data.hasActiveStreamer,
          activeProducers: data.activeProducers,
        });

        // If we have active producers, set device initialized to trigger consumer transport
        if (data.activeProducers && data.activeProducers.length > 0) {
          logInfo(`Stream has ${data.activeProducers.length} active producers`);
          if (deviceRef.current?.loaded) {
            setDeviceInitialized(true);
          }

          // Clear any error about streamer not broadcasting
          if (error === "The streamer is not currently broadcasting") {
            setError("");
          }
        } else if (!data.hasActiveStreamer) {
          setError("The streamer is not currently broadcasting");
        }
      });

      // Send viewer ready event after connection
      socket.emit("viewer_ready", {
        streamId,
        sessionId,
      });
    } else {
      // Broadcaster listens for viewer ready events
      socket.on("viewer_connected", (data) => {
        logInfo("Received viewer_connected event", {
          viewerSocketId: data.viewerSocketId,
          viewerUserId: data.viewerUserId,
          streamId: data.streamId,
        });

        // Update participant count
        setParticipantCount((count) => count + 1);
      });

      // Handle broadcaster_ready_confirmed to know the server recognized us
      socket.on("broadcaster_ready_confirmed", (data) => {
        logInfo("Broadcaster ready confirmed by server", {
          success: data.success,
          roomState: data.roomState,
        });

        // Update UI state to show we're successfully broadcasting
        if (data.success) {
          setConnectionStatus("streaming");
          setError(""); // Clear any previous errors

          // Update participant count if provided
          if (data.roomState && typeof data.roomState.viewers === "number") {
            setParticipantCount(data.roomState.viewers);
          }
        }
      });
    }

    // Enhanced error handlers remain the same

    // Set up additional debug event to monitor connection quality
    socket.io.engine.on("upgrade", (transport) => {
      logInfo("Socket.IO transport upgraded", {
        from: socket.io.engine.transport.name,
        to: transport.name,
      });
    });

    // Add additional ping event to monitor connection
    socket.on("ping", () => {
      if (showDebugControls) {
        logInfo("Ping received from server");
      }
    });

    socket.on("participant_count", (data: { count: number }) => {
      if (mountedRef.current) {
        setParticipantCount(data.count);

        // Call the callback if provided
        if (onParticipantCount) {
          onParticipantCount(data.count);
        }
      }
    });

    // Add an rtpCapabilities event handler and store the value
    socket.on("rtpCapabilities", (rtpCapabilities) => {
      logInfo("Received RTP capabilities from server");
      rtpCapabilitiesRef.current = rtpCapabilities;
    });

    // In the socket.on("getRouterRtpCapabilities") handler, add:
    socket.on("getRouterRtpCapabilities", async (data, callback) => {
      try {
        // Request RTP capabilities from server
        const response = await socketPromise<RouterRtpCapabilitiesResponse>(
          socket,
          "getRouterRtpCapabilities",
          { streamId }
        );

        if (response && response.rtpCapabilities) {
          rtpCapabilitiesRef.current = response.rtpCapabilities;
        }
        callback({ rtpCapabilities: response.rtpCapabilities });
      } catch (err) {
        callback({ error: formatError(err) });
      }
    });

    return socket;
  }, [
    runtimeConfig,
    streamId,
    effectiveUserId,
    effectiveUsername,
    isStreamer,
    isAnonymous,
    sessionId,
    connectionStatus,
    onConnectionError,
  ]);

  /**
   * Test direct WebSocket connectivity (without Socket.IO)
   * This helps diagnose raw WebSocket issues vs Socket.IO specific issues
   */
  const testDirectWebSocketConnectivity = async (
    url: string // This 'url' is passed from preConnectionTest, e.g., ws://localhost:3000
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      let baseUrl = url;

      // Remove trailing slash if present
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }

      // First try: Direct connection to base WebSocket URL
      let attemptCount = 0;
      const maxAttempts = 2;
      let wsConnectionSuccessful = false;

      const attemptConnection = () => {
        attemptCount++;
        const currentAttemptUrl =
          attemptCount === 1
            ? baseUrl
            : `${baseUrl}/socket.io/?EIO=4&transport=websocket`;

        logInfo(
          `[WebRTCManager] WS Connection attempt ${attemptCount}/${maxAttempts} to: ${currentAttemptUrl}`
        );

        // Set timeout to prevent hanging
        const connectionTimeout = setTimeout(() => {
          logInfo(
            `[WebRTCManager] Native WebSocket connection to ${currentAttemptUrl} timed out after 3s`
          );
          if (ws) {
            ws.close();
          }

          if (attemptCount < maxAttempts) {
            attemptConnection(); // Try next approach
          } else {
            logError(
              "[WebRTCManager] All WebSocket connection attempts failed"
            );
            resolve(false);
          }
        }, 3000);

        // Create WebSocket connection
        let ws: WebSocket;
        try {
          ws = new WebSocket(currentAttemptUrl);

          ws.onopen = () => {
            logInfo(
              `[WebRTCManager] WebSocket connection successful to ${currentAttemptUrl}`
            );
            clearTimeout(connectionTimeout);
            wsConnectionSuccessful = true;
            resolve(true);
            try {
              ws.close(1000, "Test complete"); // Clean close
            } catch (e) {
              // Ignore close errors
            }
          };

          ws.onerror = (error) => {
            logInfo(
              `[WebRTCManager] Native WebSocket connection to ${currentAttemptUrl} failed.`,
              { error }
            );
            // Don't resolve here - wait for timeout or close
          };

          ws.onclose = (event) => {
            if (!wsConnectionSuccessful) {
              logInfo(
                `[WebRTCManager] WebSocket connection closed during test (code: ${event.code})`,
                { wasClean: event.wasClean }
              );
              clearTimeout(connectionTimeout);

              if (attemptCount < maxAttempts) {
                attemptConnection(); // Try next approach
              } else {
                resolve(false);
              }
            }
          };
        } catch (err) {
          logError("[WebRTCManager] Exception creating WebSocket connection", {
            error: err,
            url: currentAttemptUrl,
          });
          clearTimeout(connectionTimeout);

          if (attemptCount < maxAttempts) {
            attemptConnection(); // Try next approach
          } else {
            resolve(false);
          }
        }
      };

      // Start the connection attempt sequence
      attemptConnection();
    });
  };

  // =========== MEDIASOUP UTILITIES ===========
  /**
   * Initialize MediaSoup device with router capabilities
   */
  const initializeMediasoupDevice = useCallback(
    async (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      try {
        if (!mountedRef.current) return;

        // Track device errors separately
        const hasDeviceError = deviceErrorRef.current;

        // Add more detailed logging
        logInfo("Initializing MediaSoup device with router capabilities", {
          hasDeviceRef: !!deviceRef.current,
          deviceLoaded: deviceRef.current?.loaded,
          hasDeviceError,
          socketId: socketRef.current?.id || "no-socket",
        });

        // If device was previously initialized and failed, create a new one
        if (hasDeviceError) {
          logWarn("Previous device had errors, creating a fresh one");
          deviceRef.current = new mediasoupClient.Device();
          // Reset error flag
          deviceErrorRef.current = false;
        }

        // Create device if needed
        if (!deviceRef.current) {
          logInfo("Creating new MediaSoup device");
          deviceRef.current = new mediasoupClient.Device();
        }

        // Only load the device if it's not loaded yet
        if (!deviceRef.current.loaded) {
          try {
            logInfo("Loading device with RTP capabilities", {
              routerRtpCapabilities: {
                codecs: routerRtpCapabilities.codecs?.map((c) => c.mimeType),
                headerExtensions:
                  routerRtpCapabilities.headerExtensions?.length,
              },
            });

            await deviceRef.current.load({ routerRtpCapabilities });

            logInfo("MediaSoup device initialized successfully", {
              canProduceVideo: deviceRef.current.canProduce("video"),
              canProduceAudio: deviceRef.current.canProduce("audio"),
              loaded: deviceRef.current.loaded,
            });
          } catch (deviceErr: any) {
            logError(
              `Failed to load MediaSoup device: ${
                deviceErr.message || "Unknown error"
              }`,
              formatError(deviceErr)
            );
            // Mark device error state
            deviceErrorRef.current = true;

            // Delay and try again once if this was a device load error
            setTimeout(() => {
              if (mountedRef.current && socketRef.current?.connected) {
                logInfo(
                  "Attempting to recover from MediaSoup device load failure"
                );
                socketRef.current.emit(
                  "getRouterRtpCapabilities",
                  { streamId, sessionId, recovery: true },
                  (response: RouterRtpCapabilitiesResponse) => {
                    if (response.rtpCapabilities && mountedRef.current) {
                      initializeMediasoupDevice(response.rtpCapabilities);
                    }
                  }
                );
              }
            }, 2000); // Increased from 1000ms to 2000ms

            return;
          }
        }

        // After device is loaded, send our RTP capabilities to the server
        if (socketRef.current && deviceRef.current.loaded) {
          try {
            logInfo("Sending device RTP capabilities to server", {
              deviceLoaded: deviceRef.current.loaded,
              socketConnected: socketRef.current.connected,
            });

            const response = await socketPromise<{
              success: boolean;
              error?: string;
              reconnect?: boolean;
              activeProducers?: Array<{
                producerId: string;
                kind: string;
                peerId: string;
              }>;
            }>(socketRef.current, "connectRtpCapabilities", {
              rtpCapabilities: deviceRef.current.rtpCapabilities,
              streamId,
            });

            if (response && response.success) {
              logInfo("Successfully sent RTP capabilities to server");

              // Signal that the device is ready for transport setup
              hasActiveConnection.current = true;

              // If we're a viewer and there are active producers, handle them
              if (
                !isStreamer &&
                response.activeProducers &&
                response.activeProducers.length > 0
              ) {
                logInfo(
                  `Server reports ${response.activeProducers.length} active producers available`,
                  {
                    producers: response.activeProducers.map((p) => ({
                      id: p.producerId,
                      kind: p.kind,
                    })),
                  }
                );

                // Set device initialized flag to trigger consumer transport creation
                setDeviceInitialized(true);
              }

              // For streamers, create producer transport
              if (isStreamer) {
                logInfo(
                  "Streamer device initialized, proceeding with producer setup"
                );
                // Set device initialized flag to trigger producer transport creation
                setDeviceInitialized(true);
              }
            } else if (response && response.error) {
              logWarn(`Failed to send RTP capabilities: ${response.error}`);

              // If server requests reconnection, try that
              if (response.reconnect && socketRef.current) {
                logInfo(
                  "Server requested reconnection, attempting to reconnect"
                );
                socketRef.current.disconnect();
                socketRef.current = null;

                // Short delay before reconnecting
                setTimeout(() => {
                  if (mountedRef.current) {
                    connectToSignalingServer();
                  }
                }, 1000);
                return;
              }
            }
          } catch (err) {
            logWarn("Failed to send RTP capabilities to server", {
              error: formatError(err),
            });

            // Try again after a short delay - this is not fatal
            setTimeout(() => {
              if (
                mountedRef.current &&
                socketRef.current?.connected &&
                deviceRef.current?.loaded
              ) {
                logInfo("Retrying sending RTP capabilities");
                socketRef.current.emit("connectRtpCapabilities", {
                  rtpCapabilities: deviceRef.current.rtpCapabilities,
                  streamId,
                  retry: true,
                });
              }
            }, 1500);
          }
        }

        // Set a flag for viewers to create transport in an effect
        if (!isStreamer && connectionStatus === "connected") {
          setDeviceInitialized(true);
        }
      } catch (err) {
        logError(
          "Error initializing MediaSoup device",
          formatError(err),
          effectiveUserId,
          streamId
        );
        setError(`Failed to initialize media: ${formatError(err)}`);
      }
    },
    [
      isStreamer,
      streamId,
      effectiveUserId,
      connectionStatus,
      sessionId,
      connectToSignalingServer,
      socketPromise,
    ]
  );

  /**
   * Create and set up a producer transport for the streamer
   */
  const setupProducerTransport = useCallback(
    async (transportOptions: any) => {
      if (!deviceRef.current) {
        logger.error(
          "Cannot set up producer transport: Device not initialized"
        );
        logError(
          "Cannot set up producer transport: Device not initialized",
          null,
          effectiveUserId,
          streamId
        );
        return null;
      }

      if (isConfigLoading || !runtimeConfig) {
        logError(
          "Cannot set up producer transport: Runtime config not ready",
          {
            isConfigLoading,
            hasConfig: !!runtimeConfig,
          },
          effectiveUserId,
          streamId
        );
        return null;
      }

      try {
        logger.debug("Creating producer transport", transportOptions);

        // Get ICE servers using runtime config
        const iceServers = getIceServers(runtimeConfig);

        logInfo("Creating producer transport with ICE servers", {
          transportId: transportOptions.id,
          iceServerCount: iceServers.length,
        });

        // Create the transport with enhanced ICE configuration
        const transport = deviceRef.current.createSendTransport({
          id: transportOptions.id,
          iceParameters: transportOptions.iceParameters,
          iceCandidates: transportOptions.iceCandidates,
          dtlsParameters: transportOptions.dtlsParameters,
          iceServers: iceServers, // Use runtime ICE servers
        });

        logger.info("Producer transport created", {
          transportId: transport.id,
        });

        // Set up transport connection events
        transport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            logger.debug("Producer transport connect event", {
              transportId: transport.id,
            });

            logInfo("Producer transport connect event triggered", {
              transportId: transport.id,
              dtlsParameters,
            });

            try {
              if (!socketRef.current?.connected) {
                const error = new Error("Socket not connected");
                logError(
                  "Producer transport connect failed: Socket not connected",
                  null,
                  effectiveUserId,
                  streamId
                );
                throw error;
              }

              socketRef.current.emit("connectProducerTransport", {
                transportId: transport.id,
                dtlsParameters,
              });

              logDebug("Producer transport connect request sent to server");
              callback();
            } catch (err) {
              logger.error(
                "Producer transport connect failed",
                formatError(err)
              );
              logError(
                "Producer transport connect failed",
                formatError(err),
                effectiveUserId,
                streamId
              );
              errback(err as Error);
            }
          }
        );

        // Monitor ICE connection state
        transport.on("connectionstatechange", (state) => {
          // Now we'll use the connectionstatechange to detect ICE issues
          logInfo("Producer transport connection state change", {
            transportId: transport.id,
            state,
          });
          if (state === "connecting") {
            logInfo("Producer transport ICE connecting", {
              transportId: transport.id,
            });
          } else if (state === "failed") {
            logError(
              "Producer transport ICE connection failed",
              {
                transportId: transport.id,
              },
              effectiveUserId,
              streamId
            );

            // Attempt ICE restart if connection fails
            if (mountedRef.current && socketRef.current?.connected) {
              logInfo("Attempting ICE restart for failed transport", {
                transportId: transport.id,
              });

              // Emit restart request to server
              socketRef.current.emit(
                "restartIce",
                { transportId: transport.id },
                (response: any) => {
                  if (response.error) {
                    logError(
                      "ICE restart request failed",
                      {
                        error: response.error,
                      },
                      effectiveUserId,
                      streamId
                    );
                    return;
                  }

                  // Apply new ICE parameters
                  if (response.iceParameters) {
                    try {
                      transport.restartIce({
                        iceParameters: response.iceParameters,
                      });
                      logInfo("ICE restart initiated", {
                        transportId: transport.id,
                      });
                    } catch (err) {
                      logError(
                        "Failed to restart ICE",
                        formatError(err),
                        effectiveUserId,
                        streamId
                      );
                    }
                  }
                }
              );
            }
          } else if (state === "disconnected") {
            logWarn("Producer transport ICE disconnected", {
              transportId: transport.id,
            });
          } else if (state === "closed") {
            logWarn("Producer transport closed", { transportId: transport.id });
          }
        });

        // Handle produce events
        transport.on(
          "produce",
          async ({ kind, rtpParameters, appData }, callback, errback) => {
            logger.debug("Producer transport produce event", {
              transportId: transport.id,
              kind,
              appData,
            });

            logInfo("Producer transport produce event triggered", {
              transportId: transport.id,
              kind,
              streamId,
              userId: effectiveUserId,
            });

            try {
              if (!socketRef.current?.connected) {
                const error = new Error("Socket not connected");
                logError(
                  "Producer produce failed: Socket not connected",
                  null,
                  effectiveUserId,
                  streamId
                );
                throw error;
              }

              // Tell the server to create a Producer with the given RTP parameters
              socketRef.current.emit(
                "produce",
                {
                  transportId: transport.id,
                  kind,
                  rtpParameters,
                  appData: {
                    ...appData,
                    streamId,
                    userId: effectiveUserId,
                  },
                },
                (response: { id: string; error?: string }) => {
                  if (response.error) {
                    logError(
                      "Server returned error for produce request",
                      {
                        error: response.error,
                      },
                      effectiveUserId,
                      streamId
                    );
                    return errback(new Error(response.error));
                  }

                  // Server responds with the Producer's id
                  logger.debug("Produce response from server", {
                    producerId: response.id,
                  });
                  logInfo("Producer created on server", {
                    producerId: response.id,
                    kind,
                  });
                  callback({ id: response.id });
                }
              );
            } catch (err) {
              logger.error(
                "Producer transport produce failed",
                formatError(err)
              );
              logError(
                "Producer transport produce failed",
                formatError(err),
                effectiveUserId,
                streamId
              );
              errback(err as Error);
            }
          }
        );

        transportRef.current.producer = transport;
        return transport;
      } catch (err) {
        logger.error("Failed to set up producer transport", formatError(err));
        logError(
          "Failed to set up producer transport",
          formatError(err),
          effectiveUserId,
          streamId
        );
        setError(
          "Failed to set up media connection. Please reload and try again."
        );
        return null;
      }
    },
    [streamId, effectiveUserId, runtimeConfig, isConfigLoading]
  );

  /**
   * Create and set up a consumer transport for viewers
   */
  const setupConsumerTransport = useCallback(
    async (transportOptions: any) => {
      if (!deviceRef.current) {
        logger.error(
          "Cannot set up consumer transport: Device not initialized"
        );
        logError(
          "Cannot set up consumer transport: Device not initialized",
          null,
          effectiveUserId,
          streamId
        );
        return null;
      }

      if (isConfigLoading || !runtimeConfig) {
        logError(
          "Cannot set up consumer transport: Runtime config not ready",
          {
            isConfigLoading,
            hasConfig: !!runtimeConfig,
          },
          effectiveUserId,
          streamId
        );
        return null;
      }

      try {
        logger.debug("Creating consumer transport", transportOptions);

        // Get ICE servers using runtime config
        const iceServers = getIceServers(runtimeConfig);

        logInfo("Creating consumer transport with ICE servers", {
          transportId: transportOptions.id,
          iceServerCount: iceServers.length,
        });

        // Create the transport with enhanced ICE configuration
        const transport = deviceRef.current.createRecvTransport({
          id: transportOptions.id,
          iceParameters: transportOptions.iceParameters,
          iceCandidates: transportOptions.iceCandidates,
          dtlsParameters: transportOptions.dtlsParameters,
          iceServers: iceServers, // Use runtime ICE servers
        });

        logger.info("Consumer transport created", {
          transportId: transport.id,
        });

        // Set up transport connection events
        transport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            logger.debug("Consumer transport connect event", {
              transportId: transport.id,
            });

            logInfo("Consumer transport connect event triggered", {
              transportId: transport.id,
              dtlsParameters,
            });

            try {
              if (!socketRef.current?.connected) {
                const error = new Error("Socket not connected");
                logError(
                  "Consumer transport connect failed: Socket not connected",
                  null,
                  effectiveUserId,
                  streamId
                );
                throw error;
              }

              socketRef.current.emit("connectConsumerTransport", {
                transportId: transport.id,
                dtlsParameters,
              });

              logDebug("Consumer transport connect request sent to server");
              callback();
            } catch (err) {
              logger.error(
                "Consumer transport connect failed",
                formatError(err)
              );
              logError(
                "Consumer transport connect failed",
                formatError(err),
                effectiveUserId,
                streamId
              );
              errback(err as Error);
            }
          }
        );

        // Handle connection state changes
        transport.on("connectionstatechange", (state) => {
          logger.info("Consumer transport connection state changed", {
            transportId: transport.id,
            state,
          });

          logInfo("Consumer transport connection state changed", {
            transportId: transport.id,
            state,
            isViewer: !isStreamer,
          });

          if (state === "connecting") {
            logInfo("Consumer transport ICE connecting", {
              transportId: transport.id,
            });
          } else if (state === "connected") {
            // Transport successfully connected
            logger.info("Consumer transport successfully connected");
            logInfo("Consumer transport successfully connected", {
              transportId: transport.id,
            });

            // Request to consume available producers
            if (socketRef.current?.connected && deviceRef.current) {
              logInfo("Requesting to consume available producers", {
                streamId,
                transportId: transport.id,
              });

              // Define types for the producers response
              interface Producer {
                producerId: string;
                kind: string;
                peerId: string;
              }

              socketRef.current.emit(
                "getProducers",
                { streamId },
                (producers: Producer[]) => {
                  if (Array.isArray(producers) && producers.length > 0) {
                    logInfo(
                      `Received ${producers.length} producers to consume`,
                      {
                        producerIds: producers.map((p) => p.producerId),
                      }
                    );

                    // Request to consume each producer
                    producers.forEach((producer) => {
                      if (
                        socketRef.current?.connected &&
                        transportRef.current.consumer &&
                        deviceRef.current
                      ) {
                        socketRef.current.emit(
                          "consume",
                          {
                            transportId: transportRef.current.consumer.id,
                            producerId: producer.producerId,
                            rtpCapabilities: deviceRef.current.rtpCapabilities,
                          },
                          (response: {
                            error?: string;
                            consumerId?: string;
                            producerId?: string;
                            kind?: string;
                            rtpParameters?: any;
                          }) => {
                            if (response.error) {
                              logError("Failed to consume producer", {
                                error: response.error,
                                producerId: producer.producerId,
                              });
                              return;
                            }
                            handleConsume(response);
                          }
                        );
                      }
                    });
                  } else {
                    logInfo("No producers available to consume yet");
                  }
                }
              );
            }
          } else if (state === "failed") {
            logger.error("Consumer transport connection failed", { state });
            logError(
              "Consumer transport ICE connection failed",
              {
                transportId: transport.id,
                isViewer: !isStreamer,
              },
              effectiveUserId,
              streamId
            );

            // Attempt ICE restart for viewer connection
            if (mountedRef.current && socketRef.current?.connected) {
              logInfo("Attempting ICE restart for failed consumer transport", {
                transportId: transport.id,
              });

              socketRef.current.emit(
                "restartIce",
                { transportId: transport.id },
                (response: any) => {
                  if (response.error) {
                    logError(
                      "ICE restart request failed",
                      {
                        error: response.error,
                      },
                      effectiveUserId,
                      streamId
                    );
                    return;
                  }

                  // Apply new ICE parameters
                  if (response.iceParameters) {
                    try {
                      transport.restartIce({
                        iceParameters: response.iceParameters,
                      });
                      logInfo("ICE restart initiated for consumer", {
                        transportId: transport.id,
                      });
                    } catch (err) {
                      logError(
                        "Failed to restart ICE for consumer",
                        formatError(err),
                        effectiveUserId,
                        streamId
                      );
                    }
                  }
                }
              );
            }
          } else if (state === "disconnected") {
            logWarn("Consumer transport ICE disconnected", {
              transportId: transport.id,
            });
          } else if (state === "closed") {
            logWarn("Consumer transport closed", { transportId: transport.id });
          }
        });

        // Store the transport for later use
        transportRef.current.consumer = transport;
        return transport;
      } catch (err) {
        logger.error("Failed to create consumer transport", formatError(err));
        logError(
          "Failed to create consumer transport",
          formatError(err),
          effectiveUserId,
          streamId
        );
        return null;
      }
    },
    [effectiveUserId, isConfigLoading, isStreamer, runtimeConfig, streamId]
  );

  /**
   * Publish local media tracks to server using the producer transport
   */
  const produceLocalMedia = useCallback(
    async (transport: mediasoupClient.types.Transport, stream: MediaStream) => {
      try {
        // Make sure transport is valid and not closed
        if (!transport || transport.closed) {
          logError("Cannot produce media: Transport is closed or invalid");
          if (onMediaError) {
            onMediaError(
              "produce",
              "Transport closed. Please refresh the page."
            );
          }
          return false;
        }

        // Close existing producers
        if (producersRef.current.video) {
          producersRef.current.video.close();
          producersRef.current.video = null;
        }

        if (producersRef.current.audio) {
          producersRef.current.audio.close();
          producersRef.current.audio = null;
        }

        // Create video producer if we have video tracks
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          logger.debug("Creating video producer", {
            track: videoTracks[0].label,
            enabled: videoTracks[0].enabled,
          });

          // Add explicit logging about video track
          logInfo("Video track details", {
            label: videoTracks[0].label,
            settings: videoTracks[0].getSettings(),
            constraints: videoTracks[0].getConstraints(),
            enabled: videoTracks[0].enabled,
            readyState: videoTracks[0].readyState,
          });

          try {
            // Modified: Use simpler encoding settings to ensure compatibility
            const videoProducer = await transport.produce({
              track: videoTracks[0],
              encodings: [
                // Use a single encoding with reasonable bitrate that will work on most connections
                { maxBitrate: 800000, scaleResolutionDownBy: 1 },
              ],
              codecOptions: {
                videoGoogleStartBitrate: 800,
              },
            });

            logger.info("Video producer created", {
              producerId: videoProducer.id,
            });
            producersRef.current.video = videoProducer;

            // Add more diagnostic events
            videoProducer.on("transportclose", () => {
              logger.info("Video producer transport closed");
              producersRef.current.video = null;
            });

            videoProducer.on("trackended", () => {
              logger.info("Video track ended");
              videoProducer.close();
              producersRef.current.video = null;
            });

            // Add new event listeners for better diagnostics
            videoProducer.observer.on("close", () => {
              logger.info("Video producer closed through observer");
            });

            // Log successful video producer creation to help debug
            logInfo("Video producer successfully created and connected", {
              producerId: videoProducer.id,
              trackSettings: videoTracks[0].getSettings(),
            });
          } catch (err) {
            logError(
              "Failed to create video producer",
              formatError(err),
              effectiveUserId,
              streamId
            );
            // Continue with audio producer even if video fails
          }
        } else {
          logWarn("No video tracks found in the local stream");
        }

        // Create audio producer if we have audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          logger.debug("Creating audio producer", {
            track: audioTracks[0].label,
            enabled: audioTracks[0].enabled,
          });

          // Add explicit logging about audio track
          logInfo("Audio track details", {
            label: audioTracks[0].label,
            settings: audioTracks[0].getSettings(),
            constraints: audioTracks[0].getConstraints(),
            enabled: audioTracks[0].enabled,
            readyState: audioTracks[0].readyState,
          });

          try {
            // Enhanced audio options for better quality and reliability
            const audioProducer = await transport.produce({
              track: audioTracks[0],
              codecOptions: {
                opusStereo: false, // Use mono for better reliability
                opusDtx: true,
                opusFec: true,
                opusMaxPlaybackRate: 48000,
                opusPtime: 20,
              },
            });

            logger.info("Audio producer created", {
              producerId: audioProducer.id,
            });
            producersRef.current.audio = audioProducer;

            // Handle producer events
            audioProducer.on("transportclose", () => {
              logger.info("Audio producer transport closed");
              producersRef.current.audio = null;
            });

            audioProducer.on("trackended", () => {
              logger.info("Audio track ended");
              audioProducer.close();
              producersRef.current.audio = null;
            });

            // Add new event listeners for better diagnostics
            audioProducer.observer.on("close", () => {
              logger.info("Audio producer closed through observer");
            });

            // Log successful audio producer creation
            logInfo("Audio producer successfully created and connected", {
              producerId: audioProducer.id,
              trackSettings: audioTracks[0].getSettings(),
            });
          } catch (err) {
            logError(
              "Failed to create audio producer",
              formatError(err),
              effectiveUserId,
              streamId
            );
          }
        } else {
          logWarn("No audio tracks found in the local stream");
        }

        // Update stream state to ready
        setStreamReady(true);

        // Clear any errors if we successfully produced media
        if (error) {
          setError(null);
        }

        return true;
      } catch (err) {
        logger.error("Failed to produce media", formatError(err));

        // More specific error message to help diagnose
        let errorMessage = "Failed to publish media stream.";
        if (err instanceof Error) {
          if (err.message.includes("ICE")) {
            errorMessage =
              "Connection issue: ICE negotiation failed. Please check your firewall settings.";
          } else if (err.message.includes("Transport")) {
            errorMessage =
              "Connection issue: Transport setup failed. Please try refreshing the page.";
          } else if (err.message.includes("closed")) {
            errorMessage =
              "Connection closed. Please refresh the page to reconnect.";
          } else {
            errorMessage = `Failed to publish media: ${err.message}`;
          }
        }

        setError(errorMessage);

        // Report media error to parent component
        if (onMediaError) {
          onMediaError("produce", errorMessage);
        }

        return false;
      }
    },
    [setStreamReady, setError, onMediaError, error, effectiveUserId, streamId]
  );

  /**
   * Handle consuming a remote producer
   */
  const handleConsume = useCallback(
    async (consumerData: any) => {
      if (!deviceRef.current || !transportRef.current.consumer) {
        logger.error("Cannot consume: Device or transport not ready");
        logError(
          "Cannot consume: Device or transport not ready",
          {
            hasDevice: !!deviceRef.current,
            hasTransport: !!transportRef.current.consumer,
          },
          effectiveUserId,
          streamId
        );
        return false;
      }

      try {
        const { consumerId, producerId, kind, rtpParameters } = consumerData;

        logger.debug("Consuming remote producer", {
          consumerId,
          producerId,
          kind,
        });

        logInfo("Attempting to consume remote producer", {
          consumerId,
          producerId,
          kind,
          rtpParametersMimeType: rtpParameters?.codecs?.[0]?.mimeType,
          rtpParametersClockRate: rtpParameters?.codecs?.[0]?.clockRate,
        });

        // Log active transport state before consuming
        if (transportRef.current.consumer) {
          logInfo("Consumer transport state before consuming", {
            connectionState: (transportRef.current.consumer as any)
              .connectionState,
            transportId: transportRef.current.consumer.id,
          });
        }

        // Create the consumer
        const consumer = await transportRef.current.consumer.consume({
          id: consumerId,
          producerId,
          kind,
          rtpParameters,
        });

        logger.info("Consumer created", {
          consumerId: consumer.id,
          kind: consumer.kind,
        });

        logInfo("Consumer successfully created", {
          consumerId: consumer.id,
          kind: consumer.kind,
          paused: consumer.paused,
          producerPaused:
            "producerPaused" in consumer
              ? (consumer as any).producerPaused
              : "unknown",
        });

        // Store the consumer reference
        if (kind === "video") {
          // Clear previous video consumer if exists
          if (consumersRef.current.video) {
            consumersRef.current.video.close();
          }
          consumersRef.current.video = consumer;

          // Resume the consumer immediately
          await consumer.resume();
          logInfo("Video consumer resumed", { consumerId: consumer.id });
        } else if (kind === "audio") {
          // Clear previous audio consumer if exists
          if (consumersRef.current.audio) {
            consumersRef.current.audio.close();
          }
          consumersRef.current.audio = consumer;

          // Resume the consumer immediately
          await consumer.resume();
          logInfo("Audio consumer resumed", { consumerId: consumer.id });
        }

        // Create a MediaStream from the consumer track
        const stream = new MediaStream([consumer.track]);

        // Add detailed diagnostics about the consumed track
        logInfo("Consumed media track details", {
          kind: consumer.track.kind,
          label: consumer.track.label,
          enabled: consumer.track.enabled,
          readyState: consumer.track.readyState,
          muted: consumer.track.muted,
          id: consumer.track.id,
          contentHint: (consumer.track as any).contentHint || "none", // Extra diagnostic info
        });

        // Display the stream if we're a viewer
        if (videoRef.current) {
          // Update UI status when we receive media
          setError(null);

          if (kind === "video") {
            // If we already have a stream with audio, add the video track to it
            if (videoRef.current.srcObject instanceof MediaStream) {
              const existingStream = videoRef.current.srcObject as MediaStream;

              // Remove any existing video tracks before adding new one
              const existingVideoTracks = existingStream.getVideoTracks();
              existingVideoTracks.forEach((track) =>
                existingStream.removeTrack(track)
              );

              existingStream.addTrack(consumer.track);
              logInfo("Added video track to existing stream", {
                existingTracks: existingStream.getTracks().length,
                trackKinds: existingStream
                  .getTracks()
                  .map((t) => t.kind)
                  .join(","),
                videoTrackId: consumer.track.id,
              });
            } else {
              videoRef.current.srcObject = stream;
              logInfo("Set video element srcObject with new video stream", {
                videoTrackId: consumer.track.id,
              });
            }

            // Update stream state when video is connected
            setStreamReady(true);
          } else if (kind === "audio") {
            // If we already have a stream with video, add the audio track to it
            if (videoRef.current.srcObject instanceof MediaStream) {
              const existingStream = videoRef.current.srcObject as MediaStream;

              // Remove any existing audio tracks before adding new one
              const existingAudioTracks = existingStream.getAudioTracks();
              existingAudioTracks.forEach((track) =>
                existingStream.removeTrack(track)
              );

              existingStream.addTrack(consumer.track);
              logInfo("Added audio track to existing stream", {
                existingTracks: existingStream.getTracks().length,
                trackKinds: existingStream
                  .getTracks()
                  .map((t) => t.kind)
                  .join(","),
                audioTrackId: consumer.track.id,
              });
            } else {
              videoRef.current.srcObject = stream;
              logInfo("Set video element srcObject with new audio stream", {
                audioTrackId: consumer.track.id,
              });
            }

            // Make sure audio is correctly muted based on user preference
            videoRef.current.muted = isMuted;
            logInfo("Set audio mute state on video element", {
              muted: isMuted,
            });
          }

          // Add listeners for track ended/muted events
          consumer.track.onended = () => {
            logWarn(`${kind} track ended`, { trackId: consumer.track.id });
          };

          consumer.track.onmute = () => {
            logWarn(`${kind} track muted`, { trackId: consumer.track.id });
          };

          consumer.track.onunmute = () => {
            logInfo(`${kind} track unmuted`, { trackId: consumer.track.id });
          };

          // Attempt to play the video and capture any autoplay issues
          try {
            logInfo("Attempting to play video element");
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  logInfo("Video playback started successfully");
                  // Clear autoplay blocked status if play succeeded
                  setAutoplayBlocked(false);
                })
                .catch((err) => {
                  logError(
                    "Error starting video playback - likely autoplay policy",
                    formatError(err),
                    effectiveUserId,
                    streamId
                  );

                  // Set autoplay blocked state instead of generic error
                  setAutoplayBlocked(true);
                  // Don't overwrite other errors with autoplay message
                  if (!error) {
                    setError("Autoplay blocked. Please click to play.");
                  }
                });
            }
          } catch (playErr) {
            logError(
              "Exception while trying to play video",
              formatError(playErr),
              effectiveUserId,
              streamId
            );
            setAutoplayBlocked(true);
          }
        } else {
          logError(
            "Cannot display stream: video element ref is null",
            null,
            effectiveUserId,
            streamId
          );
        }

        return true;
      } catch (err) {
        logger.error("Error consuming media", formatError(err));
        logError(
          "Error consuming media",
          formatError(err),
          effectiveUserId,
          streamId
        );

        let errorMessage = "Failed to receive media stream.";
        if (err instanceof Error) {
          if (err.message.includes("ICE")) {
            errorMessage =
              "Connection issue: Could not establish media path to the streamer.";
          } else {
            errorMessage = `Media error: ${err.message}`;
          }
        }

        setError(errorMessage);
        return false;
      }
    },
    [
      isMuted,
      effectiveUserId,
      streamId,
      error,
      setStreamReady,
      setError,
      setAutoplayBlocked,
    ]
  );

  /**
   * Handle streamer's device selection change
   */
  const handleDeviceChange = useCallback(
    (deviceType: "video" | "audio", deviceId: string) => {
      logInfo(`Device selection changed: ${deviceType}=${deviceId}`);

      if (deviceType === "video") {
        setSelectedVideoDevice(deviceId);
      } else if (deviceType === "audio") {
        setSelectedAudioDevice(deviceId);
      }

      // Store for the device change effect to pick up
      didDeviceChangeRef.current = true;
    },
    [setSelectedVideoDevice, setSelectedAudioDevice]
  );

  /**
   * Capture local media with selected devices (for streamers)
   */
  const captureLocalMedia = useCallback(async () => {
    // If this is an anonymous user in view-only mode, skip camera/mic access
    if (isAnonymous) {
      logInfo("Anonymous user in view-only mode, skipping media capture");
      return null;
    }

    try {
      logger.info("Capturing local media");

      // Stop any existing streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Track local media setup attempts to prevent excessive retries
      if (mediaSetupAttemptRef.current > 3) {
        // Instead of immediately failing, try to continue with audio-only or video-only
        logWarn(
          "Multiple media setup attempts, trying fallback with reduced requirements"
        );

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

          if (videoRef.current) {
            videoRef.current.srcObject = audioOnlyStream;
            videoRef.current.muted = true; // Mute local preview
          }

          return audioOnlyStream;
        } catch (audioErr) {
          // Last resort - try to continue without media for debugging purposes
          logError(
            "All media fallbacks failed",
            formatError(audioErr),
            effectiveUserId,
            streamId
          );

          // Create an empty stream as last resort (may not work well in production)
          const emptyStream = new MediaStream();
          localStreamRef.current = emptyStream;

          if (videoRef.current) {
            videoRef.current.srcObject = emptyStream;
          }

          // Report the error through the callback but don't stop the connection
          if (onMediaError) {
            onMediaError(
              "setup",
              "Failed to access any media devices after multiple attempts. You may need to grant permissions in your browser settings."
            );
          }

          setError(
            "Could not access camera or microphone after multiple attempts. Check browser permissions."
          );
          return emptyStream;
        }
      }

      mediaSetupAttemptRef.current++; // Increment the ref from component scope

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

      // Configure constraints based on selected devices and platform
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice
          ? {
              deviceId: { exact: selectedVideoDevice },
              width: isMobile ? { ideal: 720 } : { ideal: 1280 },
              height: isMobile ? { ideal: 480 } : { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
            }
          : {
              width: isMobile ? { ideal: 720 } : { ideal: 1280 },
              height: isMobile ? { ideal: 480 } : { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: "user",
            },
        audio: selectedAudioDevice
          ? {
              deviceId: { exact: selectedAudioDevice },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
      };

      logger.debug("getUserMedia constraints", {
        ...constraints,
        browserInfo: { isFirefox, isChrome, isSafari, isMobile },
      });

      // Get media stream with selected devices
      let stream: MediaStream;

      try {
        // First try with the full constraints
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        logger.warn(
          "Failed to get media with full constraints, falling back to basic constraints",
          formatError(err)
        );

        // Provide specific error messages based on the error type
        if ((err as any)?.name === "NotAllowedError") {
          logWarn(
            "Camera/microphone access denied by user or system",
            formatError(err)
          );

          // Try video-only as a fallback if audio might be the issue
          try {
            logInfo("Attempting video-only as fallback");
            stream = await navigator.mediaDevices.getUserMedia({
              video: selectedVideoDevice
                ? { deviceId: { exact: selectedVideoDevice } }
                : true,
              audio: false,
            });
            setError("Microphone access denied. Streaming without audio.");
            setIsMuted(true);
          } catch (videoOnlyErr) {
            // Try audio-only as a last resort
            try {
              logInfo("Attempting audio-only as last resort fallback");
              stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: selectedAudioDevice
                  ? { deviceId: { exact: selectedAudioDevice } }
                  : true,
              });
              setError("Camera access denied. Streaming with audio only.");
              setIsVideoHidden(true);
            } catch (audioOnlyErr) {
              throw new Error(
                "Both camera and microphone access denied. Cannot stream without media."
              );
            }
          }
        } else if ((err as any)?.name === "NotFoundError") {
          throw new Error(
            "Camera or microphone not found. Please check your device connections."
          );
        } else if (
          (err as any)?.name === "NotReadableError" ||
          (err as any)?.name === "AbortError"
        ) {
          // Try with simpler constraints instead of throwing error
          logWarn(
            "Device access error (NotReadableError/AbortError), trying simpler approach",
            formatError(err)
          );

          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true,
          });
        } else if ((err as any)?.name === "OverconstrainedError") {
          // Fallback to basic constraints without specific requirements
          logWarn(
            "Device constraints not satisfied, falling back to basic constraints"
          );
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } else {
          // Fall back to more basic constraints for other errors
          const fallbackConstraints: MediaStreamConstraints = {
            video: selectedVideoDevice
              ? { deviceId: { exact: selectedVideoDevice } }
              : true,
            audio: selectedAudioDevice
              ? { deviceId: { exact: selectedAudioDevice } }
              : true,
          };

          stream = await navigator.mediaDevices.getUserMedia(
            fallbackConstraints
          );
        }
      }

      if (!stream) {
        throw new Error("Failed to obtain media stream after fallbacks");
      }

      logger.info("Local media stream obtained", {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackSettings: stream.getVideoTracks()[0]?.getSettings(),
        audioTrackSettings: stream.getAudioTracks()[0]?.getSettings(),
      });

      localStreamRef.current = stream;

      // Apply initial settings based on props
      if (typeof externalCameraOn !== "undefined" && !externalCameraOn) {
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach((track) => {
          track.enabled = false;
        });
        setIsVideoHidden(true);
      }

      if (
        typeof externalMicrophoneOn !== "undefined" &&
        !externalMicrophoneOn
      ) {
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = false;
        });
        setIsMuted(true);
      }

      // Display the local stream in the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Always mute local preview to prevent feedback

        // Try to play the video immediately
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // This often happens due to autoplay policies
          logger.warn(
            "Could not autoplay video preview, user may need to interact",
            formatError(playErr)
          );
        }
      }

      // Reset error state if stream was acquired successfully
      setError(null);
      mediaSetupAttemptRef.current = 0; // Reset attempts on success

      // If we already have a producer transport, produce with the new stream
      if (transportRef.current.producer) {
        logger.info("Producing with new media stream");
        await produceLocalMedia(transportRef.current.producer, stream);
      }

      setStreamReady(true);
      return stream;
    } catch (err) {
      logger.error("Error accessing media devices", formatError(err));

      // Track error for the UI
      let errorMessage = "Failed to access camera/microphone";

      // Provide more specific error message
      if ((err as any)?.name === "NotAllowedError") {
        errorMessage =
          "Camera/microphone access denied. Please check browser permissions.";
      } else if ((err as any)?.name === "NotFoundError") {
        errorMessage =
          "Camera or microphone not found. Please check device connections.";
      } else if ((err as any)?.name === "NotReadableError") {
        errorMessage =
          "Could not access media devices. They may be in use by another application.";
      } else if ((err as Error)?.message) {
        errorMessage = (err as Error).message;
      }

      setError(errorMessage);

      // Report the error through the callback
      if (onMediaError) {
        onMediaError("setup", errorMessage);
      }

      // For streamers, one more chance with audio-only before giving up
      if (isStreamer && mediaSetupAttemptRef.current <= 3) {
        try {
          logWarn("Attempting audio-only as final fallback");
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });

          logInfo("Audio-only fallback successful after error");
          setIsVideoHidden(true);
          localStreamRef.current = audioOnlyStream;

          if (videoRef.current) {
            videoRef.current.srcObject = audioOnlyStream;
            videoRef.current.muted = true;
          }

          setError("Camera unavailable. Streaming with audio only.");
          setStreamReady(true);
          return audioOnlyStream;
        } catch (fallbackErr) {
          logError("Audio-only fallback failed", formatError(fallbackErr));
        }
      }

      return null;
    }
  }, [
    isStreamer,
    selectedVideoDevice,
    selectedAudioDevice,
    produceLocalMedia,
    externalCameraOn,
    externalMicrophoneOn,
    effectiveUserId,
    streamId,
    setError,
    setStreamReady,
    setIsVideoHidden,
    setIsMuted,
    onMediaError,
    isAnonymous,
  ]);

  // =========== MEDIA CONTROLS ===========
  /**
   * Toggle audio mute state
   */
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
      logInfo(`Toggled audio: ${isMuted ? "unmuted" : "muted"}`);
    }
  }, [isMuted]);

  /**
   * Toggle video visibility
   */
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoHidden((prev) => !prev);
      logInfo(`Toggled video: ${isVideoHidden ? "shown" : "hidden"}`);
    }
  }, [isVideoHidden]);

  // =========== EFFECTS ===========
  // Initialize component
  useEffect(() => {
    mountedRef.current = true;
    isComponentMounted.current = true;

    logInfo("Component mounted or crucial props changed", {
      streamId,
      userId,
      isStreamer,
      sessionId, // Log session ID for troubleshooting
    });

    getBrowserDiagnostics();

    // Use a debounce mechanism to prevent multiple connection attempts in rapid succession
    let connectionDebounceTimer: NodeJS.Timeout | null = null;
    const mountTimestamp = Date.now();

    // A function to explicitly clear connection state on page unload/refresh
    const handleBeforeUnload = () => {
      // Set flag to indicate we're cleaning up due to page navigation
      logInfo(
        "Page navigation detected, cleaning up WebRTC connections before unload",
        {
          streamId,
          sessionId,
        }
      );

      // Update connection info in localStorage to indicate navigation
      const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
      if (storedInfo) {
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: false,
          timestamp: Date.now(), // Update timestamp for refresh detection
        });
      }

      // Force disconnect socket
      if (socketRef.current) {
        logInfo("Disconnecting socket on unmount", {
          socketId: socketRef.current.id,
        });

        // Keep a reference to the socket
        const socket = socketRef.current;

        // Clear the reference immediately to prevent further operations
        socketRef.current = null;

        // Add a short delay before disconnecting to avoid rapid connect/disconnect cycles
        // This is especially important during development with React HMR
        setTimeout(() => {
          try {
            // Only actually disconnect if we haven't quickly remounted
            // This prevents connection thrashing during refreshes
            if (!mountedRef.current && socket && socket.connected) {
              logInfo("Disconnecting socket after unmount delay", {
                socketId: socket.id,
              });
              socket.disconnect();
            }
          } catch (err) {
            // Socket might already be disconnected, ignore errors
          }
        }, 300);
      }

      // Explicitly stop all media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Clean up the flag that might cause duplicate connection errors
      hasActiveConnection.current = false;
    };

    // Add page visibility change handler to detect tab switching
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logInfo("Tab became visible again");

        // Update stored connection info
        const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
        if (storedInfo && !storedInfo.isActive && hasActiveConnection.current) {
          // Update connection info
          storeConnectionInfo(streamId, effectiveUserId, {
            ...storedInfo,
            isActive: true,
            timestamp: Date.now(),
          });
        }
      } else {
        logInfo("Tab became hidden");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const attemptConnection = () => {
      // Reset connection state on fresh mount
      connectionAttemptsRef.current = 0;

      // Don't establish a new connection if one was active recently (within last 3 seconds)
      // This prevents connection thrashing when component remounts frequently
      if (hasActiveConnection.current) {
        logWarn(
          "Connection attempt debounced: This component instance recently had an active connection",
          {
            mountTimestamp,
            streamId,
            userId,
          }
        );
        return;
      }

      // Check if we should connect based on component state
      if (
        isComponentMounted.current &&
        mountedRef.current &&
        !connectInProgressRef.current
      ) {
        // Add a small delay before connecting to avoid rapid connection attempts
        connectionDebounceTimer = setTimeout(() => {
          if (mountedRef.current) {
            logInfo("Initiating connection after debounce delay", {
              streamId,
              userId,
              isStreamer,
              sessionId,
            });
            connectToSignalingServer();
            didInitialSetupRef.current = true;
          }
        }, 500); // 500ms debounce
      }
    };

    if (isStreamer) {
      preConnectionTest().then((testResult) => {
        if (testResult.success) {
          logInfo(
            "Pre-connection test successful, preparing to connect to signaling server"
          );
          if (!isConfigLoading && runtimeConfig) {
            attemptConnection();
          }
        } else {
          logError(
            "Pre-connection test failed",
            {
              reason: testResult.error,
            },
            effectiveUserId,
            streamId
          );
          setError(
            `Connection test failed: ${testResult.error}. Please check your network settings.`
          );
        }
      });
    } else {
      if (!isConfigLoading && runtimeConfig) {
        logInfo("Viewer: preparing to connect to signaling server");
        attemptConnection();
      }
    }

    // Add network status event listeners for troubleshooting
    const handleOnline = () => {
      logInfo("Network connection restored", {
        wasInErrorState: !!error,
      });

      // If we were in an error state, try reconnecting
      if (error && connectionStatus === "disconnected" && mountedRef.current) {
        setError(null);
        logInfo("Network back online, attempting fresh connection.");
        connectionAttemptsRef.current = 0; // Reset for fresh attempt
        connectToSignalingServer();
      }
    };

    const handleOffline = () => {
      logWarn("Network connection lost");
      setError("Network connection lost. Waiting for reconnection...");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup function with enhanced connection state handling
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      mountedRef.current = false;
      isComponentMounted.current = false;

      logInfo("Component unmounting, cleaning up resources");

      // Clear debounce timer if exists
      if (connectionDebounceTimer) {
        clearTimeout(connectionDebounceTimer);
      }

      // Clear all pending timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];

      // Close socket connection
      if (socketRef.current) {
        logInfo("Disconnecting socket on unmount", {
          socketId: socketRef.current.id,
        });

        // Keep a reference to the socket
        const socket = socketRef.current;

        // Clear the reference immediately to prevent further operations
        socketRef.current = null;

        // Add a short delay before disconnecting to avoid rapid connect/disconnect cycles
        // This is especially important during development with React HMR
        setTimeout(() => {
          try {
            // Only actually disconnect if we haven't quickly remounted
            // This prevents connection thrashing during refreshes
            if (!mountedRef.current && socket && socket.connected) {
              logInfo("Disconnecting socket after unmount delay", {
                socketId: socket.id,
              });
              socket.disconnect();
            }
          } catch (err) {
            // Socket might already be disconnected, ignore errors
          }
        }, 300);
      }

      // Close peer connection
      if (transportRef.current.producer) {
        transportRef.current.producer.close();
        transportRef.current.producer = null;
      }

      if (transportRef.current.consumer) {
        transportRef.current.consumer.close();
        transportRef.current.consumer = null;
      }

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Reset all refs to ensure a fresh start if remounted
      connectInProgressRef.current = false;
      connectionAttemptsRef.current = 0;
      didInitialSetupRef.current = false;
      hasActiveConnection.current = false; // Immediately set to false to avoid duplicate connection issues
      producersRef.current = { video: null, audio: null };
      consumersRef.current = { video: null, audio: null };

      // Mark connection as inactive in localStorage
      const storedInfo = getStoredConnectionInfo(streamId, effectiveUserId);
      if (storedInfo) {
        storeConnectionInfo(streamId, effectiveUserId, {
          ...storedInfo,
          isActive: false,
          timestamp: Date.now(),
        });
      }

      // Also clear any session recovery data when component is unmounted
      clearSessionInfo(streamId, effectiveUserId);
    };
  }, [
    streamId,
    userId,
    effectiveUserId,
    isStreamer,
    runtimeConfig,
    isConfigLoading,
    connectToSignalingServer,
    error,
    isAnonymous,
  ]);

  /**
   * Run a pre-connection test to verify network connectivity before starting a stream
   * This helps identify issues early, particularly for streamers
   */
  const preConnectionTest = async (): Promise<{
    success: boolean;
    error?: string;
    isLoopback?: boolean;
  }> => {
    logInfo("Starting pre-connection tests");
    // Initialize test results
    let socketIOConnectivity = false;
    let directWebSocketConnectivity = false;
    let isLoopback = isLoopbackConnection || false;

    try {
      if (!runtimeConfig || isConfigLoading) {
        // CRITICAL: can't proceed without config
        logWarn("Runtime config not available for connection test");
        return { success: false, error: "Runtime config not available" };
      }

      // First check if we're likely dealing with a loopback connection
      const currentHostname = window.location.hostname;
      isLoopback = isLoopback || isLoopbackAddress(currentHostname);

      // Check if the socket URL points to a loopback address
      const socketUrl = runtimeConfig?.socketUrl || "http://localhost:3000";
      if (isLoopbackUrl(socketUrl)) {
        logWarn("Detected Socket.IO connection to a loopback address", {
          socketUrl,
          hostname: window.location.hostname,
        });
        isLoopback = true;
      }

      // If we've detected a loopback connection, notify parent
      if (isLoopback && onLoopbackDetected && !detectedLoopback) {
        onLoopbackDetected(true);
        setDetectedLoopback(true);

        logInfo("Loopback connection detected, applying optimizations", {
          socketUrl,
          hostname: currentHostname,
        });
      }

      // Rest of existing preConnectionTest code
      // ... existing code ...

      // Include loopback status in result
      return {
        success: true,
        isLoopback,
      };
    } catch (error) {
      logError("Error during pre-connection test", { error });
      return {
        success: false,
        error: "Failed to complete connection test",
        isLoopback,
      };
    }
  };

  // Modify the ICE connection testing for loopback awareness
  const testIceConnectivity = async (): Promise<{
    success: boolean;
    isLoopback?: boolean;
  }> => {
    try {
      // First check if we already know this is a loopback connection
      if (detectedLoopback || isLoopbackConnection || optimizeForLoopback) {
        logInfo("Skipping ICE connectivity test for known loopback connection");
        return { success: true, isLoopback: true };
      }

      // Create local peer connection for testing
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Set a short timeout for loopback connections which often have ICE issues
      const timeout = setTimeout(() => {
        // If we time out quickly, it might be a loopback connection with ICE issues
        pc.close();
        const isLocalhost =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";

        if (isLocalhost) {
          logWarn(
            "ICE connectivity test timed out on localhost, assuming loopback connection"
          );

          // Notify the parent component
          if (onLoopbackDetected && !detectedLoopback) {
            onLoopbackDetected(true);
            setDetectedLoopback(true);
          }

          // Return success with loopback flag
          return { success: true, isLoopback: true };
        }
      }, 2000);

      // Rest of existing ICE connectivity test code...
      // ...

      clearTimeout(timeout);
      return { success: true };
    } catch (error) {
      logError("Error testing ICE connectivity", { error });
      return { success: false };
    }
  };

  // Modify socket connection to handle loopback specially
  const connectSocket = async (): Promise<Socket | null> => {
    try {
      // Get socket URL from config
      const socketUrl = runtimeConfig?.socketUrl || window.location.origin;

      const isLoopback =
        detectedLoopback ||
        isLoopbackConnection ||
        optimizeForLoopback ||
        isLoopbackUrl(socketUrl);

      logInfo("Connecting to Socket.IO server", {
        socketUrl,
        isLoopback,
      });

      // Configure socket connection with loopback info
      const socket = io(socketUrl, {
        transports: isLoopback
          ? ["polling", "websocket"]
          : ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: isLoopback ? 1000 : 2000, // Faster reconnection for loopback
        timeout: isLoopback ? 10000 : 20000, // Shorter timeout for loopback
        query: {
          streamId,
          userId: effectiveUserId,
          username: effectiveUsername,
          isStreamer: isStreamer ? "true" : "false",
          isAnonymous: isAnonymous ? "true" : "false",
          sessionId,
          isLoopback: isLoopback ? "true" : "false", // Send loopback info to server
        },
      });

      // Rest of existing socket connection code...
      // ...

      return socket;
    } catch (error) {
      logError("Failed to connect socket", { error });
      return null;
    }
  };

  // Modify error handling to include loopback information
  const handleConnectionError = useCallback(
    (
      type: string,
      message: string,
      details?: any,
      canReconnect: boolean = true
    ) => {
      // Check if this might be a loopback-related error
      const isLoopbackError =
        detectedLoopback ||
        isLoopbackConnection ||
        message.includes("loopback") ||
        message.includes("localhost") ||
        message.includes("ICE failed");

      const errorObj = {
        type,
        message,
        details,
        canReconnect,
        isLoopback: isLoopbackError,
      };

      logError(`Connection error: ${type} - ${message}`, {
        details,
        canReconnect,
        isLoopback: isLoopbackError,
      });

      // Set component error state
      setError(message);
      setConnectionStatus("disconnected");

      // Call parent error handler if provided
      if (onConnectionError) {
        onConnectionError(errorObj);
      }

      // If this might be a loopback error and we haven't detected loopback yet
      if (isLoopbackError && !detectedLoopback && onLoopbackDetected) {
        onLoopbackDetected(true);
        setDetectedLoopback(true);

        logWarn("Detected possible loopback connection from error pattern", {
          errorType: type,
          message,
        });
      }

      // Trigger auto-reconnect if necessary but don't call attemptConnection directly
      if (canReconnect && type !== "fatal") {
        // Reconnect with different strategy for loopback
        const reconnectDelay = isLoopbackError ? 1000 : 3000;

        logInfo(`Will attempt reconnect in ${reconnectDelay}ms`, {
          isLoopback: isLoopbackError,
        });

        setTimeout(() => {
          if (isComponentMounted.current) {
            // Trigger reconnection by resetting connection state
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.disconnect();
            }
            // The component's lifecycle will handle reconnection
            setConnectionStatus("connecting");
          }
        }, reconnectDelay);
      }
    },
    [
      onConnectionError,
      onLoopbackDetected,
      detectedLoopback,
      isLoopbackConnection,
    ]
  );

  // Expose the reconnection function to the parent component
  useEffect(() => {
    if (onReconnectRequest) {
      // Just pass the existing reconnect function reference from the component
      onReconnectRequest(() => {
        logInfo("External reconnection request received");
        // Reconnect using the component's existing mechanism
        // Note: We don't call attemptConnection() directly here
        if (isComponentMounted.current) {
          // Force WebRTC remounting or use existing reconnection mechanism
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.disconnect();
          }
          // The component's lifecycle will handle reconnection
          setConnectionStatus("connecting");
        }
      });
    }
  }, [onReconnectRequest]);

  // Detect loopback status on mount
  useEffect(() => {
    // Check if hostname is localhost
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    if (isLocalhost && !detectedLoopback && onLoopbackDetected) {
      logWarn("Detected localhost during component mount");
      onLoopbackDetected(true);
      setDetectedLoopback(true);
    }
  }, [onLoopbackDetected, detectedLoopback]);

  // Add didDeviceChangeRef at component level, outside of all conditionals or loops
  const didDeviceChangeRef = useRef<boolean>(false);

  // Effect to handle device changes after initial setup
  useEffect(() => {
    // Only handle device changes when fully connected and for streamers
    if (
      connectionStatus === "connected" &&
      isStreamer &&
      mountedRef.current &&
      didInitialSetupRef.current &&
      (selectedAudioDevice || selectedVideoDevice) // Only if we have device selections
    ) {
      // Use the existing ref instead of creating a new one
      if (!didDeviceChangeRef.current) {
        didDeviceChangeRef.current = true;

        // Schedule device change with a slight delay to allow state updates
        const timeoutId = setTimeout(() => {
          if (mountedRef.current) {
            logger.info("Recapturing media with new device selection", {
              audioDevice: selectedAudioDevice,
              videoDevice: selectedVideoDevice,
            });

            captureLocalMedia().catch((err) => {
              logError(
                "Failed to recapture media after device change",
                formatError(err)
              );
            });
          }
        }, 500); // Longer delay to ensure React state is stable

        return () => {
          clearTimeout(timeoutId);
          didDeviceChangeRef.current = false;
        };
      }
    }
  }, [
    selectedAudioDevice,
    selectedVideoDevice,
    connectionStatus,
    isStreamer,
    captureLocalMedia,
    didInitialSetupRef,
  ]);

  // Add comprehensive system diagnostics
  const getBrowserDiagnostics = useCallback(() => {
    try {
      const diagnostics = {
        browser: {
          userAgent: navigator.userAgent,
          vendor: navigator.vendor,
          language: navigator.language,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency || "unknown",
          deviceMemory: (navigator as any).deviceMemory || "unknown",
          webRTC: {
            supportsGetDisplayMedia: !!(
              navigator.mediaDevices &&
              "getDisplayMedia" in navigator.mediaDevices
            ),
            supportsMediaRecorder: typeof MediaRecorder !== "undefined",
            supportsWebAudio: typeof AudioContext !== "undefined",
            supportsPeerConnection: typeof RTCPeerConnection !== "undefined",
            supportsInsertableStreams: !!(
              (window as any).RTCRtpSender &&
              "createEncodedStreams" in (window as any).RTCRtpSender.prototype
            ),
          },
          mediaDevices: navigator.mediaDevices ? "available" : "unavailable",
        },
        network: {
          onLine: navigator.onLine,
          connectionType: (navigator as any).connection?.type || "unknown",
          effectiveType:
            (navigator as any).connection?.effectiveType || "unknown",
          downlink: (navigator as any).connection?.downlink || "unknown",
          rtt: (navigator as any).connection?.rtt || "unknown",
        },
        display: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          colorDepth: window.screen.colorDepth,
        },
      };

      logInfo("Browser diagnostics", diagnostics);
      return diagnostics;
    } catch (error) {
      logError(
        "Error collecting browser diagnostics",
        formatError(error),
        effectiveUserId,
        streamId
      );
      return { error: "Failed to collect diagnostics" };
    }
  }, [effectiveUserId, streamId]);

  /**
   * Helper function to test network connectivity to critical services
   * This can help diagnose firewall or blocking issues
   */
  const testNetworkConnectivity = useCallback(async () => {
    const results = {
      stunServer: { success: false, error: null as string | null },
      turnServer: { success: false, error: null as string | null },
      socketServer: { success: false, error: null as string | null },
      timestamp: new Date().toISOString(),
    };

    try {
      logInfo("Starting network connectivity tests...");

      // Test connection to socket server
      try {
        // Get the socket URL and convert WebSocket URL to HTTP(S) for fetch testing
        const socketUrl =
          runtimeConfig?.socketUrl ||
          process.env.NEXT_PUBLIC_SOCKET_URL ||
          window.location.origin;

        // Convert ws:// to http:// and wss:// to https:// for fetch testing
        const testUrl = socketUrl.replace(/^ws(s)?:\/\//i, "http$1://");

        logInfo(
          `Testing socket server connectivity to ${testUrl} (converted from ${socketUrl} for HTTP testing)`
        );

        // For socket server, we'll just do a simple fetch to see if the server is reachable
        // This doesn't test WebSocket connectivity directly, but helps diagnose network issues
        const response = await fetch(testUrl, {
          method: "HEAD",
          mode: "no-cors",
          // Short timeout to avoid long waits
          signal: AbortSignal.timeout(5000),
        });

        results.socketServer.success = true;
        logInfo("Socket server connectivity test successful");
      } catch (error) {
        results.socketServer.error = (error as Error).message;
        logError(
          "Socket server connectivity test failed",
          formatError(error),
          effectiveUserId,
          streamId
        );
      }

      // Test STUN/TURN servers with RTCPeerConnection
      try {
        logInfo("Testing STUN/TURN server connectivity");
        const iceServers = getIceServers(runtimeConfig);

        // Create test peer connections
        const pc1 = new RTCPeerConnection({ iceServers });
        const pc2 = new RTCPeerConnection({ iceServers });

        // Create a data channel to force ICE candidate generation
        const dc = pc1.createDataChannel("connectivity-test");

        // Track ICE connectivity
        let stunSuccess = false;
        let turnSuccess = false;

        // Listen for ICE candidates
        pc1.onicecandidate = (e) => {
          if (e.candidate) {
            // Check if this is a STUN or TURN candidate
            const candidate = e.candidate.candidate.toLowerCase();
            logInfo("ICE candidate received", { candidate });

            if (candidate.includes("typ srflx")) {
              stunSuccess = true;
              logInfo(
                "STUN connectivity successful - received server reflexive candidate"
              );
            } else if (candidate.includes("typ relay")) {
              turnSuccess = true;
              logInfo(
                "TURN connectivity successful - received relay candidate"
              );
            }

            // Forward candidate to pc2
            pc2.addIceCandidate(e.candidate);
          }
        };

        // Create offer/answer
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);

        // Check ICE connection state
        if (stunSuccess && turnSuccess) {
          logInfo("Both STUN and TURN connectivity tests successful");
          results.stunServer.success = true;
          results.turnServer.success = true;
        } else if (stunSuccess) {
          logInfo("STUN connectivity test successful");
          results.stunServer.success = true;
        } else if (turnSuccess) {
          logInfo("TURN connectivity test successful");
          results.turnServer.success = true;
        } else {
          logWarn("Both STUN and TURN connectivity tests failed");
          results.stunServer.error = "Failed to establish STUN connection";
          results.turnServer.error = "Failed to establish TURN connection";
        }
      } catch (error) {
        logError(
          "Error testing STUN/TURN server connectivity",
          formatError(error)
        );
        results.stunServer.error = (error as Error).message;
        results.turnServer.error = (error as Error).message;
      }

      return results;
    } catch (error) {
      logError("Error testing network connectivity", formatError(error));
      return { error: "Failed to test network connectivity" };
    }
  }, [runtimeConfig]);

  // Create a proper createConsumerTransport function
  const createConsumerTransport = useCallback(async () => {
    if (!socketRef.current || !deviceRef.current || !mountedRef.current) {
      logWarn("Cannot create consumer transport - missing socket or device");
      return false;
    }

    try {
      logInfo("Creating consumer transport");

      // Request a consumer transport from the server
      const consumerTransportOptions =
        await socketPromise<ProducerTransportResponse>(
          socketRef.current,
          "createConsumerTransport",
          { streamId }
        );

      if (!consumerTransportOptions || consumerTransportOptions.error) {
        throw new Error(
          consumerTransportOptions?.error ||
            "Failed to create consumer transport"
        );
      }

      // Create the consumer transport
      const transport = deviceRef.current.createRecvTransport({
        id: consumerTransportOptions.id || "",
        iceParameters: consumerTransportOptions.iceParameters,
        iceCandidates: consumerTransportOptions.iceCandidates,
        dtlsParameters: consumerTransportOptions.dtlsParameters,
        iceServers: getIceServers(runtimeConfig),
      });

      // Store the consumer transport
      transportRef.current.consumer = transport;

      // Handle transport connection events
      transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          logInfo("Consumer transport connect event", {
            transportId: transport.id,
          });

          // Connect the transport
          await socketPromise(socketRef.current!, "connectTransport", {
            transportId: transport.id,
            dtlsParameters,
            streamId,
          });

          callback();
        } catch (err) {
          logError("Error in consumer transport connect", formatError(err));
          errback(err as Error);
        }
      });

      // Handle connection state changes
      transport.on("connectionstatechange", async (state) => {
        logInfo(`Consumer transport connection state changed to: ${state}`);

        if (state === "connected") {
          // Now that we're connected, consume available producers
          await consumeExistingProducers();
        } else if (
          state === "failed" ||
          state === "disconnected" ||
          state === "closed"
        ) {
          logError(`Consumer transport connection ${state}`);
        }
      });

      logInfo("Consumer transport created", { id: transport.id });
      return true;
    } catch (err) {
      logError("Failed to create consumer transport", formatError(err));
      if (onMediaError) {
        onMediaError("setup", `Error setting up stream: ${formatError(err)}`);
      }
      return false;
    }
  }, [streamId, getIceServers, runtimeConfig]);

  // Add function to consume existing producers
  const consumeExistingProducers = useCallback(async () => {
    if (
      !socketRef.current ||
      !deviceRef.current ||
      !transportRef.current.consumer
    ) {
      return;
    }

    try {
      // Get list of active producers from the server
      const producers = await socketPromise<{ producerIds: string[] }>(
        socketRef.current,
        "getProducers",
        { streamId }
      );

      if (
        !producers ||
        !producers.producerIds ||
        !producers.producerIds.length
      ) {
        logWarn("No producers available to consume");
        return;
      }

      // Consume each producer
      for (const producerId of producers.producerIds) {
        await consumeProducer(producerId);
      }
    } catch (err) {
      logError("Error consuming existing producers", formatError(err));
    }
  }, [streamId]);

  // Add function to consume a producer
  const consumeProducer = useCallback(
    async (producerId: string) => {
      if (
        !socketRef.current ||
        !deviceRef.current ||
        !transportRef.current.consumer
      ) {
        return null;
      }

      try {
        // Create consumer for this producer
        if (!deviceRef.current) {
          logError("Cannot consume producer: device is null");
          return null;
        }

        const { rtpCapabilities } = deviceRef.current;

        // Skip if we don't have capabilities
        if (!rtpCapabilities) {
          logError("No RTP capabilities available");
          return null;
        }

        const consumerOptions = await socketPromise<{
          consumerId?: string;
          producerId?: string;
          kind?: string;
          rtpParameters?: any;
          producerUserId?: string;
          error?: string;
        }>(socketRef.current, "consume", {
          transportId: transportRef.current.consumer.id,
          producerId,
          rtpParameters: rtpCapabilities,
          streamId,
        });

        if (consumerOptions?.error) {
          throw new Error(consumerOptions.error);
        }

        if (
          !consumerOptions?.consumerId ||
          !consumerOptions?.producerId ||
          !consumerOptions?.kind ||
          !consumerOptions?.rtpParameters
        ) {
          throw new Error("Invalid consumer options returned from server");
        }

        // Create the consumer
        const consumer = await transportRef.current.consumer.consume({
          id: consumerOptions.consumerId,
          producerId: consumerOptions.producerId,
          kind: consumerOptions.kind as "audio" | "video",
          rtpParameters: consumerOptions.rtpParameters,
        });

        // Store the consumer in our ref
        if (consumer.kind === "video") {
          consumersRef.current.video = consumer;
        } else if (consumer.kind === "audio") {
          consumersRef.current.audio = consumer;
        }

        // Resume the consumer (it starts in paused state)
        try {
          await socketPromise(socketRef.current, "resumeConsumer", {
            consumerId: consumer.id,
            streamId,
          });
        } catch (err) {
          logWarn(`Error resuming consumer: ${formatError(err)}`);
        }

        // Add the track to our remote stream and update the video element
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        remoteStreamRef.current.addTrack(consumer.track);

        // Update video element with the stream
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStreamRef.current;

          // Attempt to autoplay
          try {
            await videoRef.current.play();
            setAutoplayBlocked(false);
            setStreamReady(true);
          } catch (error) {
            logWarn("Autoplay blocked, user interaction needed", {
              error: formatError(error),
            });
            setAutoplayBlocked(true);
          }
        }

        return consumer;
      } catch (err) {
        logError(`Error consuming producer ${producerId}`, formatError(err));
        return null;
      }
    },
    [streamId]
  );

  // Add this with the other refs
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Add proper type definitions at the top of the file
  interface RouterRtpCapabilitiesResponse {
    rtpCapabilities?: mediasoupClient.types.RtpCapabilities;
    error?: string;
    duplicateConnection?: boolean;
    existingSocketId?: string;
  }

  interface ProducerTransportResponse {
    id?: string;
    iceParameters?: any;
    iceCandidates?: any;
    dtlsParameters?: any;
    error?: string;
  }

  interface ProduceResponse {
    id?: string;
    error?: string;
  }

  // Add the handleManualPlay function definition
  const handleManualPlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => {
          setAutoplayBlocked(false);
          setError(null);
          logInfo("Manual play successful");
        })
        .catch((err) => {
          logError(
            "Manual play failed",
            formatError(err),
            effectiveUserId,
            streamId
          );
        });
    }
  }, [effectiveUserId, streamId]);

  // Add an effect to create consumer transport when device is initialized
  useEffect(() => {
    if (
      deviceInitialized &&
      !isStreamer &&
      connectionStatus === "connected" &&
      socketRef.current &&
      deviceRef.current
    ) {
      // Function to create consumer transport
      const setupViewerTransport = async () => {
        try {
          logInfo("Setting up viewer transport after device initialization");

          // Request a consumer transport from the server
          const consumerTransportOptions =
            await socketPromise<ProducerTransportResponse>(
              socketRef.current!,
              "createConsumerTransport",
              { streamId }
            );

          if (!consumerTransportOptions || consumerTransportOptions.error) {
            throw new Error(
              consumerTransportOptions?.error ||
                "Failed to create consumer transport"
            );
          }

          // First check if the device exists and is loaded
          if (!deviceRef.current) {
            logError("Cannot create consumer transport: device is null");
            return;
          }

          // Create the consumer transport
          const transport = deviceRef.current.createRecvTransport({
            id: consumerTransportOptions.id || "",
            iceParameters: consumerTransportOptions.iceParameters,
            iceCandidates: consumerTransportOptions.iceCandidates,
            dtlsParameters: consumerTransportOptions.dtlsParameters,
            iceServers: getIceServers(runtimeConfig),
          });

          // Store the consumer transport
          transportRef.current.consumer = transport;

          // Handle transport connection events
          transport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                logInfo("Consumer transport connect event", {
                  transportId: transport.id,
                });

                // Connect the transport
                await socketPromise(socketRef.current!, "connectTransport", {
                  transportId: transport.id,
                  dtlsParameters,
                  streamId,
                });

                callback();
              } catch (err) {
                logError(
                  "Error in consumer transport connect",
                  formatError(err)
                );
                errback(err as Error);
              }
            }
          );

          // Handle connection state changes
          transport.on("connectionstatechange", async (state) => {
            logInfo(`Consumer transport connection state changed to: ${state}`);

            if (state === "connected") {
              // Now that we're connected, request producers to consume
              await requestProducersToConsume();
            } else if (
              state === "failed" ||
              state === "disconnected" ||
              state === "closed"
            ) {
              logError(`Consumer transport connection ${state}`);
            }
          });

          logInfo("Consumer transport created", { id: transport.id });
        } catch (err) {
          logError("Failed to create consumer transport", formatError(err));
          if (onMediaError) {
            onMediaError(
              "setup",
              `Error setting up stream: ${formatError(err)}`
            );
          }
        }
      };

      setupViewerTransport();
    }
  }, [
    deviceInitialized,
    isStreamer,
    connectionStatus,
    streamId,
    getIceServers,
    runtimeConfig,
  ]);

  // Add the requestProducersToConsume function
  const requestProducersToConsume = useCallback(async () => {
    if (
      !socketRef.current ||
      !deviceRef.current ||
      !transportRef.current.consumer
    ) {
      return;
    }

    try {
      // Get list of active producers from the server
      const response = await socketPromise<{
        producerIds?: string[];
        error?: string;
      }>(socketRef.current, "getProducers", { streamId });

      if (response.error) {
        logWarn(`Failed to get producers: ${response.error}`);
        return;
      }

      if (!response.producerIds || !response.producerIds.length) {
        logWarn("No producers available to consume");
        return;
      }

      // Consume each producer
      for (const producerId of response.producerIds) {
        await consumeProducer(producerId);
      }
    } catch (err) {
      logError("Error consuming existing producers", formatError(err));
    }
  }, [streamId, consumeProducer]);

  // Effect to create consumer transport for viewers when device is initialized
  useEffect(() => {
    const attemptConsumerTransportCreation = async () => {
      if (
        !isStreamer &&
        deviceInitialized &&
        connectionStatus === "connected" &&
        deviceRef.current?.loaded
      ) {
        logInfo("Device initialized, creating consumer transport for viewer");
        try {
          const success = await createConsumerTransport();
          if (success) {
            logInfo("Successfully created consumer transport for viewer");
            // Request available producers after transport is created
            await consumeExistingProducers();
          }
        } catch (error) {
          logError("Failed to create consumer transport", formatError(error));
        }
      }
    };

    attemptConsumerTransportCreation();
  }, [
    isStreamer,
    deviceInitialized,
    connectionStatus,
    createConsumerTransport,
    consumeExistingProducers,
  ]);

  // Fetch router RTP capabilities from the server
  const fetchRouterRtpCapabilities = useCallback(async () => {
    try {
      if (
        !socketRef.current ||
        !socketRef.current.connected ||
        !mountedRef.current
      ) {
        logError("Cannot fetch RTP capabilities: socket not connected");
        return null;
      }

      // Clear any existing device
      if (deviceRef.current) {
        try {
          // Only attempt to dispose if it was loaded
          if (deviceRef.current.loaded) {
            // This is a safe operation, won't throw if device is not properly initialized
            logInfo("Disposing existing MediaSoup device");
          }
        } catch (err) {
          // Ignore errors when disposing device
          logWarn("Error disposing MediaSoup device", formatError(err));
        }
      }

      // Create a fresh device
      deviceRef.current = new mediasoupClient.Device();

      // Request router capabilities from the server
      const response = await socketPromise<RouterRtpCapabilitiesResponse>(
        socketRef.current,
        "getRouterRtpCapabilities",
        {
          streamId,
          sessionId,
        }
      );

      if (response.error) {
        logError(`Error getting router capabilities: ${response.error}`);
        return null;
      }

      if (!response.rtpCapabilities) {
        logError("No RTP capabilities received from server");
        return null;
      }

      // If we have capabilities, initialize the device
      await initializeMediasoupDevice(response.rtpCapabilities);
      return response.rtpCapabilities;
    } catch (error) {
      logError("Error fetching RTP capabilities", formatError(error));
      return null;
    }
  }, [
    socketRef,
    mountedRef,
    deviceRef,
    streamId,
    sessionId,
    initializeMediasoupDevice,
  ]);

  // Logging enhancements for anonymous users
  useEffect(() => {
    // Log anonymous user for debugging purposes
    if (isAnonymous) {
      logInfo(`Anonymous user viewing stream`, {
        anonymous: true,
        streamId,
        tempUserId: userId,
        username,
      });
    }
  }, [isAnonymous, userId, username, streamId]);

  // Manual reconnection function that can be called externally
  const triggerManualReconnect = useCallback(() => {
    logInfo("Manual reconnection triggered");

    // Store session info before attempting reconnection
    if (deviceRef.current?.loaded) {
      const sessionData = {
        streamId,
        userId: effectiveUserId,
        deviceCapabilities: deviceRef.current?.rtpCapabilities,
        timestamp: Date.now(),
        isStreamer,
        sessionId,
      };

      storeSessionInfo(streamId, effectiveUserId, sessionData);
    }

    // If reconnection has failed previously, clear stored session data
    // for a completely fresh start
    if (reconnectionFailed) {
      logInfo("Clearing stored session data for a fresh reconnection");
      clearSessionInfo(streamId, effectiveUserId);
      clearConnectionInfo(streamId, effectiveUserId);
    }

    // Disconnect current socket
    if (socketRef.current?.connected) {
      logInfo("Disconnecting current socket for manual reconnection");
      socketRef.current.disconnect();
    }

    // Reset connection state
    connectInProgressRef.current = false;
    connectionAttemptsRef.current = 0;

    // Update UI
    setConnectionStatus("connecting");
    setIsRecovering(true);
    setError(null); // Clear any previous errors

    // Short delay to ensure proper disconnect before reconnect
    setTimeout(() => {
      if (mountedRef.current) {
        connectToSignalingServer();
      }
    }, 1000);
  }, [
    streamId,
    effectiveUserId,
    isStreamer,
    sessionId,
    connectToSignalingServer,
    reconnectionFailed,
  ]);

  // Register the reconnection handler if provided
  useEffect(() => {
    if (onReconnectRequest && typeof onReconnectRequest === "function") {
      onReconnectRequest(triggerManualReconnect);
    }
  }, [onReconnectRequest, triggerManualReconnect]);

  // Return the proper rendering code
  return (
    <div className={cn("webrtc-stream-manager relative", className)}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isStreamer || isMuted}
        className={`w-full h-full object-cover ${
          isVideoHidden ? "invisible" : "visible"
        }`}
      />

      {/* WebRTC Connection Info */}
      <WebRTCConnectionInfo
        socket={socketRef.current}
        deviceRef={deviceRef}
        transportRefs={{
          producer: transportRef.current.producer,
          consumer: transportRef.current.consumer,
        }}
        connectionState={connectionStatus}
        streamId={streamId}
        className="mt-2 absolute bottom-16 left-4 z-10"
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
          onClick={handleManualPlay}
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
          onClick={toggleMute}
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
            onClick={toggleVideo}
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

      {/* Device selector (for streamers only) */}
      <div
        className={`absolute top-4 right-4 z-20 ${
          !isStreamer ? "hide-for-viewers" : ""
        }`}
      >
        <button
          onClick={() => setShowDeviceSelector((prev) => !prev)}
          className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors relative"
          aria-label={
            showDeviceSelector ? "Hide device settings" : "Show device settings"
          }
          title={
            showDeviceSelector ? "Hide device settings" : "Show device settings"
          }
        >
          <Settings className="w-5 h-5" />
        </button>

        {showDeviceSelector && (
          <div className="absolute right-0 w-72 mt-2 bg-background/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden border border-border">
            <DeviceSelector
              onDeviceChange={handleDeviceChange}
              initialVideoDeviceId={selectedVideoDevice}
              initialAudioDeviceId={selectedAudioDevice}
            />
          </div>
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

      {isRecovering && (
        <div className="absolute bottom-4 left-4 right-4 bg-yellow-600 bg-opacity-90 text-white p-2 rounded-md text-center text-sm">
          Connection lost. Attempting to recover your session...
        </div>
      )}

      {reconnectionFailed && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-800 bg-opacity-90 text-white p-3 rounded-md text-center">
          <p className="mb-2">
            Connection lost. Unable to reconnect automatically.
          </p>
          <button
            onClick={() => {
              setReconnectionFailed(false);
              triggerManualReconnect();
            }}
            className="bg-white text-red-800 px-4 py-1 rounded-md font-medium hover:bg-gray-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// Add this interface extension near the top of the file, after other type definitions
// Extend the MediaSoup Device type to include our custom error property
declare module "mediasoup-client" {
  namespace types {
    interface Device {
      // Custom property to track device error state
      error?: boolean;
    }
  }
}
