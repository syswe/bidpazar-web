// src/lib/socket/socketHandler.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import * as mediasoup from "mediasoup";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";
import path from "path";

// Add heartbeat tracking system
const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const HEARTBEAT_TIMEOUT = 45000;  // 45 seconds

// Track last heartbeat timestamps for each broadcaster
const broadcasterHeartbeats = new Map<string, number>();

// Enhanced structured logging for WebRTC events
const logEvent = (
  event: string,
  socketId: string,
  data: Record<string, any> = {}
) => {
  logger.info(`[WebRTC:${event}]`, {
    socketId,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

// Helper function to detect loopback addresses
const isLoopbackAddress = (address?: string): boolean => {
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

// Configuration
const mediasoupAppConfig = {
  router: {
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: { "x-google-start-bitrate": 1000 },
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
        },
      },
    ] as MediasoupTypes.RtpCodecCapability[],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
      },
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || "40000"),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || "40100"),
    logLevel: "warn" as MediasoupTypes.WorkerLogLevel,
    logTags: [
      "info",
      "ice",
      "dtls",
      "rtp",
      "srtp",
      "rtcp",
    ] as MediasoupTypes.WorkerLogTag[],
  },
};

// Function to determine appropriate ICE servers based on connection type
const getAppropriateIceConfiguration = (
  socket: Socket
): MediasoupTypes.WebRtcTransportOptions => {
  const baseConfig = { ...mediasoupAppConfig.webRtcTransport };

  // Check if this is a loopback connection
  const clientIp =
    socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  const host = socket.handshake.headers.host;
  const isLoopback =
    socket.data?.isLoopback ||
    isLoopbackAddress(clientIp as string) ||
    isLoopbackAddress(host?.split(":")[0]);

  // For loopback connections, adjust the configuration to be more reliable
  if (isLoopback) {
    logger.info(
      `Using optimized WebRTC transport config for loopback connection: ${socket.id}`
    );

    // When connecting from the same machine, we need to use the ANNOUNCED_IP
    // more carefully to avoid ICE connectivity issues
    const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";

    return {
      ...baseConfig,
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
          announcedIp: announcedIp,
        },
      ],
      // For localhost testing, these settings help with connection reliability
      enableUdp: true,
      enableTcp: true,
      preferUdp: false, // On loopback, TCP can be more reliable
      initialAvailableOutgoingBitrate: 1000000, // 1 Mbps
    };
  }

  // Regular configuration for non-loopback connections
  return {
    ...baseConfig,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: baseConfig.initialAvailableOutgoingBitrate,
  };
};

// Global state
export interface ExtendedHttpServer extends HttpServer {
  io?: SocketIOServer;
}
// Import stream state synchronization utilities
import { 
  emitStreamStateChange, 
  updateDatabaseStreamState, 
  validateStreamState 
} from './socketEvents';

// Store mediasoup worker in global scope for graceful shutdown
// @ts-ignore
global.mediasoupWorker = null;
let mediasoupWorker: MediasoupTypes.Worker | null = null;

// Type guard to check if mediasoupWorker is initialized
function isWorkerInitialized(worker: MediasoupTypes.Worker | null): worker is MediasoupTypes.Worker {
  return worker !== null && !worker.closed;
}

// Add chat storage
interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

// In-memory message store - will be lost on restart
// In production, you'd use Redis or another persistent store
const chatMessages: Record<string, ChatMessage[]> = {};
const MAX_CHAT_HISTORY = 100; // Maximum number of messages to keep per stream

// Update the Peer type to include rtpCapabilities
type Peer = {
  socketId: string;
  userId: string;
  username: string;
  sessionId: string;
  isStreamer: boolean;
  transports: Map<string, mediasoup.types.Transport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  lastActivity: number;
  rtpCapabilities?: mediasoup.types.RtpCapabilities;
  connectionType?: string; // Added to track loopback connections
};

interface Room {
  router: MediasoupTypes.Router;
  peers: Map<string, Peer>;
  activeSessions: Map<string, string>;
}
const rooms = new Map<string, Room>();

// Set a reasonable session expiration time
const SESSION_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes (increased from 30 seconds)

// Periodically clean up stale sessions
setInterval(() => {
  rooms.forEach((room, streamId) => {
    const now = Date.now();

    // Clean up inactive peers
    room.peers.forEach((peer, socketId) => {
      if (now - peer.lastActivity > 3 * 60 * 1000) {
        // 3 minutes inactive (increased from 1 minute)
        logger.info(
          `[Socket.IO] Removing inactive peer ${socketId} from room ${streamId}`
        );

        // Close all transports, producers and consumers
        peer.transports.forEach((transport) => {
          try {
            transport.close();
          } catch (err: any) {
            logger.error(
              `[Socket.IO] Error closing transport during cleanup: ${err.message}`
            );
          }
        });
        peer.producers.forEach((producer) => {
          try {
            producer.close();
          } catch (err: any) {
            logger.error(
              `[Socket.IO] Error closing producer during cleanup: ${err.message}`
            );
          }
        });
        peer.consumers.forEach((consumer) => {
          try {
            consumer.close();
          } catch (err: any) {
            logger.error(
              `[Socket.IO] Error closing consumer during cleanup: ${err.message}`
            );
          }
        });

        // Remove peer
        room.peers.delete(socketId);
      }
    });

    // Clean up active sessions that no longer have a corresponding peer
    room.activeSessions.forEach((socketId, sessionId) => {
      if (!room.peers.has(socketId)) {
        logger.info(
          `[Socket.IO] Removing stale session ${sessionId} from room ${streamId}`
        );
        room.activeSessions.delete(sessionId);
      }
    });

    // Remove empty rooms
    if (room.peers.size === 0) {
      logger.info(`[Socket.IO] Removing empty room ${streamId}`);
      // Close the router to clean up resources
      try {
        // Only close the router if it's still active
        if (room.router && typeof room.router.close === "function") {
          room.router.close();
        }
      } catch (err: any) {
        logger.error(
          `[Socket.IO] Error closing router for room ${streamId}: ${err.message}`
        );
      }
      rooms.delete(streamId);
    }
  });
}, SESSION_EXPIRATION_TIME);

// Room creation locks to prevent race conditions
const roomCreationLocks = new Map<string, Promise<Room>>();

// Helper functions (moved from route.ts)
async function startMediasoupWorker(): Promise<MediasoupTypes.Worker> {
  // First check if we have a worker in global scope
  // @ts-ignore
  if (global.mediasoupWorker && !global.mediasoupWorker.closed) {
    // @ts-ignore
    const globalWorker: MediasoupTypes.Worker = global.mediasoupWorker;
    mediasoupWorker = globalWorker;
    logger.info("[MediaSoup] Using existing worker from global scope.");
    return globalWorker;
  }

  if (mediasoupWorker && !mediasoupWorker.closed) {
    logger.info("[MediaSoup] Worker already running.");
    return mediasoupWorker;
  }
  try {
    logger.info("[MediaSoup] Creating Mediasoup worker...");
    
    // Debug output to help diagnose worker issues
    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      
      // Check if mediasoup module exists
      if (fs.existsSync('./node_modules/mediasoup')) {
        logger.info("[MediaSoup] MediaSoup module found in node_modules");
        
        // Check if worker path exists
        const workerPath = require.resolve('mediasoup/worker/out/Release/mediasoup-worker');
        logger.info(`[MediaSoup] Worker resolved path: ${workerPath}`);
        
        // Check if executable exists and has correct permissions
        const stats = fs.statSync(workerPath);
        logger.info(`[MediaSoup] Worker file stats: ${JSON.stringify({
          size: stats.size,
          mode: stats.mode.toString(8),
          isExecutable: !!(stats.mode & 0o111)
        })}`);
        
        // Make sure it's executable
        if (!(stats.mode & 0o111)) {
          logger.info("[MediaSoup] Making worker executable");
          fs.chmodSync(workerPath, stats.mode | 0o111);
        }
      } else {
        logger.error("[MediaSoup] MediaSoup module not found in node_modules!");
      }
    } catch (debugErr) {
      logger.error("[MediaSoup] Error during worker path debugging:", debugErr);
    }
    
    const worker = await mediasoup.createWorker({
      logLevel: mediasoupAppConfig.worker.logLevel,
      logTags: mediasoupAppConfig.worker.logTags,
      rtcMinPort: mediasoupAppConfig.worker.rtcMinPort,
      rtcMaxPort: mediasoupAppConfig.worker.rtcMaxPort,
    });
    // Store in global scope for graceful shutdown
    mediasoupWorker = worker;
    // @ts-ignore
    global.mediasoupWorker = worker;

    worker.on("died", (error) => {
      logger.error("[MediaSoup] Worker died.", error);
      mediasoupWorker = null;
      // @ts-ignore
      global.mediasoupWorker = null;
      setTimeout(() => process.exit(1), 2000);
    });
    logger.info("[MediaSoup] Worker created successfully.");
    return worker;
  } catch (error) {
    logger.error("[MediaSoup] Failed to create Mediasoup worker:", error);
    throw error;
  }
}

