// src/lib/socket/socketHandler.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import * as mediasoup from "mediasoup";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";

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
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
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

// Global state
export interface ExtendedHttpServer extends HttpServer {
  io?: SocketIOServer;
}
// Store mediasoup worker in global scope for graceful shutdown
// @ts-ignore
global.mediasoupWorker = null;
let mediasoupWorker: MediasoupTypes.Worker | null = null;

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

interface Peer {
  socketId: string;
  userId: string;
  username: string;
  sessionId: string;
  isStreamer: boolean;
  transports: Map<string, MediasoupTypes.WebRtcTransport>;
  producers: Map<string, MediasoupTypes.Producer>;
  consumers: Map<string, MediasoupTypes.Consumer>;
  lastActivity: number;
}
interface Room {
  router: MediasoupTypes.Router;
  peers: Map<string, Peer>;
  activeSessions: Map<string, string>;
}
const rooms = new Map<string, Room>();

// Set a reasonable session expiration time
const SESSION_EXPIRATION_TIME = 30 * 1000; // 30 seconds

// Periodically clean up stale sessions
setInterval(() => {
  rooms.forEach((room, streamId) => {
    const now = Date.now();

    // Clean up inactive peers
    room.peers.forEach((peer, socketId) => {
      if (now - peer.lastActivity > 60 * 1000) {
        // 1 minute inactive
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

// Helper functions (moved from route.ts)
async function startMediasoupWorker() {
  // First check if we have a worker in global scope
  // @ts-ignore
  if (global.mediasoupWorker && !global.mediasoupWorker.closed) {
    // @ts-ignore
    mediasoupWorker = global.mediasoupWorker;
    logger.info("[MediaSoup] Using existing worker from global scope.");
    return mediasoupWorker;
  }

  if (mediasoupWorker && !mediasoupWorker.closed) {
    logger.info("[MediaSoup] Worker already running.");
    return mediasoupWorker;
  }
  try {
    logger.info("[MediaSoup] Creating Mediasoup worker...");
    mediasoupWorker = await mediasoup.createWorker({
      logLevel: mediasoupAppConfig.worker.logLevel,
      logTags: mediasoupAppConfig.worker.logTags,
      rtcMinPort: mediasoupAppConfig.worker.rtcMinPort,
      rtcMaxPort: mediasoupAppConfig.worker.rtcMaxPort,
    });
    // Store in global scope for graceful shutdown
    // @ts-ignore
    global.mediasoupWorker = mediasoupWorker;

    mediasoupWorker.on("died", (error) => {
      logger.error("[MediaSoup] Worker died.", error);
      mediasoupWorker = null;
      // @ts-ignore
      global.mediasoupWorker = null;
      setTimeout(() => process.exit(1), 2000);
    });
    logger.info("[MediaSoup] Worker created successfully.");
    return mediasoupWorker;
  } catch (error) {
    logger.error("[MediaSoup] Failed to create Mediasoup worker:", error);
    throw error;
  }
}

async function getOrCreateRoom(streamId: string): Promise<Room> {
  let room = rooms.get(streamId);
  if (!room) {
    if (!mediasoupWorker || mediasoupWorker.closed) {
      await startMediasoupWorker();
      if (!mediasoupWorker)
        throw new Error("Mediasoup worker failed to initialize");
    }
    logger.info(`[MediaSoup] Creating new room for stream: ${streamId}`);
    const router = await mediasoupWorker.createRouter({
      mediaCodecs: mediasoupAppConfig.router.mediaCodecs,
    });
    room = {
      router,
      peers: new Map(),
      activeSessions: new Map(),
    };
    rooms.set(streamId, room);
  }
  return room;
}

// Function to find existing connections from the same user in a room
function findExistingUserConnection(
  room: Room,
  userId: string,
  isStreamerQuery: boolean
): Peer | null {
  // isStreamerQuery is the isStreamer status of the *new* connection attempt.
  if (!room) return null;
  for (const peer of room.peers.values()) {
    if (peer.userId === userId && peer.isStreamer === isStreamerQuery) {
      return peer; // Found an existing peer with same userId and same streamer status
    }
  }
  return null;
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

// Main exported function for server.js
export function initializeSocketIOServer(
  httpServer: HttpServer
): SocketIOServer {
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
    // Create Socket.IO server with CORS and WebSocket options
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // In production, restrict this to your domains
        methods: ["GET", "POST"],
        credentials: true,
      },
      // Allow all transports with WebSocket preferred
      transports: ["websocket", "polling"],
      allowUpgrades: true,
      // Path and settings
      path: "/socket.io/",
      serveClient: false, // Don't serve client files to save bandwidth
      connectTimeout: 45000, // 45 seconds (more than default 20s)
      // Polling settings
      pingTimeout: 30000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      // WebSocket specific settings
      maxHttpBufferSize: 1e8, // 100 MB max message size
      // Detailed logging
      // @ts-ignore - logger option is available in socket.io
      logger: {
        debug: (...args: any[]) => logger.debug("[Socket.IO Debug]", ...args),
        info: (...args: any[]) => logger.info("[Socket.IO Info]", ...args),
        warn: (...args: any[]) => logger.warn("[Socket.IO Warning]", ...args),
        error: (...args: any[]) => logger.error("[Socket.IO Error]", ...args),
      },
    });

    // Store the Socket.IO server instance on the HTTP server for later access
    (httpServer as ExtendedHttpServer).io = io;

    // Initialize MediaSoup worker
    createMediasoupWorker()
      .then((worker) => {
        mediasoupWorker = worker;
        // @ts-ignore
        global.mediasoupWorker = worker;
        logger.info("[MediaSoup] MediaSoup worker created successfully");
      })
      .catch((error) => {
        logger.error("[MediaSoup] Failed to create MediaSoup worker", {
          error,
        });
      });

    // Main Socket.IO connection handler
    io.on("connection", async (socket: Socket) => {
      // Extract client information
      const {
        streamId,
        userId,
        username = "Anonymous",
        isAnonymous = false,
      } = socket.handshake.query as {
        streamId?: string;
        userId?: string;
        username?: string;
        isAnonymous?: string | boolean;
      };

      const isAnonymousUser =
        isAnonymous === "true" || isAnonymous === "1" || isAnonymous === true;
      const clientIp =
        socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;

      // Generate a unique session ID for this connection combining timestamp, socket ID, and random string
      const randomStr = Math.random().toString(36).substring(2, 15);
      const sessionId = `${Date.now()}-${randomStr}-${Math.floor(
        Math.random() * 2000000000
      )}`;

      // Log connection
      logger.info(`[Socket.IO] Client connected`, {
        socketId: socket.id,
        sessionId,
        streamId: streamId || "no-stream",
        userId: userId || "anonymous",
        username: username || "Anonymous",
        isAnonymous: isAnonymousUser,
        ip: clientIp,
        transport: socket.conn.transport.name, // 'polling' or 'websocket'
        query: socket.handshake.query,
      });

      // Send welcome message with connection info
      socket.emit("connection_established", {
        socketId: socket.id,
        sessionId,
        serverTime: new Date().toISOString(),
        message: "Successfully connected to BidPazar WebSocket server",
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

        socket.leave(`chat:${streamId}`);
        logger.info(`[Socket.IO] Client left chat room: chat:${streamId}`, {
          socketId: socket.id,
          streamId,
        });
      });

      socket.on("sendChatMessage", (messageData) => {
        const { streamId, content } = messageData;
        if (!streamId || !content || !userId) return;

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

      // Handle producer (streamer) ready
      socket.on("broadcaster_ready", (data) => {
        if (!streamId) return;

        logger.info(`[WebRTC] Broadcaster ready for stream: ${streamId}`, {
          socketId: socket.id,
          sessionId,
        });

        // Store this socket as the broadcaster for this stream
        socket.data.isBroadcaster = true;
        socket.data.streamId = streamId;

        // Let all clients in this stream know the broadcaster is ready
        socket.to(`stream:${streamId}`).emit("broadcaster_ready", {
          broadcasterSocketId: socket.id,
          broadcasterSessionId: sessionId,
          streamId,
        });
      });

      // Handle consumer (viewer) ready
      socket.on("viewer_ready", (data) => {
        if (!streamId) return;

        logger.info(`[WebRTC] Viewer ready for stream: ${streamId}`, {
          socketId: socket.id,
          sessionId,
        });

        // Find broadcaster in this room
        const broadcasters = Array.from(io.sockets.sockets.values()).filter(
          (s) => s.data.isBroadcaster && s.data.streamId === streamId
        );

        if (broadcasters.length > 0) {
          const broadcaster = broadcasters[0];
          // Notify broadcaster that this viewer is ready
          broadcaster.emit("viewer_ready", {
            viewerSocketId: socket.id,
            viewerSessionId: sessionId,
            streamId,
          });
        } else {
          // No broadcaster found, notify viewer
          socket.emit("no_broadcaster", { streamId });
        }
      });

      // Handle client disconnect
      socket.on("disconnect", (reason) => {
        logger.info(`[Socket.IO] Client disconnected`, {
          socketId: socket.id,
          sessionId,
          streamId: streamId || "no-stream",
          userId: userId || "anonymous",
          reason,
        });

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
        logger.error(`[WebRTC] Client reported WebRTC error`, {
          socketId: socket.id,
          sessionId,
          streamId: streamId || "no-stream",
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
        logger.debug(`[Socket.IO] Debug message from client`, {
          socketId: socket.id,
          sessionId,
          ...data,
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

    return io;
  } catch (error) {
    logger.error("[Socket.IO] Error initializing Socket.IO server", { error });
    throw error;
  }
}

// MediaSoup worker setup
async function createMediasoupWorker(): Promise<MediasoupTypes.Worker> {
  const { worker: workerConfig } = mediasoupAppConfig;

  logger.info("[MediaSoup] Creating MediaSoup worker");
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
}
