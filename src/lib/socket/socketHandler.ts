// src/lib/socket/socketHandler.ts
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';
import { types as MediasoupTypes } from 'mediasoup';
import { logger } from '@/lib/logger';

// Configuration
const mediasoupAppConfig = {
  router: {
    mediaCodecs: [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } },
      { kind: 'video', mimeType: 'video/H264', clockRate: 90000, parameters: { 'packetization-mode': 1, 'profile-level-id': '42e01f', 'level-asymmetry-allowed': 1 } },
    ] as MediasoupTypes.RtpCodecCapability[],
  },
  webRtcTransport: {
    listenIps: [{ ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
  },
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000', 10),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '40100', 10),
    logLevel: (process.env.MEDIASOUP_LOG_LEVEL || 'warn') as MediasoupTypes.WorkerLogLevel,
    logTags: (process.env.MEDIASOUP_LOG_TAGS?.split(',') || ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']) as MediasoupTypes.WorkerLogTag[],
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
      if (now - peer.lastActivity > 60 * 1000) { // 1 minute inactive
        logger.info(`[Socket.IO] Removing inactive peer ${socketId} from room ${streamId}`);
        
        // Close all transports, producers and consumers
        peer.transports.forEach(transport => {
          try {
            transport.close();
          } catch (err: any) {
            logger.error(`[Socket.IO] Error closing transport during cleanup: ${err.message}`);
          }
        });
        peer.producers.forEach(producer => {
          try {
            producer.close();
          } catch (err: any) {
            logger.error(`[Socket.IO] Error closing producer during cleanup: ${err.message}`);
          }
        });
        peer.consumers.forEach(consumer => {
          try {
            consumer.close();
          } catch (err: any) {
            logger.error(`[Socket.IO] Error closing consumer during cleanup: ${err.message}`);
          }
        });
        
        // Remove peer
        room.peers.delete(socketId);
      }
    });
    
    // Clean up active sessions that no longer have a corresponding peer
    room.activeSessions.forEach((socketId, sessionId) => {
      if (!room.peers.has(socketId)) {
        logger.info(`[Socket.IO] Removing stale session ${sessionId} from room ${streamId}`);
        room.activeSessions.delete(sessionId);
      }
    });
    
    // Remove empty rooms
    if (room.peers.size === 0) {
      logger.info(`[Socket.IO] Removing empty room ${streamId}`);
      // Close the router to clean up resources
      try {
        // Only close the router if it's still active
        if (room.router && typeof room.router.close === 'function') {
          room.router.close();
        }
      } catch (err: any) {
        logger.error(`[Socket.IO] Error closing router for room ${streamId}: ${err.message}`);
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
    logger.info('[MediaSoup] Using existing worker from global scope.');
    return mediasoupWorker;
  }
  
  if (mediasoupWorker && !mediasoupWorker.closed) {
    logger.info('[MediaSoup] Worker already running.');
    return mediasoupWorker;
  }
  try {
    logger.info('[MediaSoup] Creating Mediasoup worker...');
    mediasoupWorker = await mediasoup.createWorker(mediasoupAppConfig.worker);
    // Store in global scope for graceful shutdown
    // @ts-ignore
    global.mediasoupWorker = mediasoupWorker;
    
    mediasoupWorker.on('died', (error) => {
      logger.error('[MediaSoup] Worker died.', error);
      mediasoupWorker = null;
      // @ts-ignore
      global.mediasoupWorker = null;
      setTimeout(() => process.exit(1), 2000);
    });
    logger.info('[MediaSoup] Worker created successfully.');
    return mediasoupWorker;
  } catch (error) {
    logger.error('[MediaSoup] Failed to create Mediasoup worker:', error);
    throw error;
  }
}

async function getOrCreateRoom(streamId: string): Promise<Room> {
  let room = rooms.get(streamId);
  if (!room) {
    if (!mediasoupWorker || mediasoupWorker.closed) {
      await startMediasoupWorker();
      if (!mediasoupWorker) throw new Error("Mediasoup worker failed to initialize");
    }
    logger.info(`[MediaSoup] Creating new room for stream: ${streamId}`);
    const router = await mediasoupWorker.createRouter({ mediaCodecs: mediasoupAppConfig.router.mediaCodecs });
    room = { 
      router, 
      peers: new Map(),
      activeSessions: new Map()
    };
    rooms.set(streamId, room);
  }
  return room;
}

// Function to find existing connections from the same user in a room
function findExistingUserConnection(room: Room, userId: string, isStreamerQuery: boolean): Peer | null {
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
      stack: error.stack
    };
  }
  return { message: String(error) };
};

