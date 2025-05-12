// src/lib/socket/socketHandler.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import * as mediasoup from "mediasoup";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";
import { 
  emitStreamStateChange, 
  updateDatabaseStreamState, 
  validateStreamState, 
  StreamState 
} from './socketEvents';

// Import modularized components
import { initializeMediasoupWorker } from './worker';
import { 
  getOrCreateRoom, 
  cleanupRoom, 
  ensureOnlyOneStreamerInRoom,
  findExistingUserConnection,
  removeExistingPeer
} from './rooms';
import { 
  getAppropriateIceConfiguration, 
  isLoopbackAddress 
} from './network';
import { formatError, formatConnectionInfo } from './utils';
import { 
  handleBroadcasterDisconnection,
  handleStreamStateChange 
} from './streamHandlers';
import { 
  registerBroadcasterEvents,
  registerViewerEvents,
  registerChatEvents,
  registerWebRTCEvents,
  registerStreamStateEvents,
  registerWebRTCSignalingEvents,
  startHeartbeatMonitoring
} from './events';
import { 
  Room,
  Peer,
  ExtendedHttpServer,
  RoomCreationContext,
  SocketHandlerContext,
  DEFAULT_SOCKET_TIMEOUT,
  HEARTBEAT_INTERVAL, 
  HEARTBEAT_TIMEOUT 
} from './types';
import { registerAllWebRTCEvents } from './webrtcEvents';

// Import mediasoup types
import * as mediasoupTypes from 'mediasoup/node/lib/types';

// Global state (will be moved to context in a full refactor)
export let mediasoupWorker: MediasoupTypes.Worker | null = null;
// Store mediasoup worker in global scope for graceful shutdown
// @ts-ignore
global.mediasoupWorker = null;

// Track active sockets to prevent duplicate upgrade attempts
const activeSocketConnections = new Set<string>();

// Track connections by user to prevent duplicates
const userConnectionTracker = new Map<string, Set<string>>();

/**
 * Check if a connection should be allowed or is a duplicate
 */
function shouldAllowConnection(socket: Socket): boolean {
  const query = socket.handshake.query;
  const { streamId, userId, connectionId, isStreamer, isStreamerSelfView, loopbackAware } = query;
  
  if (!streamId || !userId) {
    return true; // Allow if we can't properly track
  }
  
  const connectionKey = `${streamId}:${userId}`;
  
  // Special case: when a streamer connects to their own stream
  // Check if this stream ID contains the user ID (streamers often have their user ID in the stream ID)
  const isStreamerViewingOwnStream = 
    isStreamer === '1' && 
    typeof streamId === 'string' && 
    typeof userId === 'string' && 
    streamId.includes(userId.substring(0, 8));
  
  // If client indicates it's a streamer self-view and is loopback aware, we can allow it
  const isLoopbackAwareStreamerSelfView = 
    isStreamerSelfView === '1' && 
    loopbackAware === '1' && 
    isStreamerViewingOwnStream;
  
  // Get existing sockets for this user+stream combo
  let userSockets = userConnectionTracker.get(connectionKey);
  if (!userSockets) {
    userSockets = new Set<string>();
    userConnectionTracker.set(connectionKey, userSockets);
  }
  
  // If this is a streamer viewing their own stream, we can be more lenient
  if (isStreamerViewingOwnStream && userSockets.size > 0) {
    logger.info(`Streamer ${userId} connecting to their own stream ${streamId}`, {
      existingConnections: userSockets.size,
      socketId: socket.id,
      connectionId,
      isLoopbackAware: loopbackAware === '1',
      isStreamerSelfView: isStreamerSelfView === '1'
    });
    
    // Allow loopback-aware streamer self-view connections
    if (isLoopbackAwareStreamerSelfView) {
      logger.info(`Allowing loopback-aware streamer self-view connection: ${connectionId}`);
      
      // For loopback-aware connections, always track them
      if (connectionId && typeof connectionId === 'string') {
        userSockets.add(connectionId.toString());
      }
      
      return true;
    }
    
    // For other cases, allow only if it has a specific connectionId that we can track
    if (connectionId && typeof connectionId === 'string') {
      // Check if this specific connection ID is already registered
      if (userSockets.has(connectionId.toString())) {
        // This is a reconnection of the same client, allow it
        logger.info(`Allowing reconnection of existing streamer self-view: ${connectionId}`);
        return true;
      } else if (userSockets.size < 3) {
        // Allow up to 3 connections for a streamer to their own stream (for redundancy)
        logger.info(`Allowing additional streamer self-view connection (${userSockets.size + 1}/3)`);
        userSockets.add(connectionId.toString());
        return true;
      }
      
      logger.warn(`Rejecting additional streamer self-view connection (limit reached): ${connectionId}`);
      return false; // Reject additional connections
    }
  }
  
  // Track this connection
  if (connectionId && typeof connectionId === 'string') {
    userSockets.add(connectionId.toString());
  }
  
  return true;
}

