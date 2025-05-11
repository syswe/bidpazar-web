# BidPazar Streaming Graceful Disconnection Handling

## Overview

This document outlines the process for detecting and handling unexpected broadcaster disconnections in the BidPazar live streaming system, such as browser crashes, network failures, or other abrupt terminations without proper "end stream" signals.

## Disconnection Detection Mechanisms

### 1. Socket.IO Disconnect Events

The primary mechanism for detecting disconnections is through Socket.IO's built-in disconnect event:

```typescript
// In socketHandler.ts
socket.on("disconnect", async () => {
  // Get user and stream information from socket data
  const { userId, streamId, role } = socket.data;
  
  // Only process for broadcaster disconnections
  if (role === "broadcaster" && streamId) {
    await handleBroadcasterDisconnection(streamId, userId, socket);
  }
});
```

### 2. Heartbeat System

A secondary mechanism implements a heartbeat system to detect "zombie" connections where the socket may still be connected, but the client is unresponsive:

```typescript
// In socketHandler.ts
const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const HEARTBEAT_TIMEOUT = 45000;  // 45 seconds

// Track last heartbeat timestamps for each broadcaster
const broadcasterHeartbeats = new Map<string, number>();

// Set up heartbeat checking on broadcaster connection
socket.on("broadcaster_ready", () => {
  // Initialize heartbeat tracking
  broadcasterHeartbeats.set(socket.id, Date.now());
  
  // Set up heartbeat check interval
  const interval = setInterval(() => {
    const lastHeartbeat = broadcasterHeartbeats.get(socket.id);
    if (!lastHeartbeat) return clearInterval(interval);
    
    const elapsed = Date.now() - lastHeartbeat;
    if (elapsed > HEARTBEAT_TIMEOUT) {
      logger.warn(`[Heartbeat] Broadcaster ${socket.id} timed out after ${elapsed}ms`);
      // Force disconnect and handle as if socket disconnected
      handleBroadcasterDisconnection(socket.data.streamId, socket.data.userId, socket);
      socket.disconnect(true);
      clearInterval(interval);
    }
  }, HEARTBEAT_INTERVAL);
  
  // Clear interval on disconnect
  socket.on("disconnect", () => clearInterval(interval));
});

// Handle heartbeat responses from client
socket.on("heartbeat", () => {
  broadcasterHeartbeats.set(socket.id, Date.now());
});
```

## Resource Cleanup Process

When a broadcaster disconnection is detected, several cleanup steps occur:

### 1. MediaSoup Resource Cleanup

```typescript
async function handleBroadcasterDisconnection(streamId: string, userId: string, socket: Socket) {
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
    
    // 2. Only process if stream is in LIVE or PAUSED state
    if (actualState !== "LIVE" && actualState !== "PAUSED") {
      logger.info(`[StreamHandler] Stream ${streamId} is not active (${actualState}), no cleanup needed`);
      return;
    }
    
    // 3. Get the room if it exists
    const room = rooms.get(streamId);
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
      for (const transport of peer.transports) {
        try {
          // Close producers associated with this transport
          const producers = transport.producers;
          for (const producer of producers) {
            try {
              producer.close();
            } catch (e) {
              logger.error(`[StreamHandler] Error closing producer: ${e.message}`);
            }
          }
          
          // Close the transport
          transport.close();
        } catch (e) {
          logger.error(`[StreamHandler] Error closing transport: ${e.message}`);
        }
      }
      
      // Remove peer from room
      room.peers.delete(socket.id);
    }
    
    // 5. If this was the last broadcaster, mark stream as interrupted
    const hasOtherBroadcasters = Array.from(room.peers.values())
      .some(p => p.role === "broadcaster" && p.socket.id !== socket.id);
    
    if (!hasOtherBroadcasters) {
      logger.info(`[StreamHandler] No remaining broadcasters for ${streamId}, marking as INTERRUPTED`);
      await updateDatabaseStreamState(streamId, "INTERRUPTED", userId);
      
      // Optionally close the entire room if no viewers either
      if (room.peers.size === 0) {
        cleanupRoom(streamId);
      }
    }
  } catch (error) {
    logger.error(`[StreamHandler] Error handling broadcaster disconnection`, {
      error: error.message,
      stack: error.stack,
      streamId,
      userId
    });
    
    // Ensure stream is marked as interrupted even if cleanup fails
    await updateDatabaseStreamState(streamId, "INTERRUPTED", userId);
  }
}

// Helper function to clean up an entire room
function cleanupRoom(streamId: string) {
  const room = rooms.get(streamId);
  if (!room) return;
  
  try {
    // Close all peers' transports
    for (const peer of room.peers.values()) {
      for (const transport of peer.transports) {
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
      error: error.message,
      stack: error.stack
    });
  }
}
```

### 2. Database Status Updates

When a broadcaster disconnects unexpectedly, the stream status is updated to `INTERRUPTED`:

```typescript
// In socketHandler.ts -> handleBroadcasterDisconnection
await updateDatabaseStreamState(streamId, "INTERRUPTED", userId);
```

The `INTERRUPTED` state indicates that the stream ended abnormally due to connection issues, rather than being properly ended by the user.

## Viewer Handling

When a stream is interrupted due to broadcaster disconnection, viewers need to be notified and their connections handled:

### 1. Notification to Viewers

