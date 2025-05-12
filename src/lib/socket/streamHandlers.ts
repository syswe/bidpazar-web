import { Socket } from "socket.io";
import { logger } from "@/lib/logger";
import { 
  updateDatabaseStreamState, 
  validateStreamState, 
  emitStreamStateChange, 
  StreamState 
} from './socketEvents';
import { SocketHandlerContext } from './types';
import { formatError } from './utils';
import { cleanupRoom } from './rooms';

/**
 * Handle broadcaster disconnection
 */
export async function handleBroadcasterDisconnection(
  streamId: string, 
  userId: string, 
  socket: Socket,
  context: SocketHandlerContext
) {
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
    
    // 2. Only process if stream is in LIVE, PAUSED, or STARTING state
    if (actualState !== "LIVE" && actualState !== "PAUSED" && actualState !== "STARTING") {
      logger.info(`[StreamHandler] Stream ${streamId} is not in an active or starting state (${actualState}), no cleanup needed for abrupt disconnect.`);
      return;
    }
    
    // 3. Get the room if it exists
    const room = context.rooms.get(streamId);
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
      logger.info(`[StreamHandler] No remaining broadcasters for ${streamId}.`);
      let targetState: StreamState = "INTERRUPTED"; // Default for LIVE/PAUSED
      if (actualState === "STARTING") {
        logger.info(`[StreamHandler] Stream ${streamId} was STARTING and broadcaster disconnected abruptly. Setting to FAILED_TO_START.`);
        targetState = "FAILED_TO_START";
      } else {
        logger.info(`[StreamHandler] Stream ${streamId} was ${actualState} and broadcaster disconnected abruptly. Setting to INTERRUPTED.`);
      }
      
      await updateDatabaseStreamState(streamId, targetState, userId);
      
      // Notify all viewers about the interrupted/failed stream
      context.io.to(`stream:${streamId}`).emit('stream_interrupted', {
        streamId,
        reason: "broadcaster_disconnected",
        finalState: targetState // Add final state to notification
      });
      
      // Optionally close the entire room if no viewers either
      if (room.peers.size === 0) {
        cleanupRoom(streamId, context);
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

  // Ensure stream is marked as interrupted or failed even if cleanup fails
  // This fallback ensures the DB state is consistent if earlier updates failed.
  const finalValidation = await validateStreamState(streamId);
  if (finalValidation.isValid && (finalValidation.actualState === "LIVE" || finalValidation.actualState === "PAUSED" || finalValidation.actualState === "STARTING")) {
    let fallbackState: StreamState = "INTERRUPTED";
    if (finalValidation.actualState === "STARTING") {
      fallbackState = "FAILED_TO_START";
    }
    logger.warn(`[StreamHandler] Fallback: Stream ${streamId} still in ${finalValidation.actualState} after error. Forcing to ${fallbackState}.`);
    await updateDatabaseStreamState(streamId, fallbackState, userId);
  }
}

/**
 * Handle stream state changes
 */
export async function handleStreamStateChange(
  streamId: string, 
  userId: string, 
  eventType: 'disconnect' | 'end' | 'pause' | 'live',
  context: SocketHandlerContext
) {
  try {
    // Get current stream state
    const validation = await validateStreamState(streamId);
    if (!validation.isValid || !validation.actualState) {
      logger.warn(`[StreamHandler] Stream ${streamId} not found or state invalid during ${eventType}.`);
      return;
    }

    let targetState: StreamState | null = null;
    if (eventType === 'disconnect') {
      // Handle normal disconnection
      if (validation.actualState === "STARTING") {
        logger.info(`[StreamHandler] Stream ${streamId} was STARTING. Setting to FAILED_TO_START.`);
        targetState = "FAILED_TO_START";
      } else if (validation.actualState === "LIVE" || validation.actualState === "PAUSED") {
        logger.info(`[StreamHandler] Stream ${streamId} was ${validation.actualState}. Setting to ENDED.`);
        targetState = "ENDED";
      } else {
        logger.info(`[StreamHandler] Stream ${streamId} was ${validation.actualState}. No state change needed.`);
      }
    } else if (eventType === 'end') {
      // Explicit end request
      targetState = "ENDED";
    } else if (eventType === 'pause') {
      // Only pause if currently live
      if (validation.actualState === "LIVE") {
        targetState = "PAUSED";
      }
    } else if (eventType === 'live') {
      // Only go live if starting or paused
      if (validation.actualState === "STARTING" || validation.actualState === "PAUSED") {
        targetState = "LIVE";
      }
    }

    // Update state if needed
    if (targetState) {
      const success = await updateDatabaseStreamState(streamId, targetState, userId);
      if (success) {
        logger.info(`[StreamHandler] Successfully updated stream ${streamId} to ${targetState} after ${eventType}.`);
        emitStreamStateChange({
          streamId,
          state: targetState,
          userId,
          timestamp: new Date().toISOString(),
          metadata: { event: eventType }
        });
      } else {
        logger.warn(`[StreamHandler] Failed to update database state for stream ${streamId} to ${targetState} after ${eventType}.`);
      }
    }
  } catch (err) {
    logger.error(`[StreamHandler] Error handling stream state change for ${streamId}`, {
      error: formatError(err),
      streamId,
      userId,
      eventType
    });
  }
} 