/**
 * Main Socket.IO server initialization
 */
export async function initializeSocketIOServer(httpServer: HttpServer, existingIo?: SocketIOServer): Promise<SocketIOServer> {
  // Use existing io instance if provided
  let io: SocketIOServer;
  
  if (existingIo) {
    logger.info('[Socket.IO] Using existing Socket.IO server instance');
    io = existingIo;
  } else {
    // Create new Socket.IO server with enhanced configuration
    logger.info('[Socket.IO] Creating new Socket.IO server instance');
    io = new SocketIOServer(httpServer, {
      path: '/socket.io',
      serveClient: false, // Don't serve client files
      cors: {
        origin: '*', // Adjust according to your CORS needs
        methods: ['GET', 'POST'],
        credentials: true
      },
      // Improved connection handling config
      connectTimeout: 45000,
      pingTimeout: 30000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
      allowUpgrades: true,
      maxHttpBufferSize: 1e8, // 100MB
      perMessageDeflate: {
        threshold: 2048 // Only compress messages larger than 2KB
      }
    });
  }

  // Configure CORS
  logger.info('[Socket.IO] Server initialized with CORS origin: *');
  
  // Check for existing worker or create a new one
  // @ts-ignore
  const mediasoupWorker = global.mediasoupWorker;
  if (mediasoupWorker) {
    logger.info('[MediaSoup] Using existing worker from global scope.');
  } else {
    // Create a new worker
    try {
      // @ts-ignore
      global.mediasoupWorker = await createMediasoupWorker();
      logger.info('[MediaSoup] Worker created successfully.');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[MediaSoup] Failed to create worker: ${errorMsg}`);
      throw error;
    }
  }
  
  // Create the main router, which handles WebRTC routing
  try {
    // @ts-ignore
    const worker = global.mediasoupWorker as mediasoupTypes.Worker;
    const router = await createMediasoupRouter(worker);
    logger.info('[MediaSoup] Router created successfully, WebRTC ready');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[MediaSoup] Failed to create router: ${errorMsg}`);
    throw error;
  }
  
  // Add connection filter middleware
  io.use((socket, next) => {
    try {
      const query = socket.handshake.query;
      const { connectionId, streamId, userId } = query;
      
      // Add basic validation
      if (connectionId && typeof connectionId === 'string') {
        // Check if this specific connection should be allowed
        if (!shouldAllowConnection(socket)) {
          logger.warn(`[Socket.IO] Rejecting duplicate connection: ${socket.id}`, {
            connectionId,
            streamId,
            userId
          });
          return next(new Error('Duplicate connection detected'));
        }
        
        // Add tracking for this socket
        activeSocketConnections.add(connectionId);
        
        // Add disconnect handler to clean up tracking
        socket.on('disconnect', (reason) => {
          const connectionKey = `${streamId}:${userId}`;
          if (connectionId && typeof connectionId === 'string') {
            // Remove from active connections set
            activeSocketConnections.delete(connectionId);
            
            // Remove from user connection tracker
            const userSockets = userConnectionTracker.get(connectionKey);
            if (userSockets) {
              userSockets.delete(connectionId);
              if (userSockets.size === 0) {
                userConnectionTracker.delete(connectionKey);
              }
            }
            
            logger.info(`[Socket.IO] Connection ${connectionId} removed from tracking on disconnect: ${reason}`);
          }
        });
      }
      
      // Check for potential loopback connections
      const clientIP = socket.handshake.headers["x-forwarded-for"] || 
                      socket.request.connection.remoteAddress;
      const host = socket.handshake.headers.host;
      const isStreamerSelfView = socket.handshake.query.isStreamerSelfView === '1';
      const isLoopbackAware = socket.handshake.query.loopbackAware === '1';
                      
      if (clientIP === '::1' || clientIP === '127.0.0.1' || 
          clientIP === 'localhost' || clientIP === '::ffff:127.0.0.1') {
        logger.info('Socket.IO loopback connection detected', {
          clientIP,
          host,
          id: socket.id,
          transportName: socket.conn.transport.name,
          isStreamerSelfView,
          isLoopbackAware
        });
        
        // Emit a loopback event for the client to handle
        socket.emit('loopback_detected', { 
          isLoopback: true,
          isStreamerSelfView,
          allowConnection: isStreamerSelfView || isLoopbackAware
        });
        
        // Log these connections but don't block them if they're loopback-aware
        logger.info(`[Socket.IO] Detected loopback connection: ${socket.id}`, {
          ip: clientIP,
          userId: socket.handshake.query.userId || 'unknown',
          isStreamerSelfView,
          isLoopbackAware
        });
      }
      
      // Log connection
      logger.info(`Socket.IO connection from ${clientIP}`, {
        socketId: socket.id,
        transport: socket.conn.transport.name,
        host: socket.handshake.headers.host,
        userAgent: socket.handshake.headers['user-agent'],
        query: socket.handshake.query
      });
      
      next();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Socket.IO] Middleware error: ${errorMsg}`);
      next();
    }
  });
  
  // Set up event handlers for Socket.IO connections
  setupSocketIOEventHandlers(io);
  
  return io;
}

/**
 * Configure Socket.IO event handlers
 */
function setupSocketIOEventHandlers(io: SocketIOServer) {
  // Import modularized event handlers
  const { handleStreamEvents } = require('./streamHandlers');
  const { handleRoomEvents } = require('./socketEvents');
  const { handleWebRTCEvents } = require('./webrtcEvents');
  
  // Set up connection handler
  io.on('connection', (socket: Socket) => {
    const query = socket.handshake.query;
    const connectionId = query.connectionId as string;
    const streamId = query.streamId as string;
    const userId = query.userId as string;
    const username = query.username as string;
    const isStreamer = query.isStreamer === '1';
    const isStreamerSelfView = query.isStreamerSelfView === '1';
    
    // Debug log connection with more detailed info
    const clientIP = socket.handshake.headers["x-forwarded-for"] || 
                    socket.request.connection.remoteAddress;
    
    logger.info(`Socket.IO connection from ${clientIP}`, {
      socketId: socket.id,
      transport: socket.conn.transport.name,
      host: socket.handshake.headers.host,
      userAgent: socket.handshake.headers['user-agent'],
      query: socket.handshake.query
    });
    
    // Set up disconnect handler with reason
    socket.on('disconnect', (reason) => {
      logger.info(`Socket ${socket.id} disconnected: ${reason}`, {
        connectionId,
        streamId,
        userId
      });
    });
    
    // Set up all the modularized event handlers
    handleStreamEvents(io, socket);
    handleRoomEvents(io, socket);
    handleWebRTCEvents(io, socket);
    
    // Handle socket connection for specific streaming cases
    if (isStreamerSelfView) {
      logger.info(`Streamer self-view connection established: ${socket.id}`, {
        streamId,
        userId
      });
      
      // Insert special handling for streamer self-view connections
      socket.on('getRouterRtpCapabilities', (data, callback) => {
        // For streamers viewing their own stream, we can skip some checks
        try {
          // @ts-ignore Access global router
          const router = global.mediasoupRouter;
          if (router) {
            callback({ rtpCapabilities: router.rtpCapabilities, error: null });
          } else {
            callback({ error: 'Router not available' });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`Error getting router capabilities: ${errorMsg}`);
          callback({ error: 'Error getting router capabilities' });
        }
      });
    }
  });
}

// Create a MediaSoup worker
async function createMediasoupWorker(): Promise<mediasoupTypes.Worker> {
  const { createWorker } = await import('mediasoup');
  
  // Get configuration from environment or use defaults
  const announcedIP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
  const listenIP = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0';
  const minPort = parseInt(process.env.MEDIASOUP_MIN_PORT || '40000');
  const maxPort = parseInt(process.env.MEDIASOUP_MAX_PORT || '40100');
  const logLevel = process.env.MEDIASOUP_LOG_LEVEL || 'debug';
  
  // Log configuration
  logger.info(`[MediaSoup] Creating worker with configuration:`);
  logger.info(`[MediaSoup] - Announced IP: ${announcedIP}`);
  logger.info(`[MediaSoup] - Listen IP: ${listenIP}`);
  logger.info(`[MediaSoup] - Port range: ${minPort}-${maxPort}`);
  logger.info(`[MediaSoup] - Log level: ${logLevel}`);
  
  // Create the worker
  const worker = await createWorker({
    logLevel: logLevel as mediasoupTypes.WorkerLogLevel,
    rtcMinPort: minPort,
    rtcMaxPort: maxPort,
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  });
  
  logger.info(`[MediaSoup] Worker created successfully (pid: ${worker.pid})`);
  
  return worker;
}

// Create a MediaSoup router
async function createMediasoupRouter(worker: mediasoupTypes.Worker): Promise<mediasoupTypes.Router> {
  // Get configuration from environment or use defaults
  const announcedIP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
  
  // Create a router with OPUS and VP8 codecs
  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1
        }
      }
    ]
  });
  
  return router;
}
