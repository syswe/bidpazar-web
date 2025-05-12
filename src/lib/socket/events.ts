import { Socket } from "socket.io";
import { logger } from "@/lib/logger";
import { 
  updateDatabaseStreamState, 
  validateStreamState, 
  emitStreamStateChange
} from './socketEvents';
import { SocketHandlerContext, MAX_CHAT_HISTORY, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT } from './types';
import { formatError } from './utils';
import { logEvent } from './utils';
import { getOrCreateRoom, findExistingUserConnection, removeExistingPeer, ensureOnlyOneStreamerInRoom } from './rooms';
import { handleBroadcasterDisconnection } from './streamHandlers';
import { getAppropriateIceConfiguration } from './network';

/**
 * Register chat event handlers
 */
export function registerChatEvents(socket: Socket, context: SocketHandlerContext) {
  // joinChatRoom event
  socket.on("joinChatRoom", (roomData) => {
    const { streamId } = roomData;
    if (!streamId) return;
    
    const userId = socket.data.userId;
    const username = socket.data.username || "Anonymous";
    
    logEvent("joinChatRoom", socket.id, {
      streamId,
      userId,
      username,
    });

    socket.join(`chat:${streamId}`);
    logger.info(`[Socket.IO] Client joined chat room: chat:${streamId}`, {
      socketId: socket.id,
      streamId,
      username,
    });

    // Initialize chat storage for this stream if it doesn't exist
    if (!context.chatMessages[streamId]) {
      context.chatMessages[streamId] = [];
    }

    // Send existing chat history to the client
    socket.emit("chatHistory", context.chatMessages[streamId]);
  });

  // leaveChatRoom event
  socket.on("leaveChatRoom", (roomData) => {
    const { streamId } = roomData;
    if (!streamId) return;

    logEvent("leaveChatRoom", socket.id, {
      streamId,
      userId: socket.data.userId,
      username: socket.data.username || "Anonymous",
    });

    socket.leave(`chat:${streamId}`);
    logger.info(`[Socket.IO] Client left chat room: chat:${streamId}`, {
      socketId: socket.id,
      streamId,
    });
  });

  // sendChatMessage event
  socket.on("sendChatMessage", (messageData) => {
    const { streamId, content } = messageData;
    if (!streamId || !content || !socket.data.userId) return;

    const userId = socket.data.userId;
    const username = socket.data.username || "Anonymous";
    
    logEvent("sendChatMessage", socket.id, {
      streamId,
      userId,
      username,
      messageLength: content.length,
    });

    // Create message object
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      streamId,
      userId,
      username,
      content,
      timestamp: new Date().toISOString(),
    };

    // Store in memory
    if (!context.chatMessages[streamId]) {
      context.chatMessages[streamId] = [];
    }

    context.chatMessages[streamId].push(message);

    // Limit the chat history size
    if (context.chatMessages[streamId].length > MAX_CHAT_HISTORY) {
      context.chatMessages[streamId] = context.chatMessages[streamId].slice(
        -MAX_CHAT_HISTORY
      );
    }

    // Broadcast to all clients in this chat room
    context.io.to(`chat:${streamId}`).emit("newChatMessage", message);

    logger.info(`[Socket.IO] Chat message sent to room: chat:${streamId}`, {
      messageId: message.id,
      streamId,
      userId,
    });
  });
}

/**
 * Register stream state event handlers
 */