// MediaSoup worker setup
async function createMediasoupWorker(): Promise<MediasoupTypes.Worker> {
  const { worker: workerConfig } = mediasoupAppConfig;

  logger.info("[MediaSoup] Creating MediaSoup worker");
  
  // Debug worker path
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    logger.info("[MediaSoup] Checking MediaSoup installation status");
    
    // Check node_modules structure
    if (fs.existsSync('./node_modules/mediasoup')) {
      const files = fs.readdirSync('./node_modules/mediasoup');
      logger.info(`[MediaSoup] Files in mediasoup dir: ${files.join(', ')}`);
      
      if (fs.existsSync('./node_modules/mediasoup/worker')) {
        const workerFiles = fs.readdirSync('./node_modules/mediasoup/worker');
        logger.info(`[MediaSoup] Files in worker dir: ${workerFiles.join(', ')}`);
        
        // Check worker binary
        const workerPath = './node_modules/mediasoup/worker/out/Release/mediasoup-worker';
        if (fs.existsSync(workerPath)) {
          logger.info(`[MediaSoup] Worker binary exists at ${workerPath}`);
          
          // Make sure it's executable
          try {
            fs.chmodSync(workerPath, 0o755);
            logger.info("[MediaSoup] Made worker binary executable");
          } catch (chmodErr) {
            logger.error("[MediaSoup] Error making worker executable:", chmodErr);
          }
        } else {
          logger.error(`[MediaSoup] Worker binary NOT found at expected path: ${workerPath}`);
        }
      }
    } else {
      logger.error("[MediaSoup] MediaSoup module directory not found!");
    }
  } catch (debugErr) {
    logger.error("[MediaSoup] Error debugging mediasoup installation:", debugErr);
  }
  
  try {
    const worker = await mediasoup.createWorker({
      logLevel: workerConfig.logLevel as MediasoupTypes.WorkerLogLevel,
      logTags: workerConfig.logTags as MediasoupTypes.WorkerLogTag[],
      rtcMinPort: workerConfig.rtcMinPort,
      rtcMaxPort: workerConfig.rtcMaxPort,
    });

    worker.on("died", (error) => {
      logger.error(
        "[MediaSoup] MediaSoup worker died unexpectedly, attempting restart",
        { error: error?.toString() }
      );
      // Attempt to create a new worker
      setTimeout(async () => {
        try {
          mediasoupWorker = await createMediasoupWorker();
          // @ts-ignore
          global.mediasoupWorker = mediasoupWorker;
          logger.info("[MediaSoup] MediaSoup worker restarted successfully");
        } catch (e) {
          logger.error("[MediaSoup] Failed to restart MediaSoup worker", {
            error: e,
          });
        }
      }, 2000);
    });

    return worker;
  } catch (error) {
    logger.error("[MediaSoup] Failed to create worker with config:", {
      error,
      config: {
        rtcMinPort: workerConfig.rtcMinPort,
        rtcMaxPort: workerConfig.rtcMaxPort,
        logLevel: workerConfig.logLevel,
      }
    });
    
    // Try to find mediasoup worker binary with more detailed paths
    try {
      const path = require('path');
      const fs = require('fs');
      
      const possiblePaths = [
        './node_modules/mediasoup/worker/out/Release/mediasoup-worker',
        '/app/node_modules/mediasoup/worker/out/Release/mediasoup-worker',
        path.resolve('./node_modules/mediasoup/worker/out/Release/mediasoup-worker')
      ];
      
      logger.info("[MediaSoup] Searching for worker binary in possible locations:");
      possiblePaths.forEach(p => {
        logger.info(`  - ${p}: ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}`);
      });
      
      // Try to reinstall mediasoup as a last resort
      logger.info("[MediaSoup] Emergency: Trying to reinstall mediasoup");
      const { execSync } = require('child_process');
      execSync('npm install mediasoup@3', { stdio: 'inherit' });
      
      // Check if that fixed it
      const reinstallPath = './node_modules/mediasoup/worker/out/Release/mediasoup-worker';
      if (fs.existsSync(reinstallPath)) {
        logger.info("[MediaSoup] Successfully reinstalled mediasoup, binary now exists");
        fs.chmodSync(reinstallPath, 0o755);
      } else {
        logger.error("[MediaSoup] Reinstall failed, binary still missing");
      }
    } catch (searchErr) {
      logger.error("[MediaSoup] Error during emergency recovery:", searchErr);
    }
    
    throw error;
  }
}

async function getOrCreateRoom(streamId: string, userId?: string): Promise<Room> {
  // First check if room already exists
  let room = rooms.get(streamId);
  if (room) {
    return room;
  }
  
  // If a creation process is already in progress for this room, wait for it
  if (roomCreationLocks.has(streamId)) {
    logger.info(`[MediaSoup] Room creation already in progress for stream: ${streamId}, waiting for it to complete`);
    return roomCreationLocks.get(streamId)!;
  }
  
  // Create a promise for the room creation process
  const roomCreationPromise = (async () => {
    try {
      // Double-check that the room wasn't created while we were setting up the lock
      // This is the critical part that prevents duplicate room creation
      room = rooms.get(streamId);
      if (room) {
        logger.info(`[MediaSoup] Room was created by another process while waiting for lock: ${streamId}`);
        return room;
      }

      // Validate stream exists and is in a valid state in the database
      const streamState = await validateStreamState(streamId);
      
      if (!streamState.isValid && streamState.error?.includes("Failed to fetch")) {
        logger.warn(`[MediaSoup] Creating room for stream ${streamId} that doesn't exist in database`);
      } else if (streamState.actualState === "ENDED") {
        logger.warn(`[MediaSoup] Attempted to create room for ENDED stream: ${streamId}`);
        // We will still create the room, but log the potential inconsistency
      }
      
      // Ensure we have a working mediasoup worker
      if (!isWorkerInitialized(mediasoupWorker)) {
        // First check if we have a worker in global scope from server.js
        // @ts-ignore
        if (global.mediasoupWorker && !global.mediasoupWorker.closed) {
          // @ts-ignore
          mediasoupWorker = global.mediasoupWorker;
          logger.info("[MediaSoup] Using existing worker from global scope for room creation");
        } else {
          try {
            mediasoupWorker = await startMediasoupWorker();
          } catch (error) {
            logger.error("[MediaSoup] Failed to initialize MediaSoup worker:", error);
            throw new Error("Mediasoup worker failed to initialize");
          }
        }
      }
      
      logger.info(`[MediaSoup] Creating new room for stream: ${streamId}`);
      // At this point mediasoupWorker is guaranteed to be initialized
      const router = await mediasoupWorker!.createRouter({
        mediaCodecs: mediasoupAppConfig.router.mediaCodecs,
      });
      
      room = {
        router,
        peers: new Map(),
        activeSessions: new Map(),
      };
      
      // Store the room in the rooms map
      rooms.set(streamId, room);
      
      // Emit room creation event - use STARTING state instead of CREATING
      emitStreamStateChange({
        streamId,
        state: "STARTING",
        userId,
        timestamp: new Date().toISOString(),
        metadata: { isNewRoom: true }
      });
      
      logger.info(`[MediaSoup] Successfully created room for stream: ${streamId}`);
      return room;
    } catch (error) {
      logger.error(`[MediaSoup] Error creating room for stream: ${streamId}`, {
        error: formatError(error)
      });
      // If room creation fails, remove the lock so future attempts can try again
      throw error;
    }
  })();
  
  // Store the promise and clean it up when done
  roomCreationLocks.set(streamId, roomCreationPromise);
  
  // Clean up the lock when the promise resolves or rejects
  roomCreationPromise
    .finally(() => {
      // Only remove the lock if it's still the same promise
      // This prevents race conditions where a new lock might be set while we're cleaning up
      if (roomCreationLocks.get(streamId) === roomCreationPromise) {
        roomCreationLocks.delete(streamId);
        logger.debug(`[MediaSoup] Room creation lock released for stream: ${streamId}`);
      }
    });
  
  return roomCreationPromise;
}

// Function to find existing connections from the same user in a room
function findExistingUserConnection(
  room: Room,
  userId: string,
  isStreamer: boolean
): Peer | null {
  // isStreamer is the isStreamer status of the *new* connection attempt.
  if (!room) return null;
  for (const peer of room.peers.values()) {
    if (peer.userId === userId && peer.isStreamer === isStreamer) {
      return peer; // Found an existing peer with same userId and same streamer status
    }
  }
  return null;
}

// New function to remove existing peer connection
function removeExistingPeer(room: Room, socketId: string) {
  const peer = room.peers.get(socketId);
  if (!peer) return false;

  logger.info(
    `[WebRTC] Removing existing peer ${socketId} to prevent duplicates`,
    { userId: peer.userId, isStreamer: peer.isStreamer }
  );

  // Close all transports, producers and consumers
  peer.transports.forEach((transport) => {
    try {
      transport.close();
    } catch (err: any) {
      logger.error(
        `[WebRTC] Error closing transport during cleanup: ${err.message}`
      );
    }
  });

  peer.producers.forEach((producer) => {
    try {
      producer.close();
    } catch (err: any) {
      logger.error(
        `[WebRTC] Error closing producer during cleanup: ${err.message}`
      );
    }
  });

  peer.consumers.forEach((consumer) => {
    try {
      consumer.close();
    } catch (err: any) {
      logger.error(
        `[WebRTC] Error closing consumer during cleanup: ${err.message}`
      );
    }
  });

  // Remove peer from room
  room.peers.delete(socketId);

  // Remove any session mappings to this peer
  for (const [sessionId, peerSocketId] of room.activeSessions.entries()) {
    if (peerSocketId === socketId) {
      room.activeSessions.delete(sessionId);
      logger.debug(`[WebRTC] Removed session mapping for ${sessionId}`);
    }
  }

  // Clean up any stale producers that might reference this peer
  const producerIds = Array.from(room.peers.values())
    .flatMap((p) => Array.from(p.producers.values()))
    .map((producer) => producer.id);

  // Log the cleanup status
  logger.info(`[WebRTC] Peer cleanup complete for ${socketId}`, {
    userId: peer.userId,
    isStreamer: peer.isStreamer,
    removedTransports: peer.transports.size,
    removedProducers: peer.producers.size,
    removedConsumers: peer.consumers.size,
  });

  return true;
}

