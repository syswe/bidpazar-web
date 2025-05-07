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
let mediasoupWorker: MediasoupTypes.Worker | null = null;

interface Peer {
  socketId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
  transports: Map<string, MediasoupTypes.WebRtcTransport>;
  producers: Map<string, MediasoupTypes.Producer>;
  consumers: Map<string, MediasoupTypes.Consumer>;
}
interface Room {
  router: MediasoupTypes.Router;
  peers: Map<string, Peer>;
}
const rooms = new Map<string, Room>();

// Helper functions (moved from route.ts)
async function startMediasoupWorker() {
  if (mediasoupWorker && !mediasoupWorker.closed) {
    logger.info('[MediaSoup] Worker already running.');
    return mediasoupWorker;
  }
  try {
    logger.info('[MediaSoup] Creating Mediasoup worker...');
    mediasoupWorker = await mediasoup.createWorker(mediasoupAppConfig.worker);
    mediasoupWorker.on('died', (error) => {
      logger.error('[MediaSoup] Worker died.', error);
      mediasoupWorker = null;
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
    room = { router, peers: new Map() };
    rooms.set(streamId, room);
  }
  return room;
}

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
    transports: ['websocket'],
  });

  startMediasoupWorker().catch(err => {
    logger.error("[Socket.IO] Critical error: Mediasoup worker could not be started during Socket.IO init.", err);
  });

  io.on('connection', async (socket: Socket) => {
    const { streamId, userId, username, isStreamer: isStreamerStr } = socket.handshake.query as {
      streamId: string; userId: string; username: string; isStreamer: string;
    };
    const isStreamer = isStreamerStr === '1';

    logger.info(`[Socket.IO] Client connected: ${socket.id}, stream: ${streamId}, user: ${userId}, streamer: ${isStreamer}`);

    if (!streamId) {
      logger.warn(`[Socket.IO] Client ${socket.id} connection rejected: streamId missing.`);
      socket.disconnect(true);
      return;
    }
    if (!mediasoupWorker || mediasoupWorker.closed) {
        logger.error(`[Socket.IO] Mediasoup worker not available for client ${socket.id}.`);
        socket.emit('serverError', 'Mediasoup service unavailable. Please try again later.');
        socket.disconnect(true);
        return;
    }

    let room: Room;
    try {
        room = await getOrCreateRoom(streamId);
    } catch (error) {
        logger.error(`[Socket.IO] Failed to get or create room for stream ${streamId}:`, error);
        socket.emit('serverError', 'Failed to initialize stream room.');
        socket.disconnect(true);
        return;
    }
    
    const peer: Peer = {
      socketId: socket.id, userId, username, isStreamer,
      transports: new Map(), producers: new Map(), consumers: new Map()
    };
    room.peers.set(socket.id, peer);
    socket.join(streamId);

    // Mediasoup Event Handlers
    socket.on('getRouterRtpCapabilities', (data, callback) => {
      if (room && room.router) {
        callback({ rtpCapabilities: room.router.rtpCapabilities });
      } else {
        callback({ error: `Router for room ${streamId} not found` });
      }
    });

    socket.on('createWebRtcTransport', async ({ producing, consuming }, callback) => {
        try {
            const transport = await room.router.createWebRtcTransport(mediasoupAppConfig.webRtcTransport);
            peer.transports.set(transport.id, transport);
            transport.on('dtlsstatechange', (dtlsState) => {
                if (dtlsState === 'closed') transport.close();
            });
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
    });

    socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
        const transport = peer.transports.get(transportId);
        if (!transport) return callback({ error: `Transport ${transportId} not found` });
        try {
            await transport.connect({ dtlsParameters });
            callback({ connected: true });
        } catch (error) {
            callback({ error: (error as Error).message });
        }
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
      const transport = peer.transports.get(transportId);
      if (!transport) return callback({ error: `Transport ${transportId} not found` });
      try {
        const producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, peerId: socket.id, userId, username } });
        peer.producers.set(producer.id, producer);
        socket.to(streamId).emit('newProducer', { producerId: producer.id, peerId: socket.id, kind, userId, username });
        callback({ id: producer.id });
      } catch (error) {
        callback({ error: (error as Error).message });
      }
    });

    socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
        const transport = peer.transports.get(transportId);
         if (!transport) return callback({ error: `Transport ${transportId} not found` });
        
        let originalProducer: MediasoupTypes.Producer | undefined;
        room.peers.forEach(p => {
            if (p.producers.has(producerId)) originalProducer = p.producers.get(producerId);
        });

        if (!originalProducer || !room.router.canConsume({ producerId, rtpCapabilities })) {
            return callback({ error: `Cannot consume producer ${producerId}` });
        }

        try {
            const consumer = await transport.consume({
                producerId, rtpCapabilities, paused: originalProducer.kind === 'video',
            });
            peer.consumers.set(consumer.id, consumer);
            if (consumer.kind === 'video') await consumer.resume();
            callback({
                id: consumer.id, producerId: consumer.producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters,
            });
        } catch (error) {
            callback({ error: (error as Error).message });
        }
    });
    
    socket.on('resumeConsumer', async ({ consumerId }, callback) => {
        const consumer = peer.consumers.get(consumerId);
        if (consumer) {
            await consumer.resume();
            callback({ resumed: true });
        } else {
            callback({ error: 'Consumer not found' });
        }
    });

    // Chat Event Handlers
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
    
    // Disconnect Handler
    socket.on('disconnect', (reason) => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
      peer.transports.forEach(transport => transport.close());
      peer.producers.forEach(producer => producer.close());
      peer.consumers.forEach(consumer => consumer.close());
      
      if (room) {
        room.peers.delete(socket.id);
      }
      socket.to(streamId).emit('peerClosed', { peerId: socket.id });
    });
  });

  httpServer.io = io;
  logger.info('[Socket.IO] Server setup complete and event handlers registered.');
  return io;
} 