```typescript
// This happens automatically in updateDatabaseStreamState() when state is set to INTERRUPTED
httpServer.io.to(`stream:${streamId}`).emit('stream_ended', {
  streamId,
  status: "INTERRUPTED",
  reason: "interrupted",
  userId
});
```

### 2. Frontend Handling

The frontend client handles the `stream_ended` event to display appropriate messages to viewers:

```typescript
// In useWebRTC.ts hook or similar
socket.on("stream_ended", (data) => {
  if (data.status === "INTERRUPTED") {
    // Show appropriate UI for interrupted stream
    setConnectionStatus("interrupted");
    setErrorMessage("The broadcast was interrupted due to connection issues.");
    
    // Attempt reconnection if configured
    if (config.autoReconnect && !isStreamer) {
      startReconnectionAttempts();
    }
  }
});

// Reconnection logic
function startReconnectionAttempts() {
  let attempts = 0;
  const maxAttempts = 5;
  const reconnectInterval = setInterval(() => {
    if (attempts >= maxAttempts) {
      clearInterval(reconnectInterval);
      setConnectionStatus("failed");
      setErrorMessage("Could not reconnect to the stream after multiple attempts.");
      return;
    }
    
    attempts++;
    checkStreamStatus();
  }, 5000);
  
  // Check if stream comes back online
  async function checkStreamStatus() {
    try {
      const response = await fetch(`/api/live-streams/${streamId}/status`);
      const data = await response.json();
      
      if (data.status === "LIVE") {
        clearInterval(reconnectInterval);
        reconnectToStream();
      }
    } catch (error) {
      console.error("Failed to check stream status:", error);
    }
  }
}
```

### 3. WebRTC Consumer Cleanup

Viewers' WebRTC connections need to be cleaned up when a stream is interrupted:

```typescript
// In socketHandler.ts
// When stream state changes to INTERRUPTED, notify all viewers
socket.to(`stream:${streamId}:viewers`).emit("stream_interrupted", {
  streamId,
  reason: "broadcaster_disconnected"
});

// Handle viewer-side cleanup
socket.on("stream_interrupted", async (data) => {
  // Close and clean up all consumers
  if (consumersRef.current) {
    for (const consumer of consumersRef.current) {
      consumer.close();
    }
    consumersRef.current = [];
  }
  
  // Close transport if exists
  if (transportRef.current) {
    transportRef.current.close();
    transportRef.current = null;
  }
  
  // Update UI
  setConnectionStatus("interrupted");
});
```

## Reconnection Handling

### 1. Broadcaster Reconnection

If a broadcaster reconnects after a disconnection, they go through the normal stream start process, but with special handling for INTERRUPTED streams:

```typescript
// In socketHandler.ts -> socket.on("broadcaster_ready")
const { isValid, actualState } = await validateStreamState(data.streamId);

// Special handling for reconnection to interrupted streams
if (actualState === "INTERRUPTED") {
  logger.info(`[StreamHandler] Broadcaster reconnecting to interrupted stream ${data.streamId}`);
  
  // Update state to STARTING to begin reconnection process
  await updateDatabaseStreamState(data.streamId, "STARTING", data.userId);
  
  // Continue with normal startup process
  // If successful, state will transition to LIVE
}
```

### 2. Viewer Reconnection

Viewers can also attempt to reconnect to a stream that was previously interrupted:

```typescript
async function reconnectToStream() {
  // Reset connection state
  setConnectionStatus("connecting");
  setErrorMessage(null);
  
  // Re-initialize WebRTC connection
  await initializeConnection();
  
  // Request current stream status
  socket.emit("get_stream_status", { streamId });
}
```

## Database Handling for Interrupted Streams

Streams that remain in the `INTERRUPTED` state for an extended period may need to be automatically finalized:

```typescript
// In a scheduled task (e.g., cron job)
async function finalizeStaleInterruptedStreams() {
  const prisma = new PrismaClient();
  
  // Find streams that have been interrupted for more than 15 minutes
  const cutoffTime = new Date(Date.now() - 15 * 60 * 1000);
  
  const staleStreams = await prisma.liveStream.findMany({
    where: {
      status: "INTERRUPTED",
      updatedAt: {
        lt: cutoffTime
      }
    }
  });
  
  for (const stream of staleStreams) {
    logger.info(`[StreamMaintenance] Finalizing stale interrupted stream ${stream.id}`);
    
    // Update to ENDED state
    await prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: "ENDED",
        endTime: new Date()
      }
    });
  }
  
  prisma.$disconnect();
}
```

## Client-Side Heartbeat Implementation

For the client side, heartbeat signals should be implemented to maintain the connection:

```typescript
// In useWebRTC.ts or similar hook
useEffect(() => {
  if (!socket || !isStreamer) return;
  
  // Send heartbeat every 10 seconds
  const heartbeatInterval = setInterval(() => {
    socket.emit("heartbeat");
  }, 10000);
  
  return () => clearInterval(heartbeatInterval);
}, [socket, isStreamer]);
```

## Conclusion

This graceful disconnection handling system ensures that:

1. Unexpected broadcaster disconnections are reliably detected through both disconnect events and heartbeats
2. MediaSoup resources are properly cleaned up to prevent memory leaks
3. The database accurately reflects the stream state as `INTERRUPTED`
4. Viewers are properly notified and their connections are managed
5. Reconnection paths are provided for both broadcasters and viewers
6. Stale interrupted streams are eventually finalized to maintain database cleanliness 