// Add enhanced error formatting helper
const formatError = (error: any) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
};

// Add this function to enforce one streamer per room
function ensureOnlyOneStreamerInRoom(
  io: SocketIOServer,
  room: Room,
  currentUserId: string,
  currentSocketId: string
) {
  // Find any existing broadcasters
  const existingBroadcasters = Array.from(room.peers.values()).filter(
    (peer) => peer.isStreamer && peer.userId !== currentUserId
  );

  // If there's already a broadcaster that's not this user, disconnect them
  if (existingBroadcasters.length > 0) {
    for (const broadcaster of existingBroadcasters) {
      logger.warn(
        `[WebRTC] Removing existing broadcaster as a new one is connecting`,
        {
          existingBroadcasterId: broadcaster.userId,
          existingBroadcasterSocketId: broadcaster.socketId,
          newBroadcasterId: currentUserId,
          newBroadcasterSocketId: currentSocketId,
        }
      );

      try {
        // Close their transports
        for (const transport of broadcaster.transports.values()) {
          transport.close();
        }

        // Remove them from the room
        room.peers.delete(broadcaster.socketId);

        // Get the actual socket from the IO server
        const socket = io.sockets.sockets.get(broadcaster.socketId);
        if (socket) {
          // Notify the client they're being disconnected
          socket.emit("broadcaster_replaced", {
            message: "Another streamer has taken over this stream",
          });

          // Use disconnect() to force close their connection
          socket.disconnect(true);
        }
      } catch (err) {
        logger.error(`[WebRTC] Error removing existing broadcaster`, {
          error: formatError(err),
          userId: broadcaster.userId,
        });
      }
    }
    return true;
  }

  return false;
}

