import { logger } from "@/lib/logger";
import axios from "axios";
import { PrismaClient } from '@prisma/client';
import { ExtendedHttpServer } from './types';

// Stream states
export type StreamState = 
  | "SCHEDULED"
  | "STARTING"
  | "LIVE"
  | "PAUSED"
  | "ENDING"
  | "ENDED"
  | "CANCELLED"
  | "FAILED_TO_START"
  | "INTERRUPTED";

// Event types for stream lifecycle
export interface StreamStateChangeEvent {
  streamId: string;
  state: StreamState;
  userId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Function to emit stream state changes for logging and potential message bus integration
export function emitStreamStateChange(event: StreamStateChangeEvent): void {
  logger.info(`[StreamEvent] State change: ${event.streamId} -> ${event.state}`, {
    ...event,
    timestamp: event.timestamp || new Date().toISOString()
  });
  
  // Future expansion point: Could publish to a message bus, notify other services, etc.
}

// Helper to update database when WebRTC state changes
// This is the ONLY function that should update stream state to avoid race conditions
export async function updateDatabaseStreamState(
  streamId: string, 
  state: StreamState,
  userId?: string
): Promise<boolean> {
  try {
    // Direct database update via Prisma
    const updateData: Record<string, any> = { status: state };
    
    // Add appropriate timestamps based on state
    switch (state) {
      case "SCHEDULED":
        // No timestamp changes needed for initial schedule
        break;
      case "STARTING":
        // No timestamp changes yet - startTime is set only when fully LIVE
        break;
      case "LIVE":
        // Only set startTime if transitioning to LIVE for the first time
        const prismaTemp = new PrismaClient();
        const currentStream = await prismaTemp.liveStream.findUnique({
          where: { id: streamId },
          select: { startTime: true, status: true }
        });
        prismaTemp.$disconnect();
        
        // If stream is coming from STARTING or PAUSED to LIVE
        if (!currentStream?.startTime && currentStream?.status !== 'PAUSED') {
          updateData.startTime = new Date();
        }
        break;
      case "PAUSED":
        // No timestamp changes for pause
        break;
      case "ENDING":
        // No timestamp changes yet - endTime is set only when fully ENDED
        break;
      case "ENDED":
      case "CANCELLED":
      case "FAILED_TO_START":
      case "INTERRUPTED":
        // Set endTime for all terminal states
        updateData.endTime = new Date();
        break;
      default:
        logger.warn(`[StreamSync] Unhandled stream state: ${state}`);
        break;
    }
    
    // Use Prisma directly to avoid circular dependencies through API calls
    const prisma = new PrismaClient();
    await prisma.liveStream.update({
      where: { id: streamId },
      data: updateData
    });
    prisma.$disconnect();
    
    // Emit WebSocket notification about the state change
    const httpServer = (global as any).server as ExtendedHttpServer;
    if (httpServer?.io) {
      httpServer.io.to(`stream:${streamId}`).emit('stream_state_changed', {
        streamId,
        status: state,
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Emit specific event based on the state if needed
      switch (state) {
        case "LIVE":
          httpServer.io.to(`stream:${streamId}`).emit('stream_went_live', {
            streamId,
            userId
          });
          break;
        case "ENDED":
        case "INTERRUPTED":
        case "CANCELLED":
        case "FAILED_TO_START":
          httpServer.io.to(`stream:${streamId}`).emit('stream_ended', {
            streamId,
            status: state,
            reason: state.toLowerCase(),
            userId
          });
          break;
      }
    }
    
    logger.info(`[StreamSync] Updated stream ${streamId} state to ${state}`, {
      streamId,
      userId,
      state
    });
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(`[StreamSync] Failed to update database for stream ${streamId}`, { 
      error: errorMessage,
      stack: errorStack,
      streamId,
      userId,
      targetState: state
    });
    return false;
  }
}

// Helper to validate stream state between WebRTC and database
export async function validateStreamState(
  streamId: string, 
  expectedState?: StreamState | StreamState[]
): Promise<{
  isValid: boolean;
  actualState?: StreamState;
  error?: string;
}> {
  try {
    // Get current stream state from database
    const prisma = new PrismaClient();
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { status: true }
    });
    prisma.$disconnect();
    
    if (!stream) {
      return { isValid: false, error: "Stream not found" };
    }
    
    const actualState = stream.status as StreamState;
    
    // If no expected state provided, just return actual state
    if (!expectedState) {
      return { isValid: true, actualState };
    }
    
    // Handle array of valid states
    if (Array.isArray(expectedState)) {
      const isValid = expectedState.includes(actualState);
      
      // Provide more helpful error message for ended streams
      if (!isValid && actualState === "ENDED") {
        return { 
          isValid: false,
          actualState,
          error: "This stream has already ended. Please create a new stream using the 'New Stream' button."
        };
      }
      
      return { 
        isValid,
        actualState
      };
    }
    
    // Check if state matches expected
    const isValid = actualState === expectedState;
    
    // Provide more helpful error message for ended streams
    if (!isValid && actualState === "ENDED") {
      return { 
        isValid: false,
        actualState,
        error: "This stream has already ended. Please create a new stream using the 'New Stream' button."
      };
    }
    
    return { 
      isValid,
      actualState
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(`[StreamSync] Failed to validate stream state for ${streamId}`, {
      error: errorMessage,
      stack: errorStack,
      streamId,
      expectedState
    });
    return { isValid: false, error: errorMessage };
  }
}