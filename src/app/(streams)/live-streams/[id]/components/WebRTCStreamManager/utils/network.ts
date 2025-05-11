import { logInfo, logWarn, logError, formatError } from './logging';
import { isLoopbackUrl } from './ice-config';

/**
 * Normalize Socket.IO URL
 * @param url The URL to normalize
 */
export const normalizeSocketIOUrl = (url: string): string => {
  if (!url) return "ws://localhost:3000"; // Default to ws

  let normalizedUrl = url;

  // Step 1: Ensure it has a protocol. If not, default to ws://
  if (!normalizedUrl.match(/^[a-z]+:\/\//i)) {
    normalizedUrl = "ws://" + normalizedUrl;
    logDebug("Added ws:// protocol to URL without protocol", {
      original: url,
      normalized: normalizedUrl,
    });
  } else if (normalizedUrl.startsWith("http://")) {
    // If it explicitly starts with http://, change it to ws:// for Socket.IO
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

  // Step 2: Remove trailing slash to avoid doubled slashes with path
  if (normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");
    logDebug("Removed trailing slash(es) from URL", {
      original: url,
      normalized: normalizedUrl,
    });
  }

  // Step 3: Handle port if not specified
  if (!normalizedUrl.match(/:\d+/) && !normalizedUrl.includes("localhost")) {
    // No port specified, and not localhost (which defaults to 80/443)
    logDebug("URL has no explicit port, using default", {
      url: normalizedUrl,
    });
  }

  return normalizedUrl;
};

/**
 * Create a promise-based utility for Socket.IO emit
 */
export const socketPromise = <T,>(
  socket: any,
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

/**
 * Test direct WebSocket connectivity (without Socket.IO)
 * This helps diagnose raw WebSocket issues vs Socket.IO specific issues
 */
export const testDirectWebSocketConnectivity = async (
  url: string // URL to test, e.g., ws://localhost:3000
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
          : `${baseUrl}/socket.io?EIO=4&transport=websocket`;

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

/**
 * Run pre-connection test to check basic WebRTC viability
 */
export const runPreConnectionTest = async (runtimeConfig: any): Promise<{
  success: boolean;
  error?: string;
  isLoopback?: boolean;
}> => {
  logInfo("Starting pre-connection tests");
  // Initialize test results
  let socketIOConnectivity = false;
  let directWebSocketConnectivity = false;
  let isLoopback = false;

  try {
    if (!runtimeConfig) {
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

    // For loopback connections, simplify testing
    if (isLoopback) {
      logInfo("Loopback connection detected, simplifying connection test");
      return {
        success: true,
        isLoopback,
      };
    }

    // Basic test for standard connections
    try {
      // Try to connect to STUN server to verify UDP connectivity
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      
      // Create data channel to trigger ICE gathering
      const dc = pc.createDataChannel("connectivity-test");
      
      // Create an offer to start the ICE gathering
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      // Wait for ICE gathering to complete or timeout
      await new Promise<void>((resolve) => {
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            setTimeout(checkState, 500);
          }
        };
        
        // Timeout after 5 seconds
        const timeout = setTimeout(() => resolve(), 5000);
        
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
        
        checkState();
      });
      
      // Clean up
      pc.close();
      
      return {
        success: true,
        isLoopback,
      };
    } catch (error) {
      logError("Error during ICE connectivity test", { error });
      return {
        success: false,
        error: "Failed to verify WebRTC connectivity",
        isLoopback,
      };
    }
  } catch (error) {
    logError("Error during pre-connection test", { error });
    return {
      success: false,
      error: "Failed to complete connection test",
      isLoopback,
    };
  }
};

/**
 * Check if an address is a loopback address
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
 * Get browser diagnostics information
 */
export const getBrowserDiagnostics = (): Record<string, any> => {
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
    logError("Error collecting browser diagnostics", formatError(error));
    return { error: "Failed to collect diagnostics" };
  }
};

// Helper for low-level logging in network utils
function logDebug(message: string, data?: any) {
  logInfo(message, data);
} 