// Main exported function for server.js
export async function initializeSocketIOServer(
  httpServer: HttpServer,
  existingIo?: SocketIOServer
): Promise<SocketIOServer> {
  logger.info("[Socket.IO] Initializing Socket.IO server");

  // Log any existing open connections before creating the server
  const connections = httpServer.getConnections
    ? new Promise((resolve) =>
        httpServer.getConnections((err, count) => resolve(err ? 0 : count))
      )
    : Promise.resolve(0);

  connections.then((count) => {
    logger.info(
      `[Socket.IO] HTTP server has ${count} existing connections before Socket.IO init`
    );
  });

  try {
    // Use the existing Socket.IO instance if provided, or create a new one
    const io =
      existingIo ||
      new SocketIOServer(httpServer, {
        cors: {
          origin: "*", // In production, restrict this to your domains
          methods: ["GET", "POST"],
          credentials: true,
        },
        // Allow all transports with WebSocket preferred
        transports: ["websocket", "polling"],
        allowUpgrades: true,
        // Path and settings - make sure it's consistent with server.js
        path: "/socket.io", // No trailing slash
        serveClient: false, // Don't serve client files to save bandwidth
        connectTimeout: 45000, // 45 seconds (more than default 20s)
        // Polling settings
        pingTimeout: 30000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        // WebSocket specific settings
        maxHttpBufferSize: 1e8, // 100 MB max message size
        // Fix for Next.js 13+ compatibility
        addTrailingSlash: false,
        // Enable connection state recovery
        connectionStateRecovery: {
          // optional, see https://socket.io/docs/v4/connection-state-recovery/#options
          maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
          skipMiddlewares: true, // RECOMMENDED
        },
      });

    // Store the Socket.IO server instance on the HTTP server for later access
    (httpServer as ExtendedHttpServer).io = io;

    // Initialize MediaSoup worker
    try {
      // First check if we already have a worker in the global scope from server.js
      // @ts-ignore
      if (global.mediasoupWorker && !global.mediasoupWorker.closed) {
        // @ts-ignore
        mediasoupWorker = global.mediasoupWorker;
        logger.info("[MediaSoup] Using existing MediaSoup worker from server.js initialization");
      } else if (mediasoupWorker && !mediasoupWorker.closed) {
        logger.info("[MediaSoup] Worker already running.");
      } else {
        mediasoupWorker = await createMediasoupWorker();
        // @ts-ignore
        global.mediasoupWorker = mediasoupWorker;
        logger.info("[MediaSoup] MediaSoup worker created successfully and is ready.");
      }
    } catch (error) {
      logger.error(
        "[MediaSoup] CRITICAL: Failed to create initial MediaSoup worker during server init.",
        { error }
      );
      // Depending on the desired behavior, you might want to throw an error here
      // to prevent the server from starting in a potentially broken state.
      // For now, logging the error and allowing the server to continue.
    }

    // Main Socket.IO connection handler
    io.on("connection", async (socket: Socket) => {
      logger.info(`New socket connection: ${socket.id}`, {
        query: socket.handshake.query,
      });

      // Extract connection parameters
      const streamId = socket.handshake.query.streamId as string;
      const userId = socket.handshake.query.userId as string;
      const username = (socket.handshake.query.username as string) || "Anonymous";
      const sessionId = socket.handshake.query.sessionId as string || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.floor(Math.random() * 2000000000)}`;
      const isStreamer = socket.handshake.query.isStreamer === "1" || socket.handshake.query.isStreamer === "true";
      const isAnonymous = socket.handshake.query.isAnonymous === "1" || socket.handshake.query.isAnonymous === "true";
      const isLocalDev = socket.handshake.query.isLocalDev === "1" || socket.handshake.query.isLocalDev === "true";
      const clientIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;

      if (!streamId) {
        logger.error(`Socket missing streamId: ${socket.id}`);
        socket.emit("error", {
          message: "Missing streamId",
          code: "MISSING_STREAM_ID",
          canReconnect: false,
        });
        socket.disconnect();
        return;
      }

      // Check for loopback connections
      const host = socket.handshake.headers.host;
      const isLoopback =
        socket.data?.isLoopback ||
        isLoopbackAddress(clientIp as string) ||
        isLoopbackAddress(host?.split(":")[0]);

      // In local development, loopback connections are expected
      if (isLoopback) {
        socket.data.isLocalDev = isLocalDev;
        logger.info(`Detected loopback connection in ${isLocalDev ? "local development" : "production"}`, {
          socketId: socket.id,
          clientIp,
          host,
          isLocalDev
        });
      }

      // Check for existing session with the same session ID
      let existingSocketId: string | undefined;
      let room = rooms.get(streamId);

      // Create room if it doesn't exist
      if (!room) {
        room = await getOrCreateRoom(streamId);
      }

      // Check for duplicate connections with the same session ID
      let hasDuplicateConnection = false;
      if (sessionId) {
        room.activeSessions.forEach((socketId, existingSessionId) => {
          if (existingSessionId === sessionId && socketId !== socket.id) {
            existingSocketId = socketId;
            hasDuplicateConnection = true;
            
            // In local development, we can be more tolerant of duplicate connections
            if (isLocalDev) {
              logger.info(`Local development: allowing duplicate connection for session ${sessionId}`, {
                existingSocketId: socketId,
                newSocketId: socket.id
              });
            } else {
              // Potentially close the existing connection in production
              const existingSocket = io.sockets.sockets.get(socketId);
              if (existingSocket) {
                logger.info(`Cleaning up previous session ${sessionId} with socket ${socketId}`);
                
                // Notify the client about the duplicate connection
                existingSocket.emit("duplicate_connection", {
                  message: "New connection established with same session ID",
                  newSocketId: socket.id,
                });
                
                // Update mapping to new socket
                room.activeSessions.set(sessionId, socket.id);
              }
            }
          }
        });
      }

      // Store session info
      if (sessionId) {
        room.activeSessions.set(sessionId, socket.id);
      }

      // Store connection type information
      socket.data.connectionType = isLoopback 
        ? (isLocalDev ? "local_development" : "loopback") 
        : "standard";

      // Store this flag for broadcaster/viewer differentiation
      socket.data.isBroadcaster = isStreamer;
      socket.data.streamId = streamId;
      socket.data.userId = userId;
      socket.data.username = username;
      socket.data.sessionId = sessionId;

      logger.info("[Socket.IO] Client connected", {
        socketId: socket.id,
        sessionId,
        streamId: streamId || "no-stream",
        userId: userId || "anonymous",
        username: username || "Anonymous",
        isAnonymous,
        ip: clientIp,
        transport: socket.conn.transport.name,
        isLoopback,
        isLocalDev,
        hasDuplicateConnection
      });

      // If this is a duplicate connection, notify the client
      if (hasDuplicateConnection) {
        socket.emit("duplicate_connection", {
          existingSocketId,
          isLocalDev
        });
      }

      // Send welcome message with connection info
      socket.emit("connection_established", {
        socketId: socket.id,
        sessionId,
        serverTime: new Date().toISOString(),
        message: "Successfully connected to BidPazar WebSocket server",
        isLoopback,
        isLocalDev
      });

      // Connection tracking for diagnostics
      const connectedSockets = Object.keys(io.sockets.sockets).length;
      logger.info(`[Socket.IO] Total connected clients: ${connectedSockets}`);

      // Join the appropriate stream room if provided
      if (streamId) {
        socket.join(`stream:${streamId}`);
        logger.info(
          `[Socket.IO] Client joined stream room: stream:${streamId}`,
          {
            socketId: socket.id,
            streamId,
          }
        );

        // Send chat history for this stream if it exists
        if (chatMessages[streamId]) {
          socket.emit("chat_history", chatMessages[streamId]);
        }
      }

      // Socket Event Handlers

      // Chat message related events
      socket.on("joinChatRoom", (roomData) => {
        const { streamId } = roomData;
        if (!streamId) return;

        logEvent("joinChatRoom", socket.id, {
          streamId,
          userId,
          username: username || "Anonymous",
        });

        socket.join(`chat:${streamId}`);
        logger.info(`[Socket.IO] Client joined chat room: chat:${streamId}`, {
          socketId: socket.id,
          streamId,
          username: username || "Anonymous",
        });

        // Initialize chat storage for this stream if it doesn't exist
        if (!chatMessages[streamId]) {
          chatMessages[streamId] = [];
        }

        // Send existing chat history to the client
        socket.emit("chatHistory", chatMessages[streamId]);
      });

      socket.on("leaveChatRoom", (roomData) => {
        const { streamId } = roomData;
        if (!streamId) return;

        logEvent("leaveChatRoom", socket.id, {
          streamId,
          userId,
          username: username || "Anonymous",
        });

        socket.leave(`chat:${streamId}`);
        logger.info(`[Socket.IO] Client left chat room: chat:${streamId}`, {
          socketId: socket.id,
          streamId,
        });
      });

      socket.on("sendChatMessage", (messageData) => {
        const { streamId, content } = messageData;
        if (!streamId || !content || !userId) return;

        logEvent("sendChatMessage", socket.id, {
          streamId,
          userId,
          username: username || "Anonymous",
          messageLength: content.length,
        });

        // Create message object
        const message: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          streamId,
          userId: userId as string,
          username: username as string,
          content,
          timestamp: new Date().toISOString(),
        };

        // Store in memory
        if (!chatMessages[streamId]) {
          chatMessages[streamId] = [];
        }

        chatMessages[streamId].push(message);

        // Limit the chat history size
        if (chatMessages[streamId].length > MAX_CHAT_HISTORY) {
          chatMessages[streamId] = chatMessages[streamId].slice(
            -MAX_CHAT_HISTORY
          );
        }

        // Broadcast to all clients in this chat room
        io.to(`chat:${streamId}`).emit("newChatMessage", message);

        logger.info(`[Socket.IO] Chat message sent to room: chat:${streamId}`, {
          messageId: message.id,
          streamId,
          userId,
        });
      });

      // WebRTC signaling
      // Handle WebRTC signaling for peers
      socket.on("rtc_signal", (data) => {
        const { targetSocketId, signal, type } = data;

        logEvent("rtc_signal", socket.id, {
          targetSocketId,
          streamId,
          type,
        });

        if (targetSocketId && signal) {
          // Forward signaling data to the target socket
          socket.to(targetSocketId).emit("rtc_signal", {
            fromSocketId: socket.id,
            fromSessionId: sessionId,
            signal,
            type,
            streamId,
          });

          logger.debug(
            `[WebRTC] Signal forwarded from ${socket.id} to ${targetSocketId}`,
            {
              type,
              streamId,
            }
          );
        }
      });

      // Handle stream_starting event (triggered by the API)
      socket.on("stream_starting", async (data) => {
        try {
          if (!data.streamId) {
            logger.warn(`[WebRTC] stream_starting event missing streamId`, {
              socketId: socket.id,
              data
            });
            return;
          }

          const streamId = data.streamId as string;
          const userId = data.userId as string;
          const username = data.username as string;
          
          logEvent("stream_starting", socket.id, {
            streamId,
            userId,
            username
          });
          
          // Validate the stream is in STARTING state
          const { isValid, actualState } = await validateStreamState(streamId, "STARTING");
          
          if (!isValid) {
            logger.warn(`[WebRTC] Stream ${streamId} is not in STARTING state`, {
              actualState,
              socketId: socket.id
            });
            
            // The API should have set this to STARTING, so this is unexpected
            // We'll continue anyway but log the issue
          }
          
          // Prepare the room for the upcoming broadcaster
          const room = await getOrCreateRoom(streamId, userId);
          
          logger.info(`[WebRTC] Room prepared for stream ${streamId}`, {
            streamId,
            userId
          });
          
          // We don't update the database state here - that will happen when broadcaster_ready completes
        } catch (error) {
          logger.error(`[WebRTC] Error in stream_starting handler`, {
            error: formatError(error),
            socketId: socket.id,
            data
          });
        }
      });
      
      // Handle broadcaster (streamer) ready
      socket.on("broadcaster_ready", async (data) => {
        try {
          if (!streamId) {
            socket.emit("error", { message: "No streamId provided" });
            return;
          }

          logEvent("broadcaster_ready", socket.id, {
            streamId,
            sessionId: data.sessionId || sessionId,
            userId,
          });
          
          // Validate stream state in database before proceeding - expect STARTING state
          const streamValidation = await validateStreamState(streamId, "STARTING");
          
          if (!streamValidation.isValid) {
            logger.warn(`[WebRTC] Stream state validation failed for broadcaster: ${streamId}`, {
              error: streamValidation.error,
              socketId: socket.id,
              actualState: streamValidation.actualState
            });
            
            // Handle different invalid states appropriately
            if (streamValidation.actualState === "ENDED") {
              // Don't allow reactivating ended streams - force user to create a new one
              socket.emit("error", { 
                message: streamValidation.error || "This stream has already ended. Please create a new stream using the 'New Stream' button.", 
                code: "STREAM_ENDED",
                canCreateNewStream: true
              });
              return;
            } else if (streamValidation.actualState === "LIVE") {
              // Allow to continue if already live - might be reconnecting
              logger.info(`[WebRTC] Stream ${streamId} is already in LIVE state - possible reconnection`);
            } else if (streamValidation.actualState === "FAILED_TO_START" || 
                      streamValidation.actualState === "INTERRUPTED") {
              // Allow retry from FAILED_TO_START or INTERRUPTED state
              logger.info(`[WebRTC] Retrying stream ${streamId} that previously was in ${streamValidation.actualState} state`);
              // Update to STARTING state
              await updateDatabaseStreamState(streamId, "STARTING", userId as string);
            } else {
              // For any other unexpected state, log a warning but continue
              logger.warn(`[WebRTC] Stream ${streamId} in unexpected state: ${streamValidation.actualState}`);
            }
          }

          // Get the room
          const room = await getOrCreateRoom(streamId, userId as string);

          // Store that this is a broadcaster in the socket data for later reference
          socket.data.isBroadcaster = true;
          socket.data.streamId = streamId;

          // Enhanced debugging to log the room peer state
          logger.debug(
            `[WebRTC] Room peer state before broadcaster ready check:`,
            {
              streamId,
              socketId: socket.id,
              peersInRoom: Array.from(room.peers.keys()),
              peerExists: room.peers.has(socket.id),
            }
          );

          // Check for existing broadcasters for this stream but with different socket IDs
          if (userId) {
            const existingConnection = findExistingUserConnection(
              room,
              userId as string,
              isStreamer
            );

            if (
              existingConnection &&
              existingConnection.socketId !== socket.id
            ) {
              logger.warn(
                `[WebRTC] Found existing broadcaster connection for user ${userId}`,
                {
                  existingSocketId: existingConnection.socketId,
                  newSocketId: socket.id,
                }
              );

              // Remove the existing connection to prevent duplicates
              if (removeExistingPeer(room, existingConnection.socketId)) {
                logger.info(
                  `[WebRTC] Successfully removed stale broadcaster connection ${existingConnection.socketId}`
                );
              }
            }
          }

          // Get peer from the room - check if peer exists
          let peer = room.peers.get(socket.id);

          // If the peer doesn't exist, create it
          if (!peer) {
            logger.info(
              `[WebRTC] Broadcaster not found in peers map, creating it now: ${socket.id}`
            );

            // Create a new peer for this socket
            peer = {
              socketId: socket.id,
              userId: userId as string,
              username: username as string,
              sessionId: sessionId,
              isStreamer: true,
              transports: new Map(),
              producers: new Map(),
              consumers: new Map(),
              lastActivity: Date.now(),
            };

            // Add the peer to the room
            room.peers.set(socket.id, peer);
            room.activeSessions.set(sessionId, socket.id);

            logger.info(
              `[WebRTC] Added broadcaster peer to room: ${socket.id}`
            );
          } else {
            // Update existing peer details
            logger.info(
              `[WebRTC] Found existing broadcaster peer: ${socket.id}`
            );

            // Make sure isStreamer flag is set to true
            peer.isStreamer = true;
            peer.lastActivity = Date.now();
          }

          // Ensure only one streamer per room
          ensureOnlyOneStreamerInRoom(io, room, userId as string, socket.id);

          // Find active producers from this streamer
          const activeProducers: Array<{
            producerId: string;
            kind: string;
            peerId: string;
          }> = [];

          peer.producers.forEach((producer) => {
            activeProducers.push({
              producerId: producer.id,
              kind: producer.kind,
              peerId: socket.id,
            });
          });

          // Log the room state for debugging
          logger.debug(`[WebRTC] Room state after broadcaster ready:`, {
            streamId,
            peersCount: room.peers.size,
            peerSocketIds:
              Array.from(room.peers.keys()).slice(0, 10) +
              (room.peers.size > 10
                ? `... and ${room.peers.size - 10} more`
                : ""),
            activeBroadcasters: Array.from(room.peers.values())
              .filter((p) => p.isStreamer)
              .map((p) => ({
                socketId: p.socketId,
                userId: p.userId,
                producers: p.producers.size,
              })),
          });

          logger.info(
            `[WebRTC] Notifying viewers that broadcaster is ready with ${activeProducers.length} producers`,
            {
              streamId,
              broadcasterSocketId: socket.id,
              producers: activeProducers.map((p) => ({
                id: p.producerId,
                kind: p.kind,
              })),
            }
          );

          // At this point, all the setup is complete - WebRTC is established
          // Update database to reflect that stream is now LIVE
          try {
            // Clear any stale error state if this was retried
            if (userId) {
              const success = await updateDatabaseStreamState(streamId, "LIVE", userId as string);
              
              if (success) {
                logger.info(`[WebRTC] Successfully updated database state to LIVE for stream ${streamId}`);
                
                // Emit stream state change event
                emitStreamStateChange({
                  streamId,
                  state: "LIVE",
                  userId: userId as string,
                  timestamp: new Date().toISOString(),
                  metadata: { socketId: socket.id }
                });
              } else {
                logger.warn(`[WebRTC] Failed to update database state for stream ${streamId}`);
                // Continue anyway - the stream is technically working
              }
            }
          } catch (err) {
            logger.error(`[WebRTC] Error updating database state for stream ${streamId}`, {
              error: formatError(err),
              streamId,
              userId
            });
            // Continue anyway - the stream is technically working
          }
          
          // Notify all viewers
          io.to(`stream:${streamId}`).emit("broadcaster_ready", {
            streamId,
            broadcasterSocketId: socket.id,
            broadcasterUserId: userId,
            broadcasterUsername: username,
            activeProducers: activeProducers,
          });

          // Send a success response directly to the broadcaster
          socket.emit("broadcaster_ready_confirmed", {
            success: true,
            roomState: {
              totalPeers: room.peers.size,
              viewers: room.peers.size - 1, // exclude self
              streamId,
            },
          });

          logger.info(
            `[WebRTC] Stream ${streamId} is now active with broadcaster ${userId}`
          );

          // Initialize heartbeat tracking for this broadcaster
          broadcasterHeartbeats.set(socket.id, Date.now());
          
          // Set up heartbeat check interval
          const heartbeatInterval = setInterval(() => {
            // Skip if socket is no longer connected or heartbeat entry was removed
            if (!socket.connected || !broadcasterHeartbeats.has(socket.id)) {
              clearInterval(heartbeatInterval);
              return;
            }
            
            const lastHeartbeat = broadcasterHeartbeats.get(socket.id);
            if (!lastHeartbeat) return;
            
            const elapsed = Date.now() - lastHeartbeat;
            if (elapsed > HEARTBEAT_TIMEOUT) {
              logger.warn(`[Heartbeat] Broadcaster ${socket.id} timed out after ${elapsed}ms`, {
                streamId: socket.data.streamId,
                userId: socket.data.userId
              });
              
              // Handle as if the broadcaster disconnected
              handleBroadcasterDisconnection(socket.data.streamId, socket.data.userId, socket);
              socket.disconnect(true);
              clearInterval(heartbeatInterval);
            }
          }, HEARTBEAT_INTERVAL);

          // Clean up on disconnect
          socket.on("disconnect", () => {
            clearInterval(heartbeatInterval);
            broadcasterHeartbeats.delete(socket.id);
          });
        } catch (err) {
          logger.error(`[WebRTC] Error in broadcaster_ready handler`, {
            error: formatError(err),
            socketId: socket.id,
            streamId,
          });

          socket.emit("error", {
            message: "Server error occurred. Please try again.",
            code: "INTERNAL_ERROR",
            details: formatError(err),
          });
        }
      });

      // Handle viewer ready
      socket.on("viewer_ready", async (data) => {
        try {
          if (!streamId) {
            return;
          }

          logEvent("viewer_ready", socket.id, {
            streamId,
            sessionId: data.sessionId || sessionId,
            userId,
          });

          // Get the room
          const room = await getOrCreateRoom(streamId);

          // Mark this socket as a viewer (not a streamer)
          const peer = room.peers.get(socket.id);
          if (peer) {
            peer.isStreamer = false;
            peer.lastActivity = Date.now();
          } else {
            logger.warn(`[WebRTC] Viewer not found in peers map: ${socket.id}`);
          }

          // Find the streamer in this room if any
          let streamerPeer: Peer | null = null;
          let streamerSocketId: string | null = null;
          for (const [socketId, remotePeer] of room.peers.entries()) {
            if (remotePeer.isStreamer) {
              streamerPeer = remotePeer;
              streamerSocketId = socketId;
              break;
            }
          }

          // Find active producers from the streamer
          const activeProducers: Array<{
            producerId: string;
            kind: string;
            peerId: string;
          }> = [];

          if (streamerPeer) {
            streamerPeer.producers.forEach((producer) => {
              activeProducers.push({
                producerId: producer.id,
                kind: producer.kind,
                peerId: streamerSocketId as string,
              });
            });
          }

          logger.info(
            `[WebRTC] Notifying viewer about ${activeProducers.length} active producers`,
            {
              streamId,
              viewerSocketId: socket.id,
              producers: activeProducers.map((p) => ({
                id: p.producerId,
                kind: p.kind,
              })),
            }
          );

          // Send a response directly to this viewer with active producers
          socket.emit("viewer_ready_response", {
            streamId,
            hasActiveStreamer: !!streamerPeer,
            broadcasterSocketId: streamerSocketId,
            broadcasterUserId: streamerPeer?.userId,
            activeProducers: activeProducers,
          });

          // Also notify the broadcaster about this viewer
          if (streamerSocketId) {
            socket.to(streamerSocketId).emit("viewer_connected", {
              streamId,
              viewerSocketId: socket.id,
              viewerUserId: userId,
              viewerUsername: username,
            });
          }

          logger.info(`[WebRTC] Viewer ${userId} ready for stream ${streamId}`);
        } catch (err) {
          logger.error(`[WebRTC] Error in viewer_ready handler`, {
            error: formatError(err),
            socketId: socket.id,
            streamId,
          });
        }
      });

      // Handle client disconnect
      socket.on("disconnect", (reason) => {
        logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`, {
          streamId,
          userId,
          sessionId
        });
        
        // Clear heartbeat tracking for this socket
        broadcasterHeartbeats.delete(socket.id);
        
        // Clean up WebRTC resources if the stream exists
        if (streamId) {
          try {
            const room = rooms.get(streamId);
            if (room) {
              // Clean up the peer using our helper function
              const cleanupSuccess = removeExistingPeer(room, socket.id);

              if (cleanupSuccess) {
                logger.info(
                  `[WebRTC] Successfully cleaned up peer on disconnect`,
                  {
                    socketId: socket.id,
                    streamId,
                    userId: userId || "anonymous",
                  }
                );
              }

              // Check if the room is now empty and log its status
              logger.debug(`[WebRTC] Room status after disconnect:`, {
                streamId,
                peersRemaining: room.peers.size,
                peerSocketIds: Array.from(room.peers.keys()),
                sessionCount: room.activeSessions.size,
              });
              
              // If this was a broadcaster disconnecting, we need to handle stream state
              if (socket.data.isBroadcaster) {
                // Use our dedicated handler for broadcaster disconnections
                if (userId) {
                  // Check if this was an abrupt disconnect vs intentional end
                  if (["transport close", "ping timeout", "transport error"].includes(reason)) {
                    logger.warn(`[WebRTC] Broadcaster disconnected unexpectedly: ${reason}`);
                    
                    // Use dedicated handler for abrupt disconnections which will mark as INTERRUPTED
                    handleBroadcasterDisconnection(streamId, userId as string, socket);
                  } else {
                    // Normal disconnect, update database to ENDED
                    logger.info(`[WebRTC] Broadcaster disconnected normally, ending stream ${streamId}`);
                    
                    updateDatabaseStreamState(streamId, "ENDED", userId as string)
                      .then(success => {
                        if (success) {
                          logger.info(`[WebRTC] Successfully ended stream ${streamId} in database`);
                          
                          // Emit stream end event
                          emitStreamStateChange({
                            streamId,
                            state: "ENDED",
                            userId: userId as string,
                            timestamp: new Date().toISOString(),
                            metadata: { reason }
                          });
                        } else {
                          logger.warn(`[WebRTC] Failed to update database state for stream ${streamId}`);
                        }
                      })
                      .catch(err => {
                        logger.error(`[WebRTC] Error updating database state for stream ${streamId}`, {
                          error: formatError(err),
                          streamId,
                          userId
                        });
                      });
                  }
                }
              }
            }
          } catch (err) {
            logger.error(`[WebRTC] Error cleaning up peer on disconnect`, {
              error: formatError(err),
              socketId: socket.id,
              streamId,
            });
          }
        }

        // Notify others in the stream if this was a broadcaster
        if (socket.data.isBroadcaster && streamId) {
          socket.to(`stream:${streamId}`).emit("broadcaster_disconnected", {
            broadcasterSocketId: socket.id,
            broadcasterSessionId: sessionId,
            streamId,
            reason,
          });
        }
      });

      // Handle WebRTC errors
      socket.on("webrtc_error", (data) => {
        logEvent("client_error", socket.id, {
          streamId: streamId || "no-stream",
          sessionId,
          error: data.error,
          details: data.details || {},
        });

        // Notify the client that we received their error
        socket.emit("webrtc_error_acknowledged", {
          errorId: data.errorId || Date.now(),
          message: "Error logged on server",
        });
      });

      // Debug route
      socket.on("debug", (data) => {
        logEvent("debug", socket.id, {
          ...data,
          sessionId,
        });

        // Send back server stats
        socket.emit("debug_response", {
          serverTime: new Date().toISOString(),
          connectedClients: Object.keys(io.sockets.sockets).length,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          rooms: socket.rooms,
        });
      });
      
      // Handle stream state changes from API or other sources
      socket.on("stream_state_changed", async (data) => {
        if (!data.streamId) return;
        
        logEvent("stream_state_changed", socket.id, {
          streamId: data.streamId,
          state: data.status,
          userId,
          source: data.source || "client"
        });
        
        const streamId = data.streamId;
        
        // Handle different states
        switch (data.status) {
          case "ENDED":
            // If stream ended, notify users and handle room cleanup
            try {
              const room = rooms.get(streamId);
              if (room) {
                // Notify all clients in the room
                io.to(`stream:${streamId}`).emit("stream_ended", {
                  streamId: streamId,
                  reason: "Stream ended by broadcaster",
                  source: data.source || "client"
                });
                
                // Log event to track state synchronization
                emitStreamStateChange({
                  streamId,
                  state: "ENDED",
                  userId: userId as string,
                  timestamp: new Date().toISOString(),
                  metadata: { source: data.source || "client" }
                });
                
                // Close all producers if this was externally triggered
                if (data.source === "api") {
                  logger.info(`[WebRTC] API-triggered stream end, closing producers for ${streamId}`);
                  // Find all broadcasting peers and close their producers
                  for (const peer of room.peers.values()) {
                    if (peer.isStreamer) {
                      peer.producers.forEach(producer => {
                        try {
                          producer.close();
                        } catch (err) {
                          logger.error(`[WebRTC] Error closing producer: ${err}`);
                        }
                      });
                    }
                  }
                }
              }
            } catch (err) {
              logger.error(`[WebRTC] Error handling stream end event: ${err}`);
            }
            break;
            
          case "LIVE":
            // If stream started, verify room exists
            try {
              // Get or create room if needed
              let room = rooms.get(streamId);
              if (!room) {
                room = await getOrCreateRoom(streamId, userId as string);
                logger.info(`[WebRTC] Created room for LIVE stream ${streamId} from external event`);
              }
              
              // Log event to track state synchronization
              emitStreamStateChange({
                streamId,
                state: "LIVE",
                userId: userId as string,
                timestamp: new Date().toISOString(),
                metadata: { source: data.source || "client" }
              });
            } catch (err) {
              logger.error(`[WebRTC] Error handling stream start event: ${err}`);
            }
            break;
            
          case "PAUSED":
            // Handle pause state if needed
            emitStreamStateChange({
              streamId,
              state: "PAUSED",
              userId: userId as string,
              timestamp: new Date().toISOString(),
              metadata: { source: data.source || "client" }
            });
            break;
        }
      });

      // Handle getRouterRtpCapabilities - CRITICAL for WebRTC setup
      socket.on("getRouterRtpCapabilities", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logEvent("getRouterRtpCapabilities", socket.id, {
            streamId,
            sessionId: data.sessionId || sessionId,
            userId,
            connectionType: socket.data.connectionType,
          });

          const room = await getOrCreateRoom(streamId);

          // Check for existing user connections - important for reconnection scenarios
          let duplicateConnection = false;
          let existingSocketId = null;

          if (userId) {
            const existingConnection = findExistingUserConnection(
              room,
              userId as string,
              isStreamer
            );

            if (
              existingConnection &&
              existingConnection.socketId !== socket.id
            ) {
              duplicateConnection = true;
              existingSocketId = existingConnection.socketId;
              logger.warn(
                `[WebRTC] Found existing ${
                  isStreamer ? "streamer" : "viewer"
                } connection for user`,
                {
                  userId,
                  existingSocketId: existingConnection.socketId,
                  newSocketId: socket.id,
                }
              );

              // Remove the existing connection to prevent duplicates
              if (removeExistingPeer(room, existingConnection.socketId)) {
                logger.info(
                  `[WebRTC] Successfully removed existing connection ${existingConnection.socketId} for user ${userId}`
                );
              }
            }
          }

          // Get the peer if it already exists
          let peer = room.peers.get(socket.id);

          // Create a new peer if it doesn't exist
          if (!peer) {
            logger.info(`[WebRTC] Creating new peer for socket: ${socket.id}`, {
              streamId,
              userId,
              isStreamer,
              connectionType: socket.data.connectionType,
            });

            // Create a new peer for this connection - THIS IS CRITICAL
            peer = {
              socketId: socket.id,
              userId: userId as string,
              username: username as string,
              sessionId: sessionId,
              isStreamer,
              transports: new Map(),
              producers: new Map(),
              consumers: new Map(),
              lastActivity: Date.now(),
              rtpCapabilities: data.rtpCapabilities, // Store client RTP capabilities if provided
              connectionType: socket.data.connectionType, // Store the connection type
            };

            // Add the peer to the room
            room.peers.set(socket.id, peer);
            room.activeSessions.set(sessionId, socket.id);

            logger.info(`[WebRTC] Added peer to room for: ${socket.id}`, {
              streamId,
              userId,
              isStreamer,
              connectionType: socket.data.connectionType,
            });
          } else {
            // Update existing peer
            logger.info(`[WebRTC] Updating existing peer: ${socket.id}`, {
              streamId,
              userId,
              isStreamer,
              connectionType: socket.data.connectionType,
            });

            // Update last activity timestamp, connection type, and RTP capabilities
            peer.lastActivity = Date.now();
            peer.connectionType = socket.data.connectionType;
            if (data.rtpCapabilities) {
              peer.rtpCapabilities = data.rtpCapabilities;
            }
          }

          // Special handling for streamer connections to enforce one streamer per room
          if (isStreamer) {
            ensureOnlyOneStreamerInRoom(io, room, userId as string, socket.id);
          }

          // Log the current room state after updates
          logger.debug(`[WebRTC] Room state after capability request:`, {
            streamId,
            peersCount: room.peers.size,
            peerSocketIds: Array.from(room.peers.keys()),
            sessionCount: room.activeSessions.size,
          });

          // Return the router capabilities with loopback flag
          callback({
            rtpCapabilities: room.router.rtpCapabilities,
            duplicateConnection,
            existingSocketId,
            isLoopback: socket.data.connectionType === "loopback",
          });
        } catch (err) {
          logger.error("[WebRTC] Error getting router capabilities", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
            connectionType: socket.data.connectionType,
          });
          callback({ error: formatError(err) });
        }
      });

      // Handle createProducerTransport with enhanced loopback detection
      socket.on("createProducerTransport", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logEvent("createProducerTransport", socket.id, {
            streamId,
            userId,
            isStreamer,
            connectionType: socket.data.connectionType,
          });

          const room = await getOrCreateRoom(streamId);

          // Update peer activity timestamp
          const peer = room.peers.get(socket.id);
          if (peer) {
            peer.lastActivity = Date.now();
            peer.connectionType = socket.data.connectionType;
          } else {
            return callback({ error: "Peer not found" });
          }

          // Get appropriate WebRTC transport config based on connection type (loopback or standard)
          const transportConfig = getAppropriateIceConfiguration(socket);

          // Create a WebRTC transport
          const transport = await room.router.createWebRtcTransport(
            transportConfig
          );

          // Store the transport
          peer.transports.set(transport.id, transport);

          // Monitor ICE connection state for loopback connections
          transport.on("icestatechange", (iceState) => {
            logger.info(
              `[WebRTC] ICE state changed to ${iceState} for transport`,
              {
                transportId: transport.id,
                socketId: socket.id,
                isLoopback: socket.data.connectionType === "loopback",
                streamId,
              }
            );
          });

          // Set up transport close handler
          transport.on("routerclose", () => {
            transport.close();
            peer.transports.delete(transport.id);
          });

          // Return transport parameters
          callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            // For loopback connections, provide additional guidance
            isLoopback: socket.data.connectionType === "loopback",
          });

          // If this is a streamer, enforce only one streamer per room
          if (isStreamer) {
            ensureOnlyOneStreamerInRoom(io, room, userId as string, socket.id);
          }
        } catch (error) {
          logger.error(`[WebRTC] Error creating producer transport`, {
            error,
            streamId,
            socketId: socket.id,
            isLoopback: socket.data.connectionType === "loopback",
          });
          callback({ error: "Error creating producer transport" });
        }
      });

      // Handle createConsumerTransport with enhanced loopback detection
      socket.on("createConsumerTransport", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logEvent("createConsumerTransport", socket.id, {
            streamId,
            sessionId: data.sessionId || sessionId,
            userId,
            connectionType: socket.data.connectionType,
          });

          const room = await getOrCreateRoom(streamId);
          const peer = room.peers.get(socket.id);

          if (!peer) {
            throw new Error("Peer not found, please reconnect");
          }

          // Update peer activity timestamp and connection type
          peer.lastActivity = Date.now();
          peer.connectionType = socket.data.connectionType;

          // Get appropriate WebRTC transport config based on connection type
          const transportConfig = getAppropriateIceConfiguration(socket);

          // Create a new WebRTC transport on the server
          const transport = await room.router.createWebRtcTransport(
            transportConfig
          );

          // Store the transport
          peer.transports.set(transport.id, transport);

          // Monitor ICE connection state for loopback connections
          transport.on("icestatechange", (iceState) => {
            logger.info(`[WebRTC] Consumer ICE state changed to ${iceState}`, {
              transportId: transport.id,
              socketId: socket.id,
              isLoopback: socket.data.connectionType === "loopback",
              streamId,
            });
          });

          // Return transport parameters to the client
          callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            isLoopback: socket.data.connectionType === "loopback",
          });
        } catch (err) {
          logger.error("[WebRTC] Error creating consumer transport", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
            isLoopback: socket.data.connectionType === "loopback",
          });
          callback({ error: formatError(err) });
        }
      });

      // Handle connectTransport
      socket.on("connectTransport", async (data, callback) => {
        try {
          if (!streamId || !data.transportId || !data.dtlsParameters) {
            return callback({ error: "Missing required parameters" });
          }

          logEvent("connectTransport", socket.id, {
            streamId,
            transportId: data.transportId,
            userId,
          });

          const room = await getOrCreateRoom(streamId);

          // Update peer activity timestamp
          const peer = room.peers.get(socket.id);
          if (!peer) {
            return callback({ error: "Peer not found" });
          }

          peer.lastActivity = Date.now();

          // Get the transport
          const transport = peer.transports.get(data.transportId);
          if (!transport) {
            return callback({ error: "Transport not found" });
          }

          // Connect the transport
          await transport.connect({ dtlsParameters: data.dtlsParameters });

          logger.info(`[WebRTC] Transport connected successfully`, {
            transportId: data.transportId,
            socketId: socket.id,
          });

          callback({ connected: true });
        } catch (error) {
          logger.error(`[WebRTC] Error connecting transport`, {
            error,
            streamId,
            socketId: socket.id,
            transportId: data.transportId,
          });
          callback({ error: "Error connecting transport" });
        }
      });

      // Handle produce
      socket.on("produce", async (data, callback) => {
        try {
          if (
            !streamId ||
            !data.transportId ||
            !data.kind ||
            !data.rtpParameters
          ) {
            return callback({ error: "Missing required parameters" });
          }

          logEvent("produce", socket.id, {
            streamId,
            transportId: data.transportId,
            kind: data.kind,
            userId,
            isStreamer,
          });

          const room = await getOrCreateRoom(streamId);

          // Update peer activity timestamp
          const peer = room.peers.get(socket.id);
          if (!peer) {
            return callback({ error: "Peer not found" });
          }

          peer.lastActivity = Date.now();

          // Get the transport
          const transport = peer.transports.get(data.transportId);
          if (!transport) {
            return callback({ error: "Transport not found" });
          }

          // Create producer
          const producer = await transport.produce({
            kind: data.kind,
            rtpParameters: data.rtpParameters,
            appData: data.appData || {},
          });

          // Store the producer
          peer.producers.set(producer.id, producer);

          // Set up producer close handler
          producer.on("transportclose", () => {
            producer.close();
            peer.producers.delete(producer.id);
          });

          logger.info(`[WebRTC] Producer created successfully`, {
            producerId: producer.id,
            kind: data.kind,
            socketId: socket.id,
          });

          // Notify all consumers about the new producer
          if (peer.isStreamer) {
            socket.to(`stream:${streamId}`).emit("new-producer", {
              producerId: producer.id,
              kind: data.kind,
            });
          }

          callback({ id: producer.id });
        } catch (error) {
          logger.error(`[WebRTC] Error producing media`, {
            error,
            streamId,
            socketId: socket.id,
            transportId: data.transportId,
          });
          callback({ error: "Error producing media" });
        }
      });

      // Handle getProducers
      socket.on("getProducers", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logEvent("getProducers", socket.id, {
            streamId,
            userId,
          });

          const room = await getOrCreateRoom(streamId);
          const producers: Array<{
            producerId: string;
            kind: string;
            peerId: string;
          }> = [];

          // Find all producers in the room
          for (const [socketId, peer] of room.peers) {
            if (peer.isStreamer) {
              // Add all producers from this streamer with metadata
              peer.producers.forEach((producer) => {
                producers.push({
                  producerId: producer.id,
                  kind: producer.kind,
                  peerId: socketId,
                });
              });
            }
          }

          logger.info(
            `[WebRTC] Found ${producers.length} producers in room ${streamId}`,
            {
              producers: producers.map((p) => ({
                id: p.producerId,
                kind: p.kind,
              })),
            }
          );

          callback(producers);
        } catch (err) {
          logger.error("[WebRTC] Error getting producers", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
          });
          callback({ error: formatError(err) });
        }
      });

      // Handle consume
      socket.on("consume", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logEvent("consume", socket.id, {
            streamId,
            producerId: data.producerId,
            transportId: data.transportId,
            userId,
          });

          const room = await getOrCreateRoom(streamId);
          const peer = room.peers.get(socket.id);

          if (!peer) {
            throw new Error("Peer not found, please reconnect");
          }

          // Update peer activity timestamp
          peer.lastActivity = Date.now();

          // Get the transport
          const transport = peer.transports.get(data.transportId);
          if (!transport) {
            throw new Error(`Transport not found: ${data.transportId}`);
          }

          // Find the producer
          let producer = null;
          let producerPeer = null;

          // Search for the producer in all peers
          for (const [socketId, remotePeer] of room.peers.entries()) {
            const foundProducer = remotePeer.producers.get(data.producerId);
            if (foundProducer) {
              producer = foundProducer;
              producerPeer = remotePeer;
              break;
            }
          }

          if (!producer) {
            throw new Error(`Producer not found: ${data.producerId}`);
          }

          // Check if the client can consume this producer
          if (
            !peer.rtpCapabilities ||
            !room.router.canConsume({
              producerId: producer.id,
              rtpCapabilities: data.rtpCapabilities,
            })
          ) {
            throw new Error(
              "Cannot consume this producer with your device capabilities"
            );
          }

          // Create the consumer
          const consumer = await transport.consume({
            producerId: producer.id,
            rtpCapabilities: data.rtpCapabilities,
            paused: data.paused || true, // Start paused to avoid initial packet loss
          });

          // Store the consumer
          peer.consumers.set(consumer.id, consumer);

          // Handle consumer events
          consumer.on("producerclose", () => {
            logger.info(
              `[WebRTC] Producer closed for consumer: ${consumer.id}`,
              {
                socketId: socket.id,
                consumerId: consumer.id,
              }
            );

            // Remove the consumer
            peer.consumers.delete(consumer.id);

            // Notify the client
            socket.emit("consumerClosed", { consumerId: consumer.id });
          });

          // Return consumer info
          callback({
            consumerId: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            producerUserId: producerPeer?.userId || "unknown",
          });
        } catch (err) {
          logger.error("[WebRTC] Error consuming", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
          });
          callback({ error: formatError(err) });
        }
      });

      // Handle resumeConsumer
      socket.on("resumeConsumer", async (data, callback) => {
        try {
          if (!streamId || !data.consumerId) {
            return callback({ error: "Missing required parameters" });
          }

          logEvent("resumeConsumer", socket.id, {
            streamId,
            consumerId: data.consumerId,
            userId,
          });

          const room = await getOrCreateRoom(streamId);
          const peer = room.peers.get(socket.id);

          if (!peer) {
            throw new Error("Peer not found, please reconnect");
          }

          // Find the consumer
          const consumer = peer.consumers.get(data.consumerId);

          if (!consumer) {
            throw new Error(`Consumer not found: ${data.consumerId}`);
          }

          // Resume the consumer
          await consumer.resume();

          callback({ success: true });
        } catch (err) {
          logger.error("[WebRTC] Error resuming consumer", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
            consumerId: data.consumerId,
          });
          callback({ error: formatError(err) });
        }
      });

      // Update the consumer connectRtpCapabilities handler to save rtpCapabilities
      socket.on("connectRtpCapabilities", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ success: false, error: "No streamId provided" });
          }

          logEvent("connectRtpCapabilities", socket.id, {
            streamId,
            userId,
            isStreamer,
            hasRtpCapabilities: !!data.rtpCapabilities,
            isReconnection: !!data.isReconnection,
          });

          const room = await getOrCreateRoom(streamId);
          let peer = room.peers.get(socket.id);

          // Handle reconnection scenario
          const isReconnection = !!data.isReconnection;
          let previousSessionFound = false;

          if (isReconnection && data.sessionId) {
            logger.info(
              `[WebRTC] Processing reconnection with session recovery`,
              {
                streamId,
                userId,
                sessionId: data.sessionId,
              }
            );

            // Check if the provided session ID is associated with an active socket
            const existingSocketId = room.activeSessions.get(data.sessionId);
            if (existingSocketId && existingSocketId !== socket.id) {
              const existingPeer = room.peers.get(existingSocketId);

              if (existingPeer) {
                logger.info(
                  `[WebRTC] Found existing peer for session during reconnection`,
                  {
                    streamId,
                    userId,
                    sessionId: data.sessionId,
                    existingSocketId,
                  }
                );

                // Transfer information from the old peer to the new one if needed
                previousSessionFound = true;

                // If old peer exists but is inactive, clean it up
                if (Date.now() - existingPeer.lastActivity > 30000) {
                  // 30 seconds
                  logger.info(
                    `[WebRTC] Removing stale peer during reconnection`,
                    {
                      streamId,
                      userId,
                      sessionId: data.sessionId,
                      existingSocketId,
                    }
                  );

                  removeExistingPeer(room, existingSocketId);
                  room.activeSessions.delete(data.sessionId);
                  room.activeSessions.set(data.sessionId, socket.id);
                }
              }
            }
          }

          if (!peer) {
            logger.warn(
              `[WebRTC] Peer not found for RTP capabilities, creating one: ${socket.id}`,
              {
                streamId,
                peers: Array.from(room.peers.keys()),
                isReconnection,
              }
            );

            // Create a new peer since it doesn't exist yet
            peer = {
              socketId: socket.id,
              userId: userId as string,
              username: username as string,
              sessionId:
                isReconnection && data.sessionId ? data.sessionId : sessionId,
              isStreamer,
              transports: new Map(),
              producers: new Map(),
              consumers: new Map(),
              lastActivity: Date.now(),
              rtpCapabilities: data.rtpCapabilities,
              connectionType: socket.data.connectionType, // Store the connection type
            };

            // Add the peer to the room
            room.peers.set(socket.id, peer);
            room.activeSessions.set(peer.sessionId, socket.id);

            logger.info(
              `[WebRTC] Added new peer for RTP capabilities: ${socket.id}`,
              {
                streamId,
                userId,
                isStreamer,
                isReconnection,
              }
            );
          } else {
            // Store the client's RTP capabilities
            peer.rtpCapabilities = data.rtpCapabilities;
            peer.lastActivity = Date.now();
            peer.connectionType = socket.data.connectionType;

            logger.info(
              `[WebRTC] Updated RTP capabilities for existing peer: ${socket.id}`
            );
          }

          // Check if there are any active producers in the room (for viewers)
          const activeProducers: Array<{
            producerId: string;
            kind: string;
            peerId: string;
          }> = [];

          if (!peer.isStreamer) {
            for (const [peerSocketId, remotePeer] of room.peers.entries()) {
              if (remotePeer.isStreamer) {
                remotePeer.producers.forEach((producer) => {
                  activeProducers.push({
                    producerId: producer.id,
                    kind: producer.kind,
                    peerId: peerSocketId,
                  });
                });
              }
            }
          }

          // Log producers found for debugging
          if (activeProducers.length > 0) {
            logger.info(
              `[WebRTC] Found ${activeProducers.length} active producers for viewer`,
              {
                streamId,
                producerIds: activeProducers.map((p) => p.producerId),
              }
            );
          }

          // Send back the success response with any available producer info
          callback({
            success: true,
            activeProducers:
              activeProducers.length > 0 ? activeProducers : undefined,
          });
        } catch (err) {
          logger.error("[WebRTC] Error saving RTP capabilities", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
          });
          callback({
            success: false,
            error: formatError(err),
            reconnect: true, // Suggest reconnect on serious errors
          });
        }
      });

      // Handle heartbeat from client
      socket.on("heartbeat", () => {
        if (socket.data.isBroadcaster) {
          broadcasterHeartbeats.set(socket.id, Date.now());
          logger.debug(`[Heartbeat] Received from broadcaster ${socket.id}`, {
            streamId: socket.data.streamId,
            userId: socket.data.userId
          });
        }
      });
    });

    // Log server started
    logger.info("[Socket.IO] Server initialized and ready for connections", {
      path: io.path(),
      serverOptions: {
        transports: io._opts.transports,
        cors: io._opts.cors ? "enabled" : "disabled",
        allowUpgrades: io._opts.allowUpgrades,
      },
    });

    // Add debug logging for Socket.IO
    io.engine.on("connection_error", (err) => {
      logger.error("[Socket.IO] Connection error:", err);
    });

    return io;
  } catch (error) {
    logger.error("[Socket.IO] Error initializing Socket.IO server", { error });
    throw error;
  }
}