// Main exported function for server.js
export function initializeSocketIOServer(httpServer: ExtendedHttpServer): SocketIOServer {
  if (httpServer.io) {
    logger.info('[Socket.IO] Server already attached to HTTP server.');
    return httpServer.io;
  }

  logger.info('[Socket.IO] Creating and attaching new Socket.IO server...');
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: "*",
      methods: ['GET', 'POST'],
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 30000, // Increase ping timeout (from default 20000)
    pingInterval: 25000, // Increase ping interval (from default 10000)
    connectTimeout: 15000, // Connection timeout in ms
    maxHttpBufferSize: 1e6, // 1MB max per message
    allowEIO3: true, // Allow Engine.IO v3 clients for backward compatibility
    connectionStateRecovery: {
      // The backup duration in ms (default is 2 minutes)
      maxDisconnectionDuration: 2 * 60 * 1000,
      // Whether to skip middlewares upon successful recovery
      skipMiddlewares: true,
    },
  });

  startMediasoupWorker().catch(err => {
    logger.error("[Socket.IO] Critical error: Mediasoup worker could not be started during Socket.IO init.", err);
  });

  // Clear any dangling rooms on startup
  logger.info('[Socket.IO] Clearing previous room state on startup...');
  rooms.clear();

  io.on('connection', async (socket: Socket) => {
    const { streamId, userId, username, isStreamer: isStreamerStr, sessionId: clientQuerySessionId } = socket.handshake.query as {
      streamId: string; userId: string; username: string; isStreamer: string; sessionId?: string;
    };
    const currentIsStreamer = isStreamerStr === '1';
    // Ensure clientSessionId is a valid string or null, not undefined or empty.
    const clientSessionId = (typeof clientQuerySessionId === 'string' && clientQuerySessionId.length > 0) ? clientQuerySessionId : null;

    // Basic validation
    if (!streamId) {
      logger.warn(`[Socket.IO] Client ${socket.id} connection rejected: streamId missing.`);
      socket.disconnect(true);
      return;
    }
    if (!userId) {
      logger.warn(`[Socket.IO] Client ${socket.id} connection rejected: userId missing or invalid.`);
      socket.disconnect(true);
      return;
    }

    if (!mediasoupWorker || mediasoupWorker.closed) {
      logger.error(`[Socket.IO] Mediasoup worker not available for client ${socket.id}.`);
      socket.emit('serverError', 'Mediasoup service unavailable. Please try again later.');
      socket.disconnect(true);
      return;
    }

    logger.info(`[Socket.IO] Client connecting: ${socket.id}, stream: ${streamId}, user: ${userId}, streamer: ${currentIsStreamer}, clientSessionId: ${clientSessionId}`);

    let room: Room;
    try {
      room = await getOrCreateRoom(streamId);
    } catch (error) {
      logger.error(`[Socket.IO] Failed to get or create room for stream ${streamId}:`, error);
      socket.emit('serverError', 'Failed to initialize stream room.');
      socket.disconnect(true);
      return;
    }

    // --- Pre-emptive clientSessionId Takeover ---
    // If this clientSessionId is already mapped to an OLD socket, ensure the OLD socket is disconnected.
    if (clientSessionId) {
        const oldSocketIdMappedToThisClientSession = room.activeSessions.get(clientSessionId);
        if (oldSocketIdMappedToThisClientSession && oldSocketIdMappedToThisClientSession !== socket.id) {
            logger.warn(`[Socket.IO] ClientSessionId ${clientSessionId} (from new socket ${socket.id}) was already mapped to old socket ${oldSocketIdMappedToThisClientSession}. Disconnecting old socket.`);
            const oldSocketInstance = io.sockets.sockets.get(oldSocketIdMappedToThisClientSession);
            if (oldSocketInstance) {
                oldSocketInstance.emit('forceDisconnect', { message: 'Your session ID is being used by a new connection.' });
                oldSocketInstance.disconnect(true); // Its disconnect handler should clean its peer and activeSession entry.
            } else {
                // Old socket not found in current server instance, but mapping exists. Clean the stale mapping.
                logger.warn(`[Socket.IO] Stale mapping for ClientSessionId ${clientSessionId} to non-existent socket ${oldSocketIdMappedToThisClientSession}. Removing mapping.`);
                room.activeSessions.delete(clientSessionId);
            }
        }
    }

    // --- Duplicate Connection Checks ---
    let isDuplicateConnection = false;
    let duplicateDiagnosticReason = "";

    // A. Check for duplicate based on (userId, isStreamer) status, excluding current socket.
    //    This implies another distinct session for the same user role.
    const existingPeerWithSameUserAndRole = findExistingUserConnection(room, userId, currentIsStreamer);
    
    if (existingPeerWithSameUserAndRole && existingPeerWithSameUserAndRole.socketId !== socket.id) {
        if (currentIsStreamer) {
            // New connection is a streamer, and another streamer with same userId already exists.
            logger.warn(`[Socket.IO] New streamer (user ${userId}, socket ${socket.id}) conflicts with existing streamer (socket ${existingPeerWithSameUserAndRole.socketId}). Disconnecting OLD streamer.`);
            const oldStreamerSocketInstance = io.sockets.sockets.get(existingPeerWithSameUserAndRole.socketId);
            if (oldStreamerSocketInstance) {
                oldStreamerSocketInstance.emit('forceDisconnect', { message: 'Replaced by a new streaming session for your user.' });
                oldStreamerSocketInstance.disconnect(true); // Old streamer's disconnect handler will clean up.
            }
            // Allow the new streamer to proceed. The old one is being kicked.
        } else {
            // New connection is a viewer, and another viewer with same userId already exists.
            // Policy: If a viewer with this userId already exists, the new connection is a duplicate.
            // This mainly applies to logged-in users. Anonymous users (userId starts with 'anon-') should have unique userIds.
            if (!userId.startsWith('anon-')) {
                 isDuplicateConnection = true;
                 duplicateDiagnosticReason = `User ${userId} already has an active viewer session (socket ${existingPeerWithSameUserAndRole.socketId}).`;
            }
        }
    }

    // B. Secondary check: If the clientSessionId (if provided) is ALREADY active AND mapped to a DIFFERENT socket.
    // This can happen if the pre-emptive takeover didn't fully complete or if there's a race condition.
    if (!isDuplicateConnection && clientSessionId) {
        const socketIdCurrentlyMappedToClientSession = room.activeSessions.get(clientSessionId);
        if (socketIdCurrentlyMappedToClientSession && socketIdCurrentlyMappedToClientSession !== socket.id) {
            isDuplicateConnection = true;
            duplicateDiagnosticReason = (duplicateDiagnosticReason ? duplicateDiagnosticReason + " Also, " : "") +
                                      `client session ID ${clientSessionId} is currently mapped to a different active socket ${socketIdCurrentlyMappedToClientSession}.`;
        }
    }

    if (isDuplicateConnection) {
        logger.warn(`[Socket.IO] Duplicate connection detected for user ${userId}, socket ${socket.id}, clientSessionId ${clientSessionId}. Reason: ${duplicateDiagnosticReason}`);
        socket.emit('duplicateConnection', {
            message: duplicateDiagnosticReason || 'A conflicting active session was detected. Please close other instances or reload.'
        });
        // Client-side 'duplicateConnection' handler in WebRTCStreamManager should call socket.disconnect().
        return; // Prevent this socket from fully joining.
    }

    // --- If not a duplicate, proceed with setting up the peer ---
    const peerData: Peer = {
        socketId: socket.id,
        userId,
        username,
        sessionId: clientSessionId || `server-${socket.id}-${Date.now()}`, // Use clientSessionId if available, else server-fallback
        isStreamer: currentIsStreamer,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        lastActivity: Date.now()
    };
    room.peers.set(socket.id, peerData);

    // Update activeSessions mapping: current clientSessionId (if any) maps to current socket.id.
    // Ensure any old mappings for this socket.id to a *different* clientSessionId are cleared.
    if (clientSessionId) {
        for (const [csId, sockId] of room.activeSessions.entries()) {
            if (sockId === socket.id && csId !== clientSessionId) {
                logger.info(`[Socket.IO] Socket ${socket.id} was previously mapped to clientSessionId ${csId}. Removing old mapping as it now uses ${clientSessionId}.`);
                room.activeSessions.delete(csId);
            }
        }
        room.activeSessions.set(clientSessionId, socket.id);
    } else {
        // If client has no session ID, ensure this socket.id isn't mapped from any old clientSessionId.
         for (const [csId, sockId] of room.activeSessions.entries()) {
            if (sockId === socket.id) {
                logger.info(`[Socket.IO] Socket ${socket.id} (no client session ID) was previously mapped to clientSessionId ${csId}. Removing old mapping.`);
                room.activeSessions.delete(csId);
            }
        }
    }
    
    socket.join(streamId);
    
    const userCount = room.peers.size;
    const streamerCount = Array.from(room.peers.values()).filter(p => p.isStreamer).length;
    
    io.to(streamId).emit('participantCount', { 
      total: userCount, 
      streamers: streamerCount 
    });

    const activityInterval = setInterval(() => {
      const userPeer = room.peers.get(socket.id);
      if (userPeer) {
        userPeer.lastActivity = Date.now();
      }
    }, 60 * 1000);

    socket.on('getRouterRtpCapabilities', (data, callback) => {
      const userPeer = room.peers.get(socket.id);
      if (userPeer) {
        userPeer.lastActivity = Date.now();
      }
      
      // Check for duplicate streamers
      if (currentIsStreamer) {
        const duplicatePeer = Array.from(room.peers.values())
          .find(p => p.userId === userId && p.isStreamer && p.socketId !== socket.id);
          
        if (duplicatePeer) {
          logger.warn(`[Socket.IO] Duplicate streamer detected during RTP capabilities request`, {
            existingSocketId: duplicatePeer.socketId, 
            newSocketId: socket.id
          });
          return callback({ 
            duplicateConnection: true, 
            existingSocketId: duplicatePeer.socketId
          });
        }
      }
      
      if (room && room.router) {
        callback({ rtpCapabilities: room.router.rtpCapabilities });
      } else {
        callback({ error: `Router for room ${streamId} not found` });
      }
    });

    const handleCreateTransport = async (callback: (params: any) => void) => {
        const userPeer = room.peers.get(socket.id);
        if (userPeer) {
          userPeer.lastActivity = Date.now();
        }
        
        try {
            const transport = await room.router.createWebRtcTransport(mediasoupAppConfig.webRtcTransport);
            if (userPeer) {
              userPeer.transports.set(transport.id, transport);
            }
            
            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') transport.close();
            });
            
            logger.info(`Created WebRTC transport ${transport.id} for peer ${socket.id}`);
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
                sctpParameters: transport.sctpParameters,
            });
        } catch (error) {
            callback({ error: (error as Error).message });
        }
    };

    socket.on('createProducerTransport', async (data, callback) => {
      logger.debug(`Received createProducerTransport from ${socket.id}`);
      await handleCreateTransport(callback);
    });

    socket.on('createConsumerTransport', async (data, callback) => {
      logger.debug(`Received createConsumerTransport from ${socket.id}`);
      await handleCreateTransport(callback);
    });

    const handleConnectTransport = async (transportId: string, dtlsParameters: any, callback: (params: any) => void) => {
        const transport = peerData.transports.get(transportId);
        if (!transport) {
            logger.error(`[MediaSoup] Connect transport failed: Transport ${transportId} not found for peer ${socket.id} in stream ${streamId}`);
            return callback({ error: `Transport ${transportId} not found` });
        }
        try {
            await transport.connect({ dtlsParameters });
            logger.info(`[MediaSoup] Connected transport ${transportId} for peer ${socket.id} in stream ${streamId}`);
            callback({ connected: true });
        } catch (error) {
            logger.error(`[MediaSoup] Connect transport failed for ${transportId}:`, formatError ? formatError(error) : error);
            callback({ error: (error as Error).message });
        }
    };

    socket.on('connectProducerTransport', async ({ transportId, dtlsParameters }, callback) => {
      logger.debug(`Received connectProducerTransport for ${transportId} from ${socket.id}`);
      await handleConnectTransport(transportId, dtlsParameters, callback);
    });

    socket.on('connectConsumerTransport', async ({ transportId, dtlsParameters }, callback) => {
      logger.debug(`Received connectConsumerTransport for ${transportId} from ${socket.id}`);
      await handleConnectTransport(transportId, dtlsParameters, callback);
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
      const transport = peerData.transports.get(transportId);
      if (!transport) {
        logger.error(`[MediaSoup] Produce failed: Transport ${transportId} not found for peer ${socket.id}`);
        return callback({ error: `Transport ${transportId} not found` });
      }
      
      try {
        const producer = await transport.produce({ 
          kind, 
          rtpParameters, 
          appData: { ...appData, peerId: socket.id, userId, username } 
        });
        
        peerData.producers.set(producer.id, producer);
        logger.info(`[MediaSoup] Producer created successfully`, {
          producerId: producer.id,
          peerId: socket.id,
          kind,
          userId, 
          username
        });
        
        logger.info(`Notifying room ${streamId} of new producer`, { producerId: producer.id, kind });
        socket.to(streamId).emit('newProducer', { 
          producerId: producer.id, 
          peerId: socket.id, 
          kind, 
          userId, 
          username 
        });
        
        callback({ id: producer.id });
      } catch (error) {
        logger.error(`[MediaSoup] Failed to produce media for peer ${socket.id}`, {
          error: formatError(error),
          kind,
          transportId
        });
        callback({ error: (error as Error).message });
      }
    });

    socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
        const transport = peerData.transports.get(transportId);
        if (!transport) {
            logger.error(`[MediaSoup] Consume failed: Transport ${transportId} not found for peer ${socket.id} in stream ${streamId}`);
            return callback({ error: `Transport ${transportId} not found` });
        }

        // Check if rtpCapabilities are valid
        if (!rtpCapabilities || !room.router.canConsume({
            producerId,
            rtpCapabilities,
        })) {
            logger.error(`[MediaSoup] Consume failed: Cannot consume producer ${producerId} with provided RTP capabilities`, {
                peerId: socket.id,
                userId,
                rtpCapabilities
            });
            return callback({ error: 'Cannot consume with provided RTP capabilities' });
        }

        try {
            // Find the producer - it might be from any peer in the room
            let producer = null;
            
            // Look for the producer in all peers
            for (const [peerId, roomPeer] of room.peers.entries()) {
                const foundProducer = roomPeer.producers.get(producerId);
                if (foundProducer) {
                    producer = foundProducer;
                    break;
                }
            }
            
            if (!producer) {
                logger.error(`[MediaSoup] Consume failed: Producer ${producerId} not found in room ${streamId}`, {
                    requestingPeerId: socket.id,
                    userId
                });
                return callback({ error: `Producer ${producerId} not found` });
            }
            
            logger.info(`[MediaSoup] Creating consumer for peer ${socket.id}`, {
                transportId,
                producerId,
                userId
            });
            
            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: true, // Start paused, will resume after client is ready
            });
            
            peerData.consumers.set(consumer.id, consumer);
            
            // Handle consumer close
            consumer.on('producerclose', () => {
                logger.info(`[MediaSoup] Producer closed for consumer ${consumer.id}, removing consumer`, {
                    consumerId: consumer.id,
                    peerId: socket.id
                });
                consumer.close();
                peerData.consumers.delete(consumer.id);
                
                // Notify peer that the consumer has been closed
                socket.emit('consumerClosed', { consumerId: consumer.id });
            });
            
            // Return the consumer parameters
            const consumerParams = {
                consumerId: consumer.id,
                producerId: producer.id,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused
            };
            
            logger.info(`[MediaSoup] Consumer created successfully`, {
                consumerId: consumer.id,
                peerId: socket.id,
                kind: consumer.kind,
                userId
            });
            
            // Send created consumer data to client
            callback(consumerParams);
            
            // Resume the consumer after a short delay to ensure the client has time to set up
            setTimeout(async () => {
                try {
                    await consumer.resume();
                    logger.info(`[MediaSoup] Consumer ${consumer.id} resumed`, { peerId: socket.id });
                } catch (error) {
                    logger.error(`[MediaSoup] Failed to resume consumer ${consumer.id}`, {
                        error: formatError(error),
                        peerId: socket.id
                    });
                }
            }, 1000);
        } catch (error) {
            logger.error(`[MediaSoup] Failed to create consumer for peer ${socket.id}`, {
                error: formatError(error),
                transportId,
                producerId
            });
            callback({ error: (error as Error).message });
        }
    });

    // Handle getProducers request
    socket.on('getProducers', async ({ streamId }, callback) => {
        try {
            const producers: Array<{ producerId: string; kind: string; peerId: string }> = [];
            
            // Get all active producers in the room
            room.peers.forEach((peer) => {
                if (peer.socketId !== socket.id) { // Don't include our own producers
                    peer.producers.forEach((producer) => {
                        producers.push({
                            producerId: producer.id,
                            kind: producer.kind,
                            peerId: peer.socketId
                        });
                    });
                }
            });
            
            logger.info(`[Socket.IO] Returning ${producers.length} producers for stream ${streamId}`, {
                requestPeerId: socket.id
            });
            
            callback(producers);
        } catch (error) {
            logger.error(`[Socket.IO] Error getting producers`, {
                error: formatError(error),
                streamId,
                peerId: socket.id
            });
            callback([]);
        }
    });
    
    socket.on('resumeConsumer', async ({ consumerId }, callback) => {
        const consumer = peerData.consumers.get(consumerId);
        if (consumer) {
            await consumer.resume();
            callback({ resumed: true });
        } else {
            callback({ error: 'Consumer not found' });
        }
    });

    socket.on('joinChatRoom', (data: { streamId: string }) => {
        logger.info(`[Socket.IO] Client ${socket.id} confirmed join to chat room: ${data.streamId}`);
    });

    socket.on('sendChatMessage', (message: { streamId: string; userId: string; username: string; content: string; timestamp?: string; }, ackCallback) => {
      logger.info(`[Socket.IO] Chat message from ${socket.id} in room ${message.streamId}: ${message.content}`);
      io.to(message.streamId).emit('newChatMessage', message);
      if (ackCallback) ackCallback({ success: true, messageId: 'temp-id-' + Date.now() });
    });

    socket.on('leaveChatRoom', (data: { streamId: string }) => {
        logger.info(`[Socket.IO] Client ${socket.id} left chat room: ${data.streamId}`);
        socket.leave(data.streamId);
    });
    
    socket.on('disconnect', (reason) => {
      clearInterval(activityInterval);
      
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
      
      const peer = room.peers.get(socket.id);
      if (peer) {
        peer.transports.forEach(transport => transport.close());
        peer.producers.forEach(producer => producer.close());
        peer.consumers.forEach(consumer => consumer.close());
        
        if (peer.isStreamer) {
          socket.to(streamId).emit('streamerDisconnected', { 
            peerId: socket.id, 
            userId: peer.userId,
            streamId
          });
        }
        
        if (peer.sessionId && room.activeSessions.get(peer.sessionId) === socket.id) {
          room.activeSessions.delete(peer.sessionId);
        }
        
        room.peers.delete(socket.id);
      }
      
      const userCount = room.peers.size;
      const streamerCount = Array.from(room.peers.values()).filter(p => p.isStreamer).length;
      
      io.to(streamId).emit('participantCount', { 
        total: userCount, 
        streamers: streamerCount 
      });
      
      socket.to(streamId).emit('peerClosed', { peerId: socket.id });
      
      if (room.peers.size === 0) {
        logger.info(`[Socket.IO] Room ${streamId} is now empty after disconnect of ${socket.id}`);
      }
    });
  });

  io.engine.on('connection_error', (err) => {
    logger.error(`[Socket.IO] Connection error:`, formatError(err));
  });

  httpServer.io = io;
  logger.info('[Socket.IO] Server setup complete and event handlers registered.');
  return io;
} 