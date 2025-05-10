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
};

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
      mediasoupWorker = await createMediasoupWorker();
      // @ts-ignore
      global.mediasoupWorker = mediasoupWorker;
      logger.info(
        "[MediaSoup] MediaSoup worker created successfully and is ready."
      );
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
      // Extract client information
      const {
        streamId,
        userId,
        username = "Anonymous",
        isAnonymous = false,
        isStreamer = false,
      } = socket.handshake.query as {
        streamId?: string;
        userId?: string;
        username?: string;
        isAnonymous?: string | boolean;
        isStreamer?: string | boolean;
      };

      const isAnonymousUser =
        isAnonymous === "true" || isAnonymous === "1" || isAnonymous === true;
      const isStreamerUser =
        isStreamer === "true" || isStreamer === "1" || isStreamer === true;
      const clientIp =
        socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;

      // Generate a unique session ID for this connection combining timestamp, socket ID, and random string
      const randomStr = Math.random().toString(36).substring(2, 15);
      const sessionId = `${Date.now()}-${randomStr}-${Math.floor(
        Math.random() * 2000000000
      )}`;

      // Store this flag for broadcaster/viewer differentiation
      socket.data.isBroadcaster = isStreamerUser;
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
        isAnonymous: isAnonymousUser,
        ip: clientIp,
        transport: socket.conn.transport.name,
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

      // Handle broadcaster (streamer) ready
      socket.on("broadcaster_ready", async (data) => {
        try {
          if (!streamId) {
            socket.emit("error", { message: "No streamId provided" });
            return;
          }

          logger.info(`[WebRTC] Broadcaster ready for stream: ${streamId}`, {
            socketId: socket.id,
            sessionId: data.sessionId || sessionId,
          });

          // Get the room
          const room = await getOrCreateRoom(streamId);

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
              true // Looking for streamers
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

          logger.info(`[WebRTC] Viewer ready for stream: ${streamId}`, {
            socketId: socket.id,
            sessionId: data.sessionId || sessionId,
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
      socket.on("disconnect", async (reason) => {
        logger.info(`[Socket.IO] Client disconnected`, {
          socketId: socket.id,
          sessionId,
          streamId: streamId || "no-stream",
          userId: userId || "anonymous",
          reason,
        });

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

      // Handle getRouterRtpCapabilities - CRITICAL for WebRTC setup
      socket.on("getRouterRtpCapabilities", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logger.info(
            `[WebRTC] Getting router capabilities for stream: ${streamId}`,
            {
              socketId: socket.id,
              sessionId: data.sessionId || sessionId,
            }
          );

          const room = await getOrCreateRoom(streamId);

          // Check for existing user connections - important for reconnection scenarios
          let duplicateConnection = false;
          let existingSocketId = null;

          if (userId) {
            const existingConnection = findExistingUserConnection(
              room,
              userId as string,
              isStreamerUser
            );

            if (
              existingConnection &&
              existingConnection.socketId !== socket.id
            ) {
              duplicateConnection = true;
              existingSocketId = existingConnection.socketId;
              logger.warn(
                `[WebRTC] Found existing ${
                  isStreamerUser ? "streamer" : "viewer"
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
              isStreamer: isStreamerUser,
            });

            // Create a new peer for this connection - THIS IS CRITICAL
            peer = {
              socketId: socket.id,
              userId: userId as string,
              username: username as string,
              sessionId: sessionId,
              isStreamer: isStreamerUser,
              transports: new Map(),
              producers: new Map(),
              consumers: new Map(),
              lastActivity: Date.now(),
              rtpCapabilities: data.rtpCapabilities, // Store client RTP capabilities if provided
            };

            // Add the peer to the room
            room.peers.set(socket.id, peer);
            room.activeSessions.set(sessionId, socket.id);

            logger.info(`[WebRTC] Added peer to room for: ${socket.id}`, {
              streamId,
              userId,
              isStreamer: isStreamerUser,
            });
          } else {
            // Update existing peer
            logger.info(`[WebRTC] Updating existing peer: ${socket.id}`, {
              streamId,
              userId,
              isStreamer: isStreamerUser,
            });

            // Update last activity timestamp and RTP capabilities
            peer.lastActivity = Date.now();
            if (data.rtpCapabilities) {
              peer.rtpCapabilities = data.rtpCapabilities;
            }
          }

          // Special handling for streamer connections to enforce one streamer per room
          if (isStreamerUser) {
            ensureOnlyOneStreamerInRoom(io, room, userId as string, socket.id);
          }

          // Log the current room state after updates
          logger.debug(`[WebRTC] Room state after capability request:`, {
            streamId,
            peersCount: room.peers.size,
            peerSocketIds: Array.from(room.peers.keys()),
            sessionCount: room.activeSessions.size,
          });

          // Return the router capabilities
          callback({
            rtpCapabilities: room.router.rtpCapabilities,
            duplicateConnection,
            existingSocketId,
          });
        } catch (err) {
          logger.error("[WebRTC] Error getting router capabilities", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
          });
          callback({ error: formatError(err) });
        }
      });

      // Handle createProducerTransport
      socket.on("createProducerTransport", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logger.info(
            `[WebRTC] Creating producer transport for stream: ${streamId}`,
            {
              socketId: socket.id,
            }
          );

          const room = await getOrCreateRoom(streamId);

          // Update peer activity timestamp
          const peer = room.peers.get(socket.id);
          if (peer) {
            peer.lastActivity = Date.now();
          } else {
            return callback({ error: "Peer not found" });
          }

          // Create a WebRTC transport
          const transport = await room.router.createWebRtcTransport({
            ...mediasoupAppConfig.webRtcTransport,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            enableSctp: true,
          });

          // Store the transport
          peer.transports.set(transport.id, transport);

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
          });

          // If this is a streamer, enforce only one streamer per room
          if (isStreamerUser) {
            ensureOnlyOneStreamerInRoom(io, room, userId as string, socket.id);
          }
        } catch (error) {
          logger.error(`[WebRTC] Error creating producer transport`, {
            error,
            streamId,
            socketId: socket.id,
          });
          callback({ error: "Error creating producer transport" });
        }
      });

      // Handle createConsumerTransport
      socket.on("createConsumerTransport", async (data, callback) => {
        try {
          if (!streamId) {
            return callback({ error: "No streamId provided" });
          }

          logger.info(
            `[WebRTC] Creating consumer transport for stream: ${streamId}`,
            {
              socketId: socket.id,
              sessionId: data.sessionId || sessionId,
            }
          );

          const room = await getOrCreateRoom(streamId);
          const peer = room.peers.get(socket.id);

          if (!peer) {
            throw new Error("Peer not found, please reconnect");
          }

          // Update peer activity timestamp
          peer.lastActivity = Date.now();

          // Create a new WebRTC transport on the server
          const transport = await room.router.createWebRtcTransport({
            listenIps: mediasoupAppConfig.webRtcTransport.listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate:
              mediasoupAppConfig.webRtcTransport
                .initialAvailableOutgoingBitrate,
          });

          // Store the transport
          peer.transports.set(transport.id, transport);

          // Return transport parameters to the client
          callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          });
        } catch (err) {
          logger.error("[WebRTC] Error creating consumer transport", {
            error: formatError(err),
            socketId: socket.id,
            streamId,
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

          logger.info(`[WebRTC] Connecting transport for stream: ${streamId}`, {
            transportId: data.transportId,
            socketId: socket.id,
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

          logger.info(
            `[WebRTC] Producing ${data.kind} media for stream: ${streamId}`,
            {
              transportId: data.transportId,
              socketId: socket.id,
            }
          );

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

          logger.info(`[WebRTC] Getting producers for stream: ${streamId}`, {
            socketId: socket.id,
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

          logger.info(`[WebRTC] Consume request for stream: ${streamId}`, {
            socketId: socket.id,
            producerId: data.producerId,
            transportId: data.transportId,
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

          logger.info(`[WebRTC] Resuming consumer: ${data.consumerId}`, {
            socketId: socket.id,
            streamId,
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

          logger.info(
            `[WebRTC] Saving RTP capabilities for ${socket.id} in stream ${streamId}`
          );

          const room = await getOrCreateRoom(streamId);
          let peer = room.peers.get(socket.id);

          if (!peer) {
            logger.warn(
              `[WebRTC] Peer not found for RTP capabilities, creating one: ${socket.id}`,
              {
                streamId,
                peers: Array.from(room.peers.keys()),
              }
            );

            // Create a new peer since it doesn't exist yet
            peer = {
              socketId: socket.id,
              userId: userId as string,
              username: username as string,
              sessionId: sessionId,
              isStreamer: isStreamerUser,
              transports: new Map(),
              producers: new Map(),
              consumers: new Map(),
              lastActivity: Date.now(),
              rtpCapabilities: data.rtpCapabilities,
            };

            // Add the peer to the room
            room.peers.set(socket.id, peer);
            room.activeSessions.set(sessionId, socket.id);

            logger.info(
              `[WebRTC] Added new peer for RTP capabilities: ${socket.id}`,
              {
                streamId,
                userId,
                isStreamer: isStreamerUser,
              }
            );
          } else {
            // Store the client's RTP capabilities
            peer.rtpCapabilities = data.rtpCapabilities;
            peer.lastActivity = Date.now();

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
