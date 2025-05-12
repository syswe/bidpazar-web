import { Socket } from "socket.io";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";
import { formatError, logEvent } from './utils';
import { SocketHandlerContext } from './types';
import { getOrCreateRoom } from './rooms';
import { getAppropriateIceConfiguration } from './network';

/**
 * Handle connectTransport event
 */
export function handleConnectTransport(socket: Socket, context: SocketHandlerContext) {
  socket.on("connectTransport", async (data, callback) => {
    try {
      const { transportId, dtlsParameters } = data;
      const streamId = socket.data.streamId;
      
      if (!streamId || !transportId || !dtlsParameters) {
        return callback({ error: "Missing required parameters" });
      }

      logEvent("connectTransport", socket.id, {
        streamId,
        transportId,
        userId: socket.data.userId,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);
      const peer = room.peers.get(socket.id);
      
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Update peer activity timestamp
      peer.lastActivity = Date.now();

      // Get the transport
      const transport = peer.transports.get(transportId);
      if (!transport) {
        return callback({ error: "Transport not found" });
      }

      // Connect the transport
      await transport.connect({ dtlsParameters });
      
      callback({ connected: true });

      logger.info(`[WebRTC] Transport ${transportId} connected for peer ${socket.id}`, {
        streamId,
        userId: socket.data.userId,
        transportId,
      });
    } catch (error) {
      logger.error(`[WebRTC] Error connecting transport`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
      });
      callback({ error: "Error connecting transport" });
    }
  });
}

/**
 * Handle produce event
 */
export function handleProduce(socket: Socket, context: SocketHandlerContext) {
  socket.on("produce", async (data, callback) => {
    try {
      const { transportId, kind, rtpParameters, appData } = data;
      const streamId = socket.data.streamId;
      
      if (!streamId || !transportId || !kind || !rtpParameters) {
        return callback({ error: "Missing required parameters" });
      }

      logEvent("produce", socket.id, {
        streamId,
        transportId,
        kind,
        userId: socket.data.userId,
        appData,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);
      const peer = room.peers.get(socket.id);
      
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Update peer activity timestamp and streamer status
      peer.lastActivity = Date.now();
      if (socket.data.isBroadcaster) {
        peer.isStreamer = true;
      }

      // Get the transport
      const transport = peer.transports.get(transportId);
      if (!transport) {
        return callback({ error: "Transport not found" });
      }

      // Create producer
      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { ...appData, peerId: socket.id },
      });

      // Store the producer
      peer.producers.set(producer.id, producer);

      // Event handlers for the producer
      producer.on("transportclose", () => {
        logger.info(`[WebRTC] Producer ${producer.id} transport closed`, {
          producerId: producer.id,
          socketId: socket.id,
          kind,
        });
        producer.close();
        peer.producers.delete(producer.id);
      });

      // Handle producer cleanup when closed
      producer.observer.on("close", () => {
        logger.info(`[WebRTC] Producer ${producer.id} closed`, {
          producerId: producer.id,
          socketId: socket.id,
          kind,
        });
        peer.producers.delete(producer.id);
      });

      callback({ id: producer.id });

      // Notify all peers in the room that a new producer is available
      for (const otherPeer of room.peers.values()) {
        // Skip the producer itself
        if (otherPeer.socketId === socket.id) continue;
        
        // Skip peers that don't have rtpCapabilities (not ready to consume)
        if (!otherPeer.rtpCapabilities) continue;

        context.io.to(otherPeer.socketId).emit("newProducer", {
          producerId: producer.id,
          producerSocketId: socket.id,
          kind,
          appData: producer.appData,
        });
      }

      logger.info(`[WebRTC] New ${kind} producer ${producer.id} created for peer ${socket.id}`, {
        streamId,
        userId: socket.data.userId,
        kind,
      });

    } catch (error) {
      logger.error(`[WebRTC] Error in produce handler`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
      });
      callback({ error: "Error creating producer" });
    }
  });
}

/**
 * Handle createConsumerTransport event
 */
export function handleCreateConsumerTransport(socket: Socket, context: SocketHandlerContext) {
  socket.on("createConsumerTransport", async (data, callback) => {
    try {
      const streamId = socket.data.streamId;
      if (!streamId) {
        return callback({ error: "No streamId provided" });
      }

      logEvent("createConsumerTransport", socket.id, {
        streamId,
        userId: socket.data.userId,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);
      const peer = room.peers.get(socket.id);
      
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Update peer activity timestamp
      peer.lastActivity = Date.now();

      // Get appropriate WebRTC transport config
      const transportConfig = getAppropriateIceConfiguration(socket);
      
      // Create a WebRTC transport
      const transport = await room.router.createWebRtcTransport(transportConfig);

      // Store the transport
      peer.transports.set(transport.id, transport);

      // Return transport parameters
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        isLoopback: socket.data.connectionType === "loopback",
      });

      logger.info(`[WebRTC] Consumer transport ${transport.id} created for peer ${socket.id}`, {
        streamId,
        userId: socket.data.userId,
      });
    } catch (error) {
      logger.error(`[WebRTC] Error creating consumer transport`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
      });
      callback({ error: "Error creating consumer transport" });
    }
  });
}

/**
 * Handle consume event
 */