// Define the broadcaster disconnection handler function at the end of the file or before export
async function handleBroadcasterDisconnection(streamId: string, userId: string, socket: Socket) {
  if (!streamId || !userId) {
    logger.warn(`[StreamHandler] Missing streamId or userId for disconnection handler`, {
      socketId: socket.id,
      streamId,
      userId
    });
    return;
  }

  try {
    logger.info(`[StreamHandler] Handling broadcaster disconnection`, {
      streamId,
      userId,
      socketId: socket.id
    });
    
    // 1. Get current stream state
    const { isValid, actualState } = await validateStreamState(streamId);
    if (!isValid) {
      logger.warn(`[StreamHandler] Cannot process disconnection - stream not found: ${streamId}`);
      return;
    }
    
    // 2. Only process if stream is in LIVE or PAUSED state
    if (actualState !== "LIVE" && actualState !== "PAUSED") {
      logger.info(`[StreamHandler] Stream ${streamId} is not active (${actualState}), no cleanup needed`);
      return;
    }
    
    // 3. Get the room if it exists
    const room = rooms.get(streamId);
    if (!room) {
      logger.warn(`[StreamHandler] Room for stream ${streamId} not found, marking as INTERRUPTED`);
      await updateDatabaseStreamState(streamId, "INTERRUPTED", userId);
      return;
    }
    
    // 4. Close all transports for this broadcaster
    const peer = room.peers.get(socket.id);
    if (peer) {
      logger.info(`[StreamHandler] Cleaning up broadcaster transports for ${streamId}`);
      
      // Close all transports for this peer
      for (const transport of peer.transports.values()) {
        try {
                     // Close producers associated with this transport
           for (const producer of peer.producers.values()) {
             try {
               producer.close();
             } catch (e: unknown) {
               const errMsg = e instanceof Error ? e.message : String(e);
               logger.error(`[StreamHandler] Error closing producer: ${errMsg}`);
             }
           }
           
           // Close the transport
           transport.close();
         } catch (e: unknown) {
           const errMsg = e instanceof Error ? e.message : String(e);
           logger.error(`[StreamHandler] Error closing transport: ${errMsg}`);
         }
      }
      
      // Remove peer from room
      room.peers.delete(socket.id);
    }
    
    // 5. If this was the last broadcaster, mark stream as interrupted
    const hasOtherBroadcasters = Array.from(room.peers.values())
      .some(p => p.isStreamer && p.socketId !== socket.id);
    
    if (!hasOtherBroadcasters) {
      logger.info(`[StreamHandler] No remaining broadcasters for ${streamId}, marking as INTERRUPTED`);
      await updateDatabaseStreamState(streamId, "INTERRUPTED", userId);
      
             // Notify all viewers about the interrupted stream
       const httpServer = (global as any).server as ExtendedHttpServer;
       if (httpServer?.io) {
         httpServer.io.to(`stream:${streamId}`).emit('stream_interrupted', {
           streamId,
           reason: "broadcaster_disconnected"
         });
       }
      
      // Optionally close the entire room if no viewers either
      if (room.peers.size === 0) {
        cleanupRoom(streamId);
      }
    }
  } catch (error) {
    logger.error(`[StreamHandler] Error handling broadcaster disconnection`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      streamId,
      userId
    });
    
    // Ensure stream is marked as interrupted even if cleanup fails
    await updateDatabaseStreamState(streamId, "INTERRUPTED", userId);
  }
}

// Add room cleanup helper function
function cleanupRoom(streamId: string) {
  const room = rooms.get(streamId);
  if (!room) return;
  
  try {
    // Close all peers' transports
    for (const peer of room.peers.values()) {
      for (const transport of peer.transports.values()) {
        transport.close();
      }
    }
    
    // Close the router
    room.router.close();
    
    // Remove the room from the map
    rooms.delete(streamId);
    
    logger.info(`[StreamHandler] Room for stream ${streamId} cleaned up and removed`);
  } catch (error) {
    logger.error(`[StreamHandler] Failed to clean up room ${streamId}`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