export function registerStreamStateEvents(socket: Socket, context: SocketHandlerContext) {
  // Handle stream_starting event
  socket.on("stream_starting", async (data) => {
    try {
      if (!data.streamId) {
        logger.warn(`[WebRTC] stream_starting event missing streamId`, {
          socketId: socket.id,
          data
        });
        return;
      }

      // Type assertion to string/undefined for type safety
      const streamId = String(data.streamId);
      const userIdFromData = data.userId ? String(data.userId) : "system";
      const username = data.username ? String(data.username) : "unknown"; 
      
      logEvent("stream_starting", socket.id, {
        streamId,
        userId: userIdFromData,
        username
      });
      
      // Validate the stream exists and check its current state
      const streamValidation = await validateStreamState(streamId);
      
      // Fail fast if stream has ended - cannot restart ended streams
      if (streamValidation.isValid && streamValidation.actualState === "ENDED") {
        logger.warn(`[WebRTC] Cannot start an ENDED stream: ${streamId}`, {
          socketId: socket.id,
          userId: userIdFromData
        });
        
        socket.emit("error", {
          message: "This stream has already ended. Please create a new stream.",
          code: "STREAM_ENDED",
          canReconnect: false,
          canCreateNewStream: true
        });
        return;
      }
      
      // Attempt to recover the stream if it's in an intermediate state
      if (streamValidation.isValid && streamValidation.actualState !== "STARTING" && streamValidation.actualState !== "LIVE") {
        // Try to transition stream to STARTING state in database
        const updated = await updateDatabaseStreamState(streamId, "STARTING", userIdFromData);
        if (updated) {
          logger.info(`[WebRTC] Successfully transitioned stream ${streamId} from ${streamValidation.actualState} to STARTING`);
        } else {
          logger.warn(`[WebRTC] Failed to transition stream ${streamId} from ${streamValidation.actualState} to STARTING`);
        }
      }
      
      // Prepare the room for the upcoming broadcaster
      const room = await getOrCreateRoom(streamId, userIdFromData, context);
      
      logger.info(`[WebRTC] Room prepared for stream ${streamId}`, {
        streamId,
        userId: userIdFromData
      });
      
      // Notify all clients in the room that stream is starting
      socket.to(`stream:${streamId}`).emit("stream_state_changed", {
        streamId,
        status: "STARTING",
        message: "Stream is starting",
        userId: userIdFromData
      });
      
      // Acknowledge successful preparation
      socket.emit("stream_starting_ack", {
        streamId,
        success: true,
        currentState: streamValidation.actualState || "UNKNOWN"
      });
    } catch (error) {
      logger.error(`[WebRTC] Error in stream_starting handler`, {
        error: formatError(error),
        socketId: socket.id,
        data
      });
    }
  });
  
  // Handle stream state changes from API or other sources
  socket.on("stream_state_changed", async (data) => {
    if (!data.streamId) return;
    
    logEvent("stream_state_changed", socket.id, {
      streamId: data.streamId,
      state: data.status,
      userId: socket.data.userId,
      source: data.source || "client"
    });
    
    const streamId = data.streamId;
    
    // Handle different states
    switch (data.status) {
      case "ENDED":
        // If stream ended, notify users and handle room cleanup
        try {
          const room = context.rooms.get(streamId);
          if (room) {
            // Notify all clients in the room
            context.io.to(`stream:${streamId}`).emit("stream_ended", {
              streamId: streamId,
              reason: "Stream ended by broadcaster",
              source: data.source || "client"
            });
            
            // Log event to track state synchronization
            emitStreamStateChange({
              streamId,
              state: "ENDED",
              userId: socket.data.userId,
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
          let room = context.rooms.get(streamId);
          if (!room) {
            room = await getOrCreateRoom(streamId, socket.data.userId, context);
            logger.info(`[WebRTC] Created room for LIVE stream ${streamId} from external event`);
          }
          
          // Log event to track state synchronization
          emitStreamStateChange({
            streamId,
            state: "LIVE",
            userId: socket.data.userId,
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
          userId: socket.data.userId,
          timestamp: new Date().toISOString(),
          metadata: { source: data.source || "client" }
        });
        break;
    }
  });
}

/**
 * Register broadcaster event handlers
 */
export function registerBroadcasterEvents(socket: Socket, context: SocketHandlerContext) {
  // Handle broadcaster_ready event
  socket.on("broadcaster_ready", async (data) => {
    try {
      const streamId = socket.data.streamId;
      if (!streamId) {
        socket.emit("error", { message: "No streamId provided" });
        return;
      }
      
      const userId = socket.data.userId;
      const username = socket.data.username;
      const sessionId = socket.data.sessionId;

      logEvent("broadcaster_ready", socket.id, {
        streamId,
        sessionId: data.sessionId || sessionId,
        userId,
      });
      
      // First check if this stream has already ended
      const streamValidation = await validateStreamState(streamId);
      
      // Special case: If ENDED state is detected, immediately send a clear error message
      if (streamValidation.isValid && streamValidation.actualState === "ENDED") {
        logger.info(`[WebRTC] Broadcaster trying to start an ENDED stream: ${streamId}. Sending clear message.`);
        socket.emit("error", { 
          message: "This stream has already ended. Please create a new stream using the 'New Stream' button.",
          code: "STREAM_ENDED",
          canReconnect: false,
          canCreateNewStream: true
        });
        return;
      }
      
      // For other states, continue with normal validation
      const fullValidation = await validateStreamState(streamId, ["STARTING", "LIVE", "FAILED_TO_START", "INTERRUPTED"]);
      
      if (!fullValidation.isValid) {
        // This case handles states that can't be recovered from
        logger.warn(`[WebRTC] Stream state validation failed for broadcaster with unrecoverable state: ${streamId}`, {
          error: fullValidation.error,
          socketId: socket.id,
          actualState: fullValidation.actualState
        });
        socket.emit("error", { 
          message: fullValidation.error || `Stream is in an unrecoverable state: ${fullValidation.actualState}. Please try creating a new stream.`,
          code: "STREAM_STATE_ERROR_UNRECOVERABLE",
          canReconnect: false,
          canCreateNewStream: true
        });
        return;
      }

      // Handle specific states that need explicit transition to STARTING
      if (["FAILED_TO_START", "INTERRUPTED"].includes(fullValidation.actualState!)) {
        logger.info(`[WebRTC] Stream ${streamId} is in state ${fullValidation.actualState}. Attempting to transition to STARTING.`);
        const updated = await updateDatabaseStreamState(streamId, "STARTING", userId as string);
        if (!updated) {
          socket.emit("error", {
            message: `Failed to transition stream from ${fullValidation.actualState} to STARTING. Please try again.`,
            code: "STREAM_STATE_TRANSITION_FAILED",
            canReconnect: false
          });
          return;
        }
        logger.info(`[WebRTC] Stream ${streamId} successfully transitioned to STARTING. Proceeding with broadcaster_ready.`);
      }
      
      // Get the room
      const room = await getOrCreateRoom(streamId, userId as string, context);

      // Enhanced debugging to log the room peer state
      logger.debug(`[WebRTC] Room peer state before broadcaster ready check:`, {
        streamId,
        socketId: socket.id,
        peersInRoom: Array.from(room.peers.keys()),
        peerExists: room.peers.has(socket.id),
      });

      // Check for existing broadcasters for this stream but with different socket IDs
      if (userId) {
        const existingConnection = findExistingUserConnection(
          room,
          userId as string,
          true // isStreamer
        );

        if (existingConnection && existingConnection.socketId !== socket.id) {
          // Remove the existing connection to prevent duplicates
          if (removeExistingPeer(room, existingConnection.socketId)) {
            logger.info(`[WebRTC] Successfully removed stale broadcaster connection ${existingConnection.socketId}`);
          }
        }
      }

      // Get peer from the room - check if peer exists
      let peer = room.peers.get(socket.id);

      // If the peer doesn't exist, create it
      if (!peer) {
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
      } else {
        // Update existing peer details
        peer.isStreamer = true;
        peer.lastActivity = Date.now();
      }

      // Ensure only one streamer per room
      ensureOnlyOneStreamerInRoom(context.io, room, userId as string, socket.id);

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

      // Update database to reflect that stream is now LIVE
      try {
        if (userId) {
          const success = await updateDatabaseStreamState(streamId, "LIVE", userId as string);
          
          if (success) {
            // Emit stream state change event
            emitStreamStateChange({
              streamId,
              state: "LIVE",
              userId: userId as string,
              timestamp: new Date().toISOString(),
              metadata: { socketId: socket.id }
            });
          }
        }
      } catch (err) {
        logger.error(`[WebRTC] Error updating database state for stream ${streamId}`, {
          error: formatError(err),
          streamId,
          userId
        });
      }
      
      // Notify all viewers
      context.io.to(`stream:${streamId}`).emit("broadcaster_ready", {
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

      logger.info(`[WebRTC] Stream ${streamId} is now active with broadcaster ${userId}`);

      // Initialize heartbeat tracking for this broadcaster
      context.broadcasterHeartbeats.set(socket.id, Date.now());
    } catch (err) {
      logger.error(`[WebRTC] Error in broadcaster_ready handler`, {
        error: formatError(err),
        socketId: socket.id,
        streamId: socket.data.streamId,
      });

      socket.emit("error", {
        message: "Server error occurred. Please try again.",
        code: "INTERNAL_ERROR",
        details: formatError(err),
      });
    }
  });
}

/**
 * Register viewer event handlers
 */
export function registerViewerEvents(socket: Socket, context: SocketHandlerContext) {
  // Handle viewer_ready event
  socket.on("viewer_ready", async (data) => {
    try {
      const streamId = socket.data.streamId;
      if (!streamId) return;

      logEvent("viewer_ready", socket.id, {
        streamId,
        sessionId: socket.data.sessionId,
        userId: socket.data.userId,
      });

      // Get the room
      const room = await getOrCreateRoom(streamId, undefined, context);

      // Mark this socket as a viewer (not a streamer)
      const peer = room.peers.get(socket.id);
      if (peer) {
        peer.isStreamer = false;
        peer.lastActivity = Date.now();
      } else {
        logger.warn(`[WebRTC] Viewer not found in peers map: ${socket.id}`);
      }

      // Find the streamer in this room if any
      let streamerPeer: any = null;
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
        streamerPeer.producers.forEach((producer: any) => {
          activeProducers.push({
            producerId: producer.id,
            kind: producer.kind,
            peerId: streamerSocketId as string,
          });
        });
      }

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
          viewerUserId: socket.data.userId,
          viewerUsername: socket.data.username,
        });
      }

      logger.info(`[WebRTC] Viewer ${socket.data.userId} ready for stream ${streamId}`);
    } catch (err) {
      logger.error(`[WebRTC] Error in viewer_ready handler`, {
        error: formatError(err),
        socketId: socket.id,
        streamId: socket.data.streamId,
      });
    }
  });
}

/**
 * Register WebRTC signaling event handlers
 */
export function registerWebRTCSignalingEvents(socket: Socket, context: SocketHandlerContext) {
  // Handle WebRTC signaling for peers
  socket.on("rtc_signal", (data) => {
    const { targetSocketId, signal, type } = data;
    const streamId = socket.data.streamId;
    const sessionId = socket.data.sessionId;

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
    }
  });

  // Handle getRouterRtpCapabilities
  socket.on("getRouterRtpCapabilities", async (data, callback) => {
    try {
      const streamId = socket.data.streamId;
      if (!streamId) {
        return callback({ error: "No streamId provided" });
      }

      logEvent("getRouterRtpCapabilities", socket.id, {
        streamId,
        sessionId: data.sessionId || socket.data.sessionId,
        userId: socket.data.userId,
        connectionType: socket.data.connectionType,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);

      // Get the peer if it already exists
      let peer = room.peers.get(socket.id);

      // Create a new peer if it doesn't exist
      if (!peer) {
        // Create a new peer for this connection
        peer = {
          socketId: socket.id,
          userId: socket.data.userId,
          username: socket.data.username,
          sessionId: socket.data.sessionId,
          isStreamer: socket.data.isBroadcaster,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
          lastActivity: Date.now(),
          rtpCapabilities: data.rtpCapabilities,
          connectionType: socket.data.connectionType,
        };

        // Add the peer to the room
        room.peers.set(socket.id, peer);
        room.activeSessions.set(socket.data.sessionId, socket.id);
      } else {
        // Update existing peer
        peer.lastActivity = Date.now();
        peer.connectionType = socket.data.connectionType;
        if (data.rtpCapabilities) {
          peer.rtpCapabilities = data.rtpCapabilities;
        }
      }

      // Special handling for streamer connections to enforce one streamer per room
      if (socket.data.isBroadcaster) {
        ensureOnlyOneStreamerInRoom(context.io, room, socket.data.userId, socket.id);
      }

      // Return the router capabilities with loopback flag
      callback({
        rtpCapabilities: room.router.rtpCapabilities,
        isLoopback: socket.data.connectionType === "loopback",
      });
    } catch (err) {
      logger.error("[WebRTC] Error getting router capabilities", {
        error: formatError(err),
        socketId: socket.id,
        streamId: socket.data.streamId,
        connectionType: socket.data.connectionType,
      });
      callback({ error: formatError(err) });
    }
  });

  // Handle createProducerTransport
  socket.on("createProducerTransport", async (data, callback) => {
    try {
      const streamId = socket.data.streamId;
      if (!streamId) {
        return callback({ error: "No streamId provided" });
      }

      logEvent("createProducerTransport", socket.id, {
        streamId,
        userId: socket.data.userId,
        isStreamer: socket.data.isBroadcaster,
        connectionType: socket.data.connectionType,
      });

      const room = await getOrCreateRoom(streamId, undefined, context);

      // Update peer activity timestamp
      const peer = room.peers.get(socket.id);
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      peer.lastActivity = Date.now();
      peer.connectionType = socket.data.connectionType;

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

      // If this is a streamer, enforce only one streamer per room
      if (socket.data.isBroadcaster) {
        ensureOnlyOneStreamerInRoom(context.io, room, socket.data.userId, socket.id);
      }
    } catch (error) {
      logger.error(`[WebRTC] Error creating producer transport`, {
        error: formatError(error),
        streamId: socket.data.streamId,
        socketId: socket.id,
      });
      callback({ error: "Error creating producer transport" });
    }
  });

  // Register other WebRTC signaling events (simplified)
  // In a full implementation, you would add handlers for:
  // - createConsumerTransport
  // - connectTransport
  // - produce
  // - consume
  // - resumeConsumer
  // - getProducers
  // - etc.
}

/**
 * Register WebRTC events (wrapper function)
 */
export function registerWebRTCEvents(socket: Socket, context: SocketHandlerContext) {
  // This is a wrapper that calls the specific WebRTC event handlers
  registerWebRTCSignalingEvents(socket, context);
}

/**
 * Start heartbeat monitoring for a broadcaster
 */
export function startHeartbeatMonitoring(socket: Socket, context: SocketHandlerContext) {
  // Handle heartbeat from client
  socket.on("heartbeat", () => {
    if (socket.data.isBroadcaster) {
      context.broadcasterHeartbeats.set(socket.id, Date.now());
      logger.debug(`[Heartbeat] Received from broadcaster ${socket.id}`, {
        streamId: socket.data.streamId,
        userId: socket.data.userId
      });
    }
  });

  // Set up heartbeat check interval
  const heartbeatInterval = setInterval(() => {
    // Skip if socket is no longer connected or heartbeat entry was removed
    if (!socket.connected || !context.broadcasterHeartbeats.has(socket.id)) {
      clearInterval(heartbeatInterval);
      return;
    }
    
    const lastHeartbeat = context.broadcasterHeartbeats.get(socket.id);
    if (!lastHeartbeat) return;
    
    const elapsed = Date.now() - lastHeartbeat;
    if (elapsed > HEARTBEAT_TIMEOUT) {
      logger.warn(`[Heartbeat] Broadcaster ${socket.id} timed out after ${elapsed}ms`, {
        streamId: socket.data.streamId,
        userId: socket.data.userId
      });
      
      // Handle as if the broadcaster disconnected
      if (socket.data.streamId && socket.data.userId) {
        handleBroadcasterDisconnection(socket.data.streamId, socket.data.userId, socket, context);
      }
      socket.disconnect(true);
      clearInterval(heartbeatInterval);
    }
  }, HEARTBEAT_INTERVAL);

  // Clean up on disconnect
  socket.on("disconnect", () => {
    clearInterval(heartbeatInterval);
    context.broadcasterHeartbeats.delete(socket.id);
  });
} 