export function handleConsume(socket: Socket, context: SocketHandlerContext) {
  socket.on("consume", async (data, callback) => {
    try {
      const { transportId, producerId, rtpCapabilities } = data;
      const streamId = socket.data.streamId;
      
      if (!streamId || !transportId || !producerId || !rtpCapabilities) {
        return callback({ error: "Missing required parameters" });
      }

      logEvent("consume", socket.id, {
        streamId,
        transportId,
        producerId,
        userId: socket.data.userId,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);
      const peer = room.peers.get(socket.id);
      
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Update peer activity timestamp
      peer.lastActivity = Date.now();

      // Get the transport
      const transport = peer.transports.get(transportId);
      if (!transport) {
        return callback({ error: "Transport not found" });
      }

      // Check if the router can consume this producer with the given capabilities
      let canConsume = false;
      try {
        canConsume = room.router.canConsume({
          producerId,
          rtpCapabilities,
        });
      } catch (error) {
        logger.error(`[WebRTC] Error checking if router can consume`, {
          error: formatError(error),
          streamId,
          socketId: socket.id,
          producerId,
        });
      }

      if (!canConsume) {
        return callback({ error: "Cannot consume this producer" });
      }

      // Create the consumer
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start in paused state
      });

      // Store the consumer
      peer.consumers.set(consumer.id, consumer);

      // Event handlers for the consumer
      consumer.on("transportclose", () => {
        logger.info(`[WebRTC] Consumer ${consumer.id} transport closed`, {
          consumerId: consumer.id,
          socketId: socket.id,
        });
        consumer.close();
        peer.consumers.delete(consumer.id);
      });

      consumer.on("producerclose", () => {
        logger.info(`[WebRTC] Consumer ${consumer.id} producer closed`, {
          consumerId: consumer.id,
          socketId: socket.id,
        });
        consumer.close();
        peer.consumers.delete(consumer.id);
        
        // Notify the client that the producer is closed
        socket.emit("producerClosed", {
          consumerId: consumer.id,
          producerId: producerId,
        });
      });

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      });

      logger.info(`[WebRTC] New consumer ${consumer.id} created for peer ${socket.id}`, {
        streamId,
        userId: socket.data.userId,
        producerId,
        kind: consumer.kind,
      });
    } catch (error) {
      logger.error(`[WebRTC] Error in consume handler`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
        producerId: data.producerId,
      });
      callback({ error: "Error creating consumer" });
    }
  });
}

/**
 * Handle resumeConsumer event
 */
export function handleResumeConsumer(socket: Socket, context: SocketHandlerContext) {
  socket.on("resumeConsumer", async (data, callback) => {
    try {
      const { consumerId } = data;
      const streamId = socket.data.streamId;
      
      if (!streamId || !consumerId) {
        return callback({ error: "Missing required parameters" });
      }

      logEvent("resumeConsumer", socket.id, {
        streamId,
        consumerId,
        userId: socket.data.userId,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);
      const peer = room.peers.get(socket.id);
      
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Update peer activity timestamp
      peer.lastActivity = Date.now();

      // Get the consumer
      const consumer = peer.consumers.get(consumerId);
      if (!consumer) {
        return callback({ error: "Consumer not found" });
      }

      // Resume the consumer
      await consumer.resume();
      
      callback({ resumed: true });

      logger.info(`[WebRTC] Consumer ${consumerId} resumed for peer ${socket.id}`, {
        streamId,
        userId: socket.data.userId,
      });
    } catch (error) {
      logger.error(`[WebRTC] Error resuming consumer`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
        consumerId: data.consumerId,
      });
      callback({ error: "Error resuming consumer" });
    }
  });
}

/**
 * Handle getProducers event
 */
export function handleGetProducers(socket: Socket, context: SocketHandlerContext) {
  socket.on("getProducers", async (data, callback) => {
    try {
      const streamId = socket.data.streamId;
      if (!streamId) {
        return callback({ error: "No streamId provided" });
      }

      logEvent("getProducers", socket.id, {
        streamId,
        userId: socket.data.userId,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);
      const peer = room.peers.get(socket.id);
      
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Update peer activity timestamp
      peer.lastActivity = Date.now();

      // Get all producers in the room
      const producers: Array<{
        producerId: string;
        kind: string;
        peerId: string;
        appData?: any;
      }> = [];

      for (const [peerId, remotePeer] of room.peers.entries()) {
        remotePeer.producers.forEach((producer) => {
          producers.push({
            producerId: producer.id,
            kind: producer.kind,
            peerId,
            appData: producer.appData,
          });
        });
      }

      callback({ producers });

      logger.info(`[WebRTC] Get producers request from peer ${socket.id}, found ${producers.length} producers`, {
        streamId,
        userId: socket.data.userId,
      });
    } catch (error) {
      logger.error(`[WebRTC] Error in getProducers handler`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
      });
      callback({ error: "Error getting producers" });
    }
  });
}

/**
 * Register all WebRTC-specific event handlers
 */
export function registerAllWebRTCEvents(socket: Socket, context: SocketHandlerContext) {
  handleConnectTransport(socket, context);
  handleProduce(socket, context);
  handleCreateConsumerTransport(socket, context);
  handleConsume(socket, context);
  handleResumeConsumer(socket, context);
  handleGetProducers(socket, context);
} 