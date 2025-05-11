# BidPazar Stream State Flow

## Stream State Transition Diagram

```
┌─────────────┐                                       
│             │                                       
│  SCHEDULED  │◄────────── [API: Create Stream]       
│             │            Responsible: API Layer     
└──────┬──────┘                                       
       │                                              
       │ [API: /start]                                
       │ Responsible: API Layer                       
       ▼                                              
┌─────────────┐                                       
│             │                                       
│  STARTING   │                                       
│             │                                       
└──────┬──────┘                                       
       │                                              
       ├─────── [WebRTC: Setup Success]               
       │         Responsible: socketHandler           
       ▼                                              
┌─────────────┐                                       
│             │                                       
│    LIVE     │                                       
│             │                                       
└──────┬──────┘                                       
       │                                              
       ├─────── [WebRTC: Setup Failure]               
       │         Responsible: socketHandler           
       ▼                                              
┌─────────────┐                                       
│             │                                       
│ FAILED_TO_  │                                       
│   START     │                                       
│             │                                       
└─────────────┘                                       
                                                      
┌─────────────┐                                       
│             │                  ┌─────────────┐      
│    LIVE     │─────────────────►│             │      
│             │ [API: /pause]    │   PAUSED    │      
└──────┬──────┘ Resp: API Layer  │             │      
       │                         └──────┬──────┘      
       │                                │             
       │                                │             
       │                                │             
       │                         [API: /resume]       
       │                         Resp: API Layer      
       │                                │             
       │                                ▼             
       │                         ┌─────────────┐      
       │                         │             │      
       │                         │    LIVE     │      
       │                         │             │      
       │                         └─────────────┘      
       │                                              
       │ [API: /end]                                  
       │ Responsible: API Layer                       
       ▼                                              
┌─────────────┐                                       
│             │                                       
│   ENDING    │                                       
│             │                                       
└──────┬──────┘                                       
       │                                              
       ├─────── [WebRTC: Cleanup Success]             
       │         Responsible: socketHandler           
       ▼                                              
┌─────────────┐                                       
│             │                                       
│    ENDED    │                                       
│             │                                       
└─────────────┘                                       
                                                      
┌─────────────┐                                       
│             │                                       
│    LIVE     │                                       
│             │                                       
└──────┬──────┘                                       
       │                                              
       ├─────── [WebRTC: Connection Lost]             
       │         Responsible: socketHandler           
       ▼                                              
┌─────────────┐                                       
│             │                                       
│ INTERRUPTED │                                       
│             │                                       
└─────────────┘                                       
                                                      
┌─────────────┐                                       
│             │                                       
│  SCHEDULED  │                                       
│             │                                       
└──────┬──────┘                                       
       │                                              
       ├─────── [API: /cancel]                        
       │         Responsible: API Layer               
       ▼                                              
┌─────────────┐                                       
│             │                                       
│  CANCELLED  │                                       
│             │                                       
└─────────────┘                                       
```

## Stream State Definitions

| State           | Description                                            | Initiated By                   | Responsible Component         |
|-----------------|--------------------------------------------------------|--------------------------------|-------------------------------|
| SCHEDULED       | Stream created but not yet started                     | User creates stream            | API Layer                     |
| STARTING        | Stream is initializing WebRTC                          | User clicks "Start Stream"     | API Layer                     |
| LIVE            | Stream is actively broadcasting                        | WebRTC setup completes         | WebRTC Layer (socketHandler)  |
| PAUSED          | Stream temporarily paused                              | User clicks "Pause"            | API Layer                     |
| ENDING          | Stream is in the process of shutting down              | User clicks "End Stream"       | API Layer                     |
| ENDED           | Stream has concluded normally                          | WebRTC cleanup completes       | WebRTC Layer (socketHandler)  |
| CANCELLED       | Scheduled stream cancelled before starting             | User cancels                   | API Layer                     |
| FAILED_TO_START | Stream failed during initialization                    | WebRTC setup fails             | WebRTC Layer (socketHandler)  |
| INTERRUPTED     | Stream unexpectedly disconnected                       | Connection lost                | WebRTC Layer (socketHandler)  |

## State Validation and Update Mechanisms

### `validateStreamState` Function Analysis

The `validateStreamState` function in `socketEvents.ts` serves as a critical safety check to ensure operations only proceed when the stream is in an expected state. 

**Purpose:**
- Prevents race conditions in concurrent WebRTC operations
- Ensures operations (like starting a stream) only happen when the stream is in a valid state
- Acts as a guard rail against invalid state transitions

