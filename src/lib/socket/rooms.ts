import { Server as SocketIOServer } from "socket.io";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";
import { 
  emitStreamStateChange, 
  updateDatabaseStreamState, 
  validateStreamState 
} from './socketEvents';
import { Room, Peer, SocketHandlerContext } from './types';
import { formatError } from '@/lib/socket/utils';
import { isWorkerInitialized } from '@/lib/socket/worker';

/**
 * Get or create a room for a stream
 */
export async function getOrCreateRoom(
  streamId: string, 
  userId?: string,
  context?: SocketHandlerContext
): Promise<Room> {
  // Get references from context or global variables if not provided
  const rooms = context?.rooms || new Map<string, Room>();
  const roomCreationLocks = context?.roomCreationLocks || new Map<string, Promise<Room>>();
  const mediasoupWorker = context?.mediasoupWorker || (global as any).mediasoupWorker;
  
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
        throw new Error(`Cannot create room for ENDED stream: ${streamId}. A new stream must be created.`);
      } else if (streamState.actualState !== "STARTING" && streamState.actualState !== "LIVE" && streamState.actualState !== "SCHEDULED") {
        // Attempt to transition the stream to STARTING if it's in a recoverable state
        try {
          const recoveryStates = ["FAILED_TO_START", "INTERRUPTED"];
          if (recoveryStates.includes(streamState.actualState || "")) {
            logger.info(`[MediaSoup] Attempting to recover stream ${streamId} from ${streamState.actualState} to STARTING`);
            // Cast to string to ensure we always have a valid user ID for the database update
            const effectiveUserId = typeof userId === 'string' ? userId : "system";
            const updated = await updateDatabaseStreamState(streamId, "STARTING", effectiveUserId);
            if (!updated) {
              logger.error(`[MediaSoup] Failed to transition stream ${streamId} from ${streamState.actualState} to STARTING`);
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[MediaSoup] Error attempting to recover stream state: ${errorMessage}`);
        }
      }
      
      // Ensure we have a working mediasoup worker
      if (!isWorkerInitialized(mediasoupWorker)) {
        logger.error("[MediaSoup] MediaSoup worker is not initialized");
        throw new Error("Mediasoup worker failed to initialize");
      }
      
      logger.info(`[MediaSoup] Creating new room for stream: ${streamId}`);
      // At this point mediasoupWorker is guaranteed to be initialized
      const router = await mediasoupWorker.createRouter({
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

/**
 * Find existing connections from the same user in a room
 */
export function findExistingUserConnection(
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

/**
 * Remove existing peer connection
 */
export function removeExistingPeer(room: Room, socketId: string) {
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

/**
 * Clean up room resources completely
 */
export function cleanupRoom(streamId: string, context?: SocketHandlerContext) {
  const rooms = context?.rooms || new Map<string, Room>();
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

/**
 * Enforce only one streamer per room
 */
export function ensureOnlyOneStreamerInRoom(
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