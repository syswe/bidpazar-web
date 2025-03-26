import { io, Socket } from "socket.io-client";
import { getAuth } from "@/lib/auth";

// Track global reconnection attempts and rate limiting
let globalReconnectAttempts = 0;
const MAX_GLOBAL_RECONNECT_ATTEMPTS = 10;
const RECONNECT_RESET_TIMEOUT = 60000;

// Connection attempts tracking and throttling
const connectionAttempts = new Map<
  string,
  { count: number; timestamp: number }
>();
// Increase limits to be more permissive
const MAX_CONNECTIONS_PER_MINUTE = 20; // Increased from 10
const CONNECTION_WINDOW = 120000;

// Export reconnection state for other components to check
export const connectionState = {
  isReconnecting: false,
  lastReconnectAttempt: 0,
  reconnectAttempts: 0,
  isRateLimited: false,
  rateLimitedUntil: 0,
};

// Queue for events to send when reconnected
interface QueuedEvent {
  event: string;
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

const eventQueues = new Map<string, QueuedEvent[]>();
const QUEUE_EXPIRY = 5 * 60 * 1000; // Events expire after 5 minutes

// Function to get the socket API URL from environment or default
const getSocketApiUrl = (): string => {
  const url =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5001";

  console.log(`Using socket API URL: ${url}`);
  return url;
};

// Function to explicitly clear rate limit state for a specific stream
export const clearRateLimitForStream = (streamId: string): void => {
  const instanceKey = streamId || "global";
  connectionAttempts.delete(instanceKey);

  // Only clear global rate limit if it's for this specific stream
  if (connectionState.isRateLimited) {
    console.log(`Clearing rate limit state for ${instanceKey}`);
    connectionState.isRateLimited = false;
    connectionState.rateLimitedUntil = 0;
  }
};

// Configure a Socket.IO client with improved reliability
export const createSocketClient = (
  url: string,
  options: {
    query?: Record<string, string | number | boolean>;
    auth?: Record<string, string | undefined>;
  } = {}
): Socket => {
  const socketUrl =
    url || process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001";

  // Validate URL format - add missing protocol if needed
  const finalUrl = socketUrl.startsWith("http")
    ? socketUrl
    : `http://${socketUrl}`;

  // Clean up query params to ensure all values are strings
  const cleanQuery: Record<string, string> = {};
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      cleanQuery[key] = String(value);
    });
  }

  // Always try to get the latest auth token if not provided
  if (!options.auth?.token) {
    const currentAuth = getAuth();
    if (currentAuth.token) {
      if (!options.auth) options.auth = {};
      options.auth.token = currentAuth.token;
    }
  }

  // Check if we're being rate limited
  const instanceKey = finalUrl + (cleanQuery.streamId || "global");
  const now = Date.now();

  // Apply rate limiting to prevent connection flooding
  const attemptData = connectionAttempts.get(instanceKey) || {
    count: 0,
    timestamp: now,
  };

  // Reset counter if window has expired
  if (now - attemptData.timestamp > CONNECTION_WINDOW) {
    attemptData.count = 1;
    attemptData.timestamp = now;
  } else {
    attemptData.count += 1;
  }

  connectionAttempts.set(instanceKey, attemptData);

  // Check if connection limit exceeded
  if (attemptData.count > MAX_CONNECTIONS_PER_MINUTE) {
    console.warn(
      `Rate limiting socket connections to ${instanceKey} - too many attempts (${attemptData.count})`
    );
    connectionState.isRateLimited = true;
    connectionState.rateLimitedUntil =
      attemptData.timestamp + CONNECTION_WINDOW;

    // Auto-retry after rate limit period - reduced to 30 seconds for better UX
    const clearRateLimitDelay = 30000; // 30 seconds instead of 2 minutes
    setTimeout(() => {
      console.log(`Auto-clearing rate limit for ${instanceKey}`);
      connectionState.isRateLimited = false;
      connectionState.rateLimitedUntil = 0;
      // Reset connection attempts
      connectionAttempts.delete(instanceKey);
    }, clearRateLimitDelay);

    throw new Error(
      `Rate limited: Too many connection attempts. Please try again in ${Math.ceil(
        clearRateLimitDelay / 1000
      )} seconds.`
    );
  }

  console.log(`Connecting to socket server at: ${finalUrl}`, {
    query: cleanQuery,
    hasAuth: !!options.auth?.token,
  });

  // Reset global reconnect attempts after a timeout
  setTimeout(() => {
    if (globalReconnectAttempts > 0) {
      console.log(
        `Resetting global reconnect attempts from ${globalReconnectAttempts} to 0`
      );
      globalReconnectAttempts = 0;
    }
  }, RECONNECT_RESET_TIMEOUT);

  const socket = io(finalUrl, {
    // Merge provided options with defaults
    ...options,
    query: {
      ...cleanQuery,
      clientTimestamp: Date.now(),
      connectionToken: Math.random().toString(36).substring(2, 10),
    },
    // Configure CORS-friendly transport settings
    transports: ["polling", "websocket"], // Start with polling, then upgrade to websocket
    upgrade: true, // Allow transport upgrade
    withCredentials: true, // Important for CORS
    reconnection: true,
    reconnectionAttempts: 8, // Increased from 5 for better reliability in poor networks
    reconnectionDelay: 1000, // Start with lower delay for faster recovery
    reconnectionDelayMax: 10000, // But allow longer delays if needed
    timeout: 30000, // Increased from 20s to 30s for slow connections and large payloads
    autoConnect: true,
    forceNew: false,
    // Important: enable reusing the same session
    multiplex: true,
    // Additional options for more reliable connection
    extraHeaders: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    path: "/socket.io/",
    // Longer polling duration for better reliability
    rememberUpgrade: true,
    timestampRequests: true,
    timestampParam: "t",
  });

  // Improve error handling for video streaming
  socket.io.on("error", (error) => {
    console.error("Socket.IO transport error:", error);
    // Don't disconnect on error, try to recover
  });

  // Better retry logic for streaming connections
  socket.io.on("reconnect_attempt", () => {
    console.log("Attempting to reconnect socket transport");
  });

  // Track reconnection state for better UX
  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log(`Socket reconnection attempt ${attemptNumber}`);
    connectionState.isReconnecting = true;
    connectionState.lastReconnectAttempt = Date.now();
    connectionState.reconnectAttempts = attemptNumber;
  });

  socket.on("reconnect", () => {
    console.log(`Socket reconnected`);
    connectionState.isReconnecting = false;
    connectionState.reconnectAttempts = 0;

    // Process any queued events
    const queue = eventQueues.get(instanceKey) || [];
    const now = Date.now();
    const validEvents = queue.filter((item) => item.expiresAt > now);

    console.log(`Processing ${validEvents.length} queued events`);

    // Send each queued event
    validEvents.forEach((item) => {
      try {
        socket.emit(item.event, item.data);
        console.log(`Sent queued event: ${item.event}`);
      } catch (e) {
        console.error(`Failed to send queued event: ${item.event}`, e);
      }
    });

    // Clear the queue
    eventQueues.set(instanceKey, []);
  });

  socket.on("reconnect_failed", () => {
    console.log(`Socket reconnection failed`);
    connectionState.isReconnecting = false;
  });

  // Listen for all disconnection events to handle offline queueing
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected (${reason}), enabling event queueing`);
  });

  // Event handler for when reconnect fails permanently
  socket.on("reconnect_error", (error) => {
    console.error("Socket reconnection error:", error);
  });

  return socket;
};

// Get a singleton instance of the socket for a specific stream
const socketInstances: Map<string, Socket> = new Map();
const connectionAttemptTimers: Map<string, NodeJS.Timeout> = new Map();
const reattemptDelays: Map<string, number> = new Map(); // Track backoff delays per stream

/**
 * Get a socket for a specific stream with improved error handling
 */
export const getSocketForStream = (
  streamId: string,
  user: { id?: string; username?: string } | null,
  authToken?: string
): Socket => {
  // Get authentication from context if not provided
  if (!authToken) {
    const currentAuth = getAuth();
    authToken = currentAuth.token || undefined;
  }

  // Create a consistent cache key that includes auth status
  const instanceKey = `${streamId}:${!!authToken}`;

  // Check if we already have a socket for this stream and it's connected
  const existingSocket = socketInstances.get(instanceKey);
  if (existingSocket && existingSocket.connected) {
    console.log(`Reusing existing connected socket for ${instanceKey}`);
    return existingSocket;
  }

  // Check if we're attempting too many reconnections globally
  if (globalReconnectAttempts >= MAX_GLOBAL_RECONNECT_ATTEMPTS) {
    console.warn(
      `Too many global reconnection attempts (${globalReconnectAttempts}). Taking a break before trying again.`
    );
    setTimeout(() => {
      globalReconnectAttempts = 0;
    }, RECONNECT_RESET_TIMEOUT);
    throw new Error(
      `Too many reconnection attempts, please try again in ${Math.ceil(
        RECONNECT_RESET_TIMEOUT / 1000
      )} seconds`
    );
  }

  // Check if we're rate limited
  if (
    connectionState.isRateLimited &&
    connectionState.rateLimitedUntil > Date.now()
  ) {
    const waitSeconds = Math.ceil(
      (connectionState.rateLimitedUntil - Date.now()) / 1000
    );
    console.warn(
      `Connection is currently rate limited until ${new Date(
        connectionState.rateLimitedUntil
      ).toLocaleTimeString()} (${waitSeconds}s remaining)`
    );
    throw new Error(`Rate limited. Please try again in ${waitSeconds} seconds`);
  }

  // Get current delay for this instance (or set initial value)
  const currentDelay = reattemptDelays.get(instanceKey) || 1000;

  // Clear any existing connection attempt timer
  const existingTimer = connectionAttemptTimers.get(instanceKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    connectionAttemptTimers.delete(instanceKey);
  }

  // Clean up existing socket if needed
  if (existingSocket) {
    try {
      console.log(`Disconnecting existing socket for ${instanceKey}`);
      existingSocket.disconnect();
      socketInstances.delete(instanceKey);
    } catch (err) {
      console.error(`Error disconnecting socket for ${instanceKey}:`, err);
    }
  }

  try {
    // Remove this key from the global socketInstances to ensure a fresh start
    socketInstances.delete(instanceKey);

    // Create a new socket
    const socketUrl = getSocketApiUrl();

    // Include a timestamp to help avoid cached connections
    const timestamp = Date.now();

    const socket = createSocketClient(socketUrl, {
      query: {
        streamId,
        userId: user?.id || "anonymous",
        username: user?.username || "Anonymous",
        clientTimestamp: timestamp,
        // Add a random token to ensure unique connections
        connectionToken: Math.random().toString(36).substring(2, 15),
      },
      auth: {
        token: authToken,
      },
    });

    // Track this new instance
    socketInstances.set(instanceKey, socket);

    // Reset the delay for this instance on successful connection
    socket.on("connect", () => {
      console.log(`Socket connected for ${instanceKey}`);
      reattemptDelays.set(instanceKey, 1000);
      globalReconnectAttempts = 0;

      // Reset rate limiting state
      connectionState.isRateLimited = false;
      connectionState.rateLimitedUntil = 0;
    });

    // Update backoff on connection error
    socket.on("connect_error", (err) => {
      const errorMessage = err?.message || "Unknown error";
      console.warn(
        `Socket connection error for ${instanceKey}: ${errorMessage}`
      );

      // Increase backoff delay for next attempt
      const newDelay = Math.min(currentDelay * 1.5, 60000); // Max 1 minute
      reattemptDelays.set(instanceKey, newDelay);

      // Set rate limiting based on error message
      if (
        errorMessage.includes("Rate limit") ||
        errorMessage.includes("TOO_MANY_CONNECTIONS")
      ) {
        // Parse wait time if available
        const waitMatch = errorMessage.match(/(\d+) seconds/);
        const waitTime = waitMatch ? parseInt(waitMatch[1], 10) * 1000 : 60000;

        connectionState.isRateLimited = true;
        connectionState.rateLimitedUntil = Date.now() + waitTime;

        console.log(
          `Rate limited until ${new Date(
            connectionState.rateLimitedUntil
          ).toLocaleTimeString()}`
        );
      }

      globalReconnectAttempts++;
    });

    return socket;
  } catch (error) {
    // Handle any errors from socket creation
    console.error(`Error creating socket for ${instanceKey}:`, error);

    // Increase backoff delay for next attempt
    const newDelay = Math.min(currentDelay * 2, 60000); // Max 1 minute
    reattemptDelays.set(instanceKey, newDelay);

    // Schedule an automatic retry with exponential backoff
    const timer = setTimeout(() => {
      console.log(
        `Auto-retrying connection for ${instanceKey} after ${newDelay}ms`
      );
      connectionAttemptTimers.delete(instanceKey);
      // Don't actually call getSocketForStream here to avoid infinite recursion
      // The calling code should handle retries
    }, newDelay);

    connectionAttemptTimers.set(instanceKey, timer);
    globalReconnectAttempts++;

    throw error;
  }
};

/**
 * Clear a specific socket instance
 */
export const clearSocketInstance = (instanceKey: string): void => {
  try {
    const socket = socketInstances.get(instanceKey);
    if (socket) {
      console.log(`Cleaning up socket for ${instanceKey}`);
      socket.disconnect();
      socketInstances.delete(instanceKey);
    }

    // Also clean up any pending timers
    const timer = connectionAttemptTimers.get(instanceKey);
    if (timer) {
      clearTimeout(timer);
      connectionAttemptTimers.delete(instanceKey);
    }

    // Reset delays
    reattemptDelays.delete(instanceKey);
  } catch (error) {
    console.error(`Error clearing socket instance ${instanceKey}:`, error);
  }
};

/**
 * Clear all socket instances
 */
export const clearAllSocketInstances = (): void => {
  // First get all keys to avoid modifying during iteration
  const keys = [...socketInstances.keys()];
  keys.forEach((key) => {
    clearSocketInstance(key);
  });
};

// Simple function to queue an event if the socket is disconnected
export function safeEmit(
  socket: Socket | null,
  event: string,
  data: unknown,
  instanceKey = "global"
): boolean {
  if (!socket) return false;

  // If socket is connected, emit normally
  if (socket.connected) {
    socket.emit(event, data);
    return true;
  }

  // Skip queueing for certain events
  const skipQueueing = ["connect", "disconnect", "error", "reconnect"];
  if (skipQueueing.includes(event)) {
    socket.emit(event, data);
    return true;
  }

  // Otherwise, queue the event for later
  console.log(`Socket disconnected, queueing event: ${event}`);
  const queue = eventQueues.get(instanceKey) || [];

  // Add to queue with expiry time
  queue.push({
    event,
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + QUEUE_EXPIRY,
  });

  // Keep the queue from growing too large
  if (queue.length > 100) {
    queue.shift(); // Remove oldest event
  }

  eventQueues.set(instanceKey, queue);
  return true;
}

/**
 * Reset all connection state
 * Use this function when you need to completely reset the socket connection state
 * This is useful for recovering from severe connection issues
 */
export const resetAllConnections = (): void => {
  // Clear all socket instances first
  clearAllSocketInstances();

  // Reset all tracking variables
  globalReconnectAttempts = 0;
  connectionState.isRateLimited = false;
  connectionState.rateLimitedUntil = 0;
  connectionState.isReconnecting = false;
  connectionState.reconnectAttempts = 0;
  connectionState.lastReconnectAttempt = 0;

  // Reset all connection attempts - important for rate limiting recovery
  connectionAttempts.clear();

  // Reset all delays
  reattemptDelays.clear();

  // Clear all timers
  for (const [key, timer] of connectionAttemptTimers.entries()) {
    clearTimeout(timer);
    connectionAttemptTimers.delete(key);
  }

  // Clear all event queues
  eventQueues.clear();

  console.log("All socket connections have been reset");
};