**Usage Pattern:**
```typescript
// Before performing any WebRTC operation that depends on stream state
const { isValid, actualState } = await validateStreamState(streamId, "EXPECTED_STATE");
if (!isValid) {
  // Handle invalid state (e.g., notify client, log error)
  socket.emit("error", { 
    message: `Cannot perform operation. Stream is in ${actualState} state, expected ${expectedState}`,
    code: "INVALID_STATE" 
  });
  return;
}

// Proceed with operation only if valid state
```

**When Called:**
1. Before creating WebRTC room (requires STARTING state)
2. Before creating producer/consumer (requires LIVE state)
3. Before ending stream (requires LIVE or PAUSED state)
4. Before resuming stream (requires PAUSED state)

**Handling Discrepancies:**
- Socket events emit errors to clients with detailed messages
- Prevent invalid state transitions
- Log errors for debugging
- Return early from socket handlers to prevent further execution

### `updateDatabaseStreamState` Function Analysis

The `updateDatabaseStreamState` function in `socketEvents.ts` is the single source of truth for updating stream states in the database. It ensures consistent state transitions and appropriate timestamp updates.

**Key Implementation Features:**
1. Direct database updates via Prisma (not through API routes)
2. Appropriate timestamps set based on state
3. WebSocket notifications to all connected clients

**Current Implementation Issues:**
1. Incomplete switch statement for all possible states
2. Potential for circular dependencies if API calls are made within this function
3. Inconsistent endpoint references compared to the API definitions

**Recommended Implementation:**

```typescript
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
        // No timestamp changes needed
        break;
      case "STARTING":
        // No timestamp changes yet - startTime is set only when fully LIVE
        break;
      case "LIVE":
        // Only set startTime if transitioning to LIVE for the first time
        const currentStream = await prisma.liveStream.findUnique({
          where: { id: streamId },
          select: { startTime: true }
        });
        if (!currentStream?.startTime) {
          updateData.startTime = new Date();
        }
        break;
      case "PAUSED":
        // Optionally track pauseTime in a separate field if needed
        break;
      case "ENDING":
        // No timestamp changes yet - endTime is set only when fully ENDED
        break;
      case "ENDED":
      case "CANCELLED":
      case "FAILED_TO_START":
      case "INTERRUPTED":
        updateData.endTime = new Date();
        break;
      default:
        logger.warn(`[StreamSync] Unhandled stream state: ${state}`);
    }
    
    // Use Prisma directly to avoid circular dependencies through API
    const prisma = new PrismaClient();
    await prisma.liveStream.update({
      where: { id: streamId },
      data: updateData
    });
    
    // Emit WebSocket notification about the state change
    const httpServer = global.server as ExtendedHttpServer;
    if (httpServer?.io) {
      httpServer.io.to(`stream:${streamId}`).emit('stream_state_changed', {
        streamId,
        status: state,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`[StreamSync] Updated stream ${streamId} state to ${state}`);
    return true;
  } catch (error) {
    logger.error(`[StreamSync] Failed to update database for stream ${streamId}`, { 
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}
```

## Bidirectional Communication Flow

The BidPazar streaming system implements bidirectional state synchronization through a clear division of responsibilities:

1. **API Layer** - Initiates state transitions as user-facing intents:
   - Creates streams (SCHEDULED)
   - Begins stream processes (SCHEDULED → STARTING)
   - Pauses streams (LIVE → PAUSED)
   - Resumes streams (PAUSED → LIVE)
   - Starts ending streams (LIVE → ENDING)
   - Cancels scheduled streams (SCHEDULED → CANCELLED)

2. **WebRTC Layer** - Confirms technical success/failure:
   - Completes stream start (STARTING → LIVE)
   - Reports stream start failures (STARTING → FAILED_TO_START)
   - Detects connection problems (LIVE → INTERRUPTED)
   - Completes stream end (ENDING → ENDED)

3. **Socket Events** - Bridge between components:
   - Notify clients of state changes
   - Validate states before operations
   - Update database with definitive states

This design prevents circular dependencies by:
1. Having API layer initiate "intent" states (STARTING, ENDING)
2. Having WebRTC layer confirm "result" states (LIVE, FAILED_TO_START, ENDED)
3. Using direct Prisma calls in `updateDatabaseStreamState` instead of API routes

## Implementation Guidelines

To maintain this clean architecture:

1. API routes should:
   - Update database to intermediate states (STARTING, ENDING)
   - Emit socket events to trigger WebRTC transitions
   - Never directly set final states like LIVE or ENDED

2. Socket handlers should:
   - Validate states before operations using `validateStreamState`
   - Use `updateDatabaseStreamState` for all database updates
   - Complete transitions to final states (LIVE, ENDED)

3. Both layers should:
   - Log clear messages about state transitions
   - Provide meaningful errors to clients
   - Handle edge cases and recover from unexpected states when possible 