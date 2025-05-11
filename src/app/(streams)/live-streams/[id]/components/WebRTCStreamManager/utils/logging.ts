import { LogLevel, LOG_LEVELS, LogData } from '../types';

// Constants for logging configuration
const CURRENT_LOG_LEVEL = LOG_LEVELS.TRACE; // For detailed debugging
const SEND_LOGS_TO_SERVER = process.env.NODE_ENV === "production";
const DIAGNOSTIC_LOG_SIZE = 100; // Keep last 100 logs for diagnostics

// Storage for diagnostic logs
const diagnosticLogs: string[] = [];

/**
 * Set up WebRTC native debug logging if available
 */
export const setupWebRTCDebugLogging = (): boolean => {
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

/**
 * Helper to send logs to server for debugging
 */
export const sendLogsToServer = (
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

// Log formatting helper functions
const formatTimestamp = () => new Date().toISOString();
const formatLogPrefix = () => "[WebRTC]";

/**
 * Main logging function
 */
export const log = (
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

/**
 * Convenience logging methods
 */
export const logError = (
  message: string,
  data?: LogData,
  userId?: string,
  streamId?: string
) => log(LOG_LEVELS.ERROR, message, data, userId, streamId);

export const logWarn = (message: string, data?: LogData) =>
  log(LOG_LEVELS.WARN, message, data);

export const logInfo = (message: string, data?: LogData) =>
  log(LOG_LEVELS.INFO, message, data);

export const logDebug = (message: string, data?: LogData) =>
  log(LOG_LEVELS.DEBUG, message, data);

export const logTrace = (message: string, data?: LogData) =>
  log(LOG_LEVELS.TRACE, message, data);

/**
 * Helper to get diagnostic logs as a string
 */
export const getDiagnosticLogs = () => diagnosticLogs.join("\\n");

/**
 * Format unknown errors for consistent logging
 */
export const formatError = (err: unknown): Record<string, any> => {
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