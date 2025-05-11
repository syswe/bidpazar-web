# BidPazar Live Streaming Architecture

## Overview

BidPazar's live streaming system integrates a frontend React/Next.js interface with a WebRTC backend powered by MediaSoup. The architecture consists of several interconnected layers:

1. **Database Layer**: Prisma schema for stream metadata storage
2. **API Layer**: Next.js API routes for CRUD operations
3. **WebRTC Layer**: MediaSoup-based WebSocket server for real-time media streaming
4. **UI Layer**: React components for stream creation, device selection, and viewing

```
┌─────────────────┐      ┌───────────────────┐      ┌────────────────────┐
│                 │      │                   │      │                    │
│  React/Next.js  │◄────►│  Next.js API      │◄────►│  PostgreSQL DB     │
│  Frontend       │      │  Routes           │      │  (via Prisma)      │
│                 │      │                   │      │                    │
└────────┬────────┘      └───────────────────┘      └────────────────────┘
         │                                          
         │                                          
         ▼                                          
┌─────────────────┐      ┌───────────────────┐      
│                 │      │                   │      
│  WebSocket      │◄────►│  MediaSoup        │      
│  Connection     │      │  WebRTC Engine    │      
│                 │      │                   │      
└─────────────────┘      └───────────────────┘      
```

## Stream Creation Flow

### 1. Initial Stream Setup (Database)

**Files involved:**
- `src/app/streams/new/page.tsx` - UI for creating a new stream
- `src/app/api/live-streams/route.ts` - API endpoint for creating streams

**Process:**
1. User fills out the form with stream title, description, etc.
2. Form submits data to `/api/live-streams` endpoint
3. API creates a new stream entry in the database with `SCHEDULED` status
4. Returns stream ID and metadata to the frontend

```
┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│              │     │               │     │             │
│  User Form   │────►│  API Endpoint │────►│  Database   │
│              │     │               │     │             │
└──────────────┘     └───────────────┘     └─────────────┘
        ▲                                         │
        │                                         │
        └─────────────────────────────────────────┘
                     Stream Data
```

### 2. Broadcaster Interface Setup

**Files involved:**
- `src/app/streams/[id]/broadcast/page.tsx` - Broadcaster UI
- `src/components/stream/WebRTCStreamManager.tsx` - Core streaming component
- `src/hooks/useDevices.ts` - Hook for device enumeration
- `src/hooks/useWebRTC.ts` - Hook for WebRTC functionality

**Process:**
1. User navigates to `/streams/{id}/broadcast`
2. `WebRTCStreamManager` initializes and loads available devices
3. `useDevices` hook enumerates available cameras and microphones
4. Device selection UI is displayed to the user

```
┌────────────────┐     ┌─────────────────────┐     ┌───────────────┐
│                │     │                     │     │               │
│  Broadcast UI  │────►│  WebRTCStreamManager│────►│  useDevices   │
│                │     │                     │     │               │
└────────────────┘     └─────────────────────┘     └───────────────┘
                                │                          │
                                │                          │
                                ▼                          ▼
                        ┌─────────────────┐      ┌──────────────────┐
                        │                 │      │                  │
                        │   useWebRTC     │      │  Device List UI  │
                        │                 │      │                  │
                        └─────────────────┘      └──────────────────┘
```

### 3. WebSocket Connection Establishment

**Files involved:**
- `src/hooks/useWebRTC.ts` - WebRTC connection logic
- `src/lib/socket/socketHandler.ts` - Server-side socket handling
- `src/app/api/socket/route.ts` - WebSocket API route

**Process:**
1. When user navigates to broadcast page, a WebSocket connection is initiated
2. Connection includes parameters: `streamId`, `userId`, `isStreamer=true`
3. `socketHandler.ts` processes the connection and assigns the user to the appropriate room
4. A bidirectional channel is established for WebRTC signaling

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│              │     │                │     │                 │
│  useWebRTC   │────►│  WebSocket API │────►│  socketHandler  │
│              │     │                │     │                 │
└──────────────┘     └────────────────┘     └─────────────────┘
        │                                           │
        │                                           │
        └───────────────────────────────────────────┘
                    WebRTC Signaling
```

### 4. Starting the Stream

**Files involved:**
- `src/components/stream/BroadcastControls.tsx` - UI controls for broadcasting
- `src/app/api/live-streams/[id]/start/route.ts` - API to start a stream
- `src/lib/socket/socketHandler.ts` - Handles WebRTC connections
- `src/lib/socket/socketEvents.ts` - State synchronization

**Process:**
1. User selects devices and clicks "Start Stream" button
2. A clear authoritative flow is established:
   - API request to `/api/live-streams/{id}/start` updates database status to `STARTING` (not directly to `LIVE`)
   - API emits a `stream_starting` socket event to trigger WebRTC setup
   - Socket handler detects stream in `STARTING` state and begins WebRTC setup
   - Upon successful WebRTC setup, `socketEvents.ts` updates database to `LIVE` and records `startTime`
   - If WebRTC setup fails, state is updated to `FAILED_TO_START`
3. MediaSoup creates a room and initializes WebRTC transport
4. On success, the stream begins broadcasting to viewers

```
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│              │     │               │     │                │
│  Start       │────►│  API /start   │────►│  Database      │
│  Button      │     │  (STARTING)   │     │  Update        │
│              │     └───────┬───────┘     └────────────────┘
└──────────────┘             │                     │
                             │                     │
                             ▼                     │
                     ┌───────────────┐             │
                     │               │             │
                     │ stream_starting│             │
                     │  Socket Event  │             │
                     └───────┬───────┘             │
                             │                     │
                             ▼                     │
┌──────────────┐     ┌───────────────┐     ┌───────▼────────┐
│              │     │               │     │                │
│  useWebRTC   │────►│  Socket Event │────►│  MediaSoup     │
│              │     │  broadcaster  │     │  Room Creation │
└──────────────┘     │  _ready       │     │                │
                     └───────┬───────┘     └───────┬────────┘
                             │                     │
                             │                     │
                             ▼                     ▼
                     ┌───────────────┐     ┌────────────────┐
                     │               │     │                │
                     │ socketEvents  │────►│  Database      │
                     │ (LIVE or      │     │  Update with   │
                     │ FAILED_TO_START)    │  startTime     │
                     └───────────────┘     └────────────────┘
```

## Technical Deep Dive

### Database Schema (Prisma)

**File:** `prisma/schema.prisma`

The `LiveStream` model defines the structure for stream metadata:

```prisma
model LiveStream {
  id            String           @id @default(cuid())
  title         String
  description   String?
  thumbnailUrl  String?
  status        String          @default("SCHEDULED") // Values: SCHEDULED, STARTING, LIVE, PAUSED, ENDING, ENDED, CANCELLED, FAILED_TO_START, INTERRUPTED
  startTime     DateTime?
  endTime       DateTime?
  userId        String
  user          User             @relation("HostedStreams", fields: [userId], references: [id])
  viewers       User[]           @relation("StreamViewers")
  viewerCount   Int              @default(0)
  listings      AuctionListing[]
  chatMessages  ChatMessage[]
  // ...other fields
}
```

### API Layer

#### Stream Creation API

**File:** `src/app/api/live-streams/route.ts`

Creates a new stream entry in the database:

```typescript
export async function POST(request: NextRequest) {
  // Authentication check
  // Parse request body
  // Create stream with SCHEDULED status
  const stream = await prisma.liveStream.create({
    data: {
      title, 
      description,
      userId,
      status: "SCHEDULED"
    }
  });
  return NextResponse.json(stream);
}
```

#### Stream Start API

**File:** `src/app/api/live-streams/[id]/start/route.ts`

Updates stream status to STARTING and notifies WebSocket clients (actual transition to LIVE happens after WebRTC setup completes):

```typescript
export async function POST(request: NextRequest, { params }) {
  // Authentication check
  // Verify stream exists
  // Update status to STARTING (not LIVE yet)
  const updatedStream = await prisma.liveStream.update({
    where: { id },
    data: {
      status: 'STARTING'
      // startTime is set only when status becomes LIVE by socketEvents.ts
    }
  });
  
  // Notify WebSocket clients
  // @ts-ignore
  const httpServer = global.server as ExtendedHttpServer;
  if (httpServer?.io) {
    // Emit event that stream is in STARTING state
    httpServer.io.to(`stream:${id}`).emit('stream_state_changed', {
      streamId: id,
      status: 'STARTING'
    });
    
    // Also trigger a specific event that will be handled by socketHandler to initiate WebRTC setup
    httpServer.io.to(`stream:${id}`).emit('stream_starting', {
      streamId: id,
      userId: updatedStream.userId
    });
  }
  
  return NextResponse.json(updatedStream);
}
```

### WebRTC Layer

#### Socket Handler

**File:** `src/lib/socket/socketHandler.ts`

The core of WebRTC functionality, responsible for:
1. MediaSoup worker initialization
2. WebRTC room creation and management
3. WebRTC transport establishment
4. Signaling between broadcasters and viewers
5. Confirming stream state transitions based on WebRTC setup success/failure

Key functions:

```typescript
// Initialize MediaSoup worker
async function startMediasoupWorker()

// Create a room or get existing one with locking mechanism
async function getOrCreateRoom(streamId: string, userId?: string): Promise<Room>

// Handle stream starting event
socket.on("stream_starting", async (data) => {
  // Get stream info
  // Prepare resources for the upcoming broadcast
})

// Handle broadcaster connections
socket.on("broadcaster_ready", async (data) => {
  try {
    // Validate stream is in STARTING state
    const { isValid, actualState } = await validateStreamState(data.streamId, "STARTING");
    if (!isValid) {
      socket.emit("broadcaster_error", { 
        message: `Stream must be in STARTING state to begin broadcasting (current: ${actualState})`,
        code: "INVALID_STATE"
      });
      return;
    }
    
    logger.info(`[StreamHandler] Beginning WebRTC setup for stream ${data.streamId}`, { userId: data.userId });
    
    // Lock creation to prevent race conditions
    const room = await getOrCreateRoom(data.streamId, data.userId);
    
    // Setup WebRTC transport with appropriate ICE configuration
    const rtpCapabilities = data.rtpCapabilities;
    if (!rtpCapabilities) {
      throw new Error("Missing RTP capabilities");
    }
    
    // Create WebRTC producer transport
    const transportOptions = getAppropriateIceConfiguration(socket);
    const transport = await room.router.createWebRtcTransport(transportOptions);
    
    // Store the transport in room for this producer
    room.peers.set(socket.id, {
      socket,
      userId: data.userId,
      role: "broadcaster",
      transports: [transport]
    });
    
    // Send transport parameters to the client
    socket.emit("producer_transport_created", {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
    
    // When all WebRTC setup is complete and successful, update stream to LIVE
    await updateDatabaseStreamState(data.streamId, "LIVE", data.userId);
    
    logger.info(`[StreamHandler] Stream ${data.streamId} is now LIVE`, { userId: data.userId });
  } catch (error) {
    // Log detailed error
    logger.error(`[StreamHandler] Failed to set up WebRTC for stream ${data.streamId}`, {
      userId: data.userId,
      error: error.message,
      stack: error.stack
    });
    
    // Mark stream as FAILED_TO_START
    await updateDatabaseStreamState(data.streamId, "FAILED_TO_START", data.userId);
    
    // Notify client of failure with appropriate details
    socket.emit("broadcaster_error", {
      message: `Failed to start stream: ${error.message}`,
      code: "SETUP_FAILED",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
})
```

#### WebRTC State Synchronization

**File:** `src/lib/socket/socketEvents.ts`

Ensures database and WebRTC state remain synchronized, acting as the central point for stream state management:

```typescript
// Update database when WebRTC state changes - this is the ONLY place that directly updates the database for stream states
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
      case "LIVE":
        updateData.startTime = new Date();
        break;
      case "ENDED":
      case "INTERRUPTED":
      case "CANCELLED":
        updateData.endTime = new Date();
        break;
      // Handle other states as needed
    }
    
    // Update database directly - no API calls to avoid circular dependencies
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
        status: state
      });
    }
    
    return true;
  } catch (error) {
    logger.error(`[StreamSync] Failed to update database for stream ${streamId}`);
    return false;
  }
}

// Validate stream state between WebRTC and database
// This function is critical for preventing race conditions and ensuring state consistency
export async function validateStreamState(
  streamId: string, 
  expectedState?: StreamState
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
    
    if (!stream) {
      return { isValid: false, error: "Stream not found" };
    }
    
    const actualState = stream.status as StreamState;
    
    // If no expected state provided, just return actual state
    if (!expectedState) {
      return { isValid: true, actualState };
    }
    
    // Check if state matches expected
    return { 
      isValid: actualState === expectedState,
      actualState
    };
  } catch (error) {
    logger.error(`[StreamSync] Failed to validate stream state for ${streamId}`);
    return { isValid: false, error: error.message };
  }
}
```

### Frontend Components

#### Stream Manager

**File:** `src/components/stream/WebRTCStreamManager.tsx`

The primary component that orchestrates the streaming process:

```tsx
const WebRTCStreamManager = ({ streamId, userId, isStreamer }) => {
  // Initialize devices
  const { videoDevices, audioDevices, selectedVideo, selectedAudio } = useDevices();
  
  // Initialize WebRTC connection
  const { 
    connect, 
    startStreaming, 
    localStream,
    connectionState
  } = useWebRTC({ streamId, userId, isStreamer });
  
  // Device selection and streaming UI
  // ...
}
```

#### Device Selection

**File:** `src/hooks/useDevices.ts`

Handles device enumeration and selection:

```typescript
export function useDevices() {
  // State for available devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  
  // Enumerate available devices
  const enumerateDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // Filter and set video/audio devices
  };
  
  // Select devices and get stream
  const getMediaStream = async (videoDeviceId, audioDeviceId) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoDeviceId ? { deviceId: videoDeviceId } : true,
      audio: audioDeviceId ? { deviceId: audioDeviceId } : true
    });
    return stream;
  };
  
  // ...
}
```

## Complete API Structure

### Main API Routes

The BidPazar streaming API is organized as follows:

1. **Base Stream Operations**
   - `GET /api/live-streams` - List all streams with optional filters (status, userId)
   - `POST /api/live-streams` - Create a new stream
   - `PUT /api/live-streams` - Update stream information

2. **Stream-Specific Operations**
   - `GET /api/live-streams/[id]` - Get stream details including relations (user, listings, chat)
   - `PUT /api/live-streams/[id]` - Update a specific stream
   - `DELETE /api/live-streams/[id]` - Delete a stream

3. **Stream State Management**
   - `POST /api/live-streams/[id]/start` - Start a stream
   - `POST /api/live-streams/[id]/pause` - Pause a stream
   - `POST /api/live-streams/[id]/end` - End a stream
   - `GET /api/live-streams/[id]/status` - Get current stream status

4. **Stream Content Management**
   - `POST /api/live-streams/[id]/chat` - Send chat message
   - `GET /api/live-streams/[id]/chat` - Get chat history
   - `POST /api/live-streams/[id]/create-listing` - Create auction listing in stream
   - `GET /api/live-streams/[id]/listings` - Get all listings in a stream

5. **Analytics and Moderation**
   - `GET /api/live-streams/[id]/viewers` - Get viewer count and list
   - `GET /api/live-streams/[id]/analytics` - Get stream analytics
   - `POST /api/live-streams/[id]/moderation` - Moderate stream content

### WebSocket Connection

The WebSocket connection is established through:

**File:** `src/app/api/socket/route.ts`

This route serves as a fallback endpoint for Socket.IO connections, particularly for HTTP long-polling when WebSocket fails:

```typescript
export async function GET(request: NextRequest) {
  logger.info("Socket.IO API route accessed", {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  // Return information about the Socket.IO endpoint
  return NextResponse.json({
    message: "Socket.IO API route - WebSocket connections should be handled by the custom server",
    info: "This route exists to prevent 404 errors for Socket.IO HTTP polling fallbacks",
    success: true,
    timestamp: new Date().toISOString(),
  });
}
```

### MediaSoup Room Management

**File:** `src/lib/socket/socketHandler.ts`

The system implements a locking mechanism to prevent race conditions when creating MediaSoup rooms:

```typescript
async function getOrCreateRoom(streamId: string, userId?: string): Promise<Room> {
  // Check if room already exists
  if (rooms.has(streamId)) {
    return rooms.get(streamId)!;
  }

  // Prevent race conditions with a lock mechanism
  // Create a MediaSoup router
  const router = await mediasoupWorker.createRouter({
    mediaCodecs: mediasoupAppConfig.router.mediaCodecs,
  });

  // Create a new room
  const room: Room = {
    router,
    peers: new Map(),
    activeSessions: new Map(),
  };

  rooms.set(streamId, room);
  return room;
}
```

### Stream State Synchronization Logic

**File:** `src/lib/socket/socketEvents.ts`

The system implements bidirectional synchronization between the database and WebRTC states:

```typescript
export async function updateDatabaseStreamState(
  streamId: string, 
  state: StreamState,
  userId?: string
): Promise<boolean> {
  try {
    // Direct database update via Prisma - no API calls to avoid circular dependencies
    const updateData: Record<string, any> = { status: state };
    
    // Add appropriate timestamps based on state
    switch (state) {
      case "LIVE":
        updateData.startTime = new Date();
        break;
      case "ENDED":
      case "INTERRUPTED":
      case "CANCELLED":
        updateData.endTime = new Date();
        break;
      // Handle other states appropriately
    }
    
    // Use Prisma directly for database updates
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
    
    // Log the state change
    logger.info(`[StreamSync] Updated stream ${streamId} state to ${state}`);
    
    return true;
  } catch (error) {
    logger.error(`[StreamSync] Failed to update database for stream ${streamId}`, { error });
    return false;
  }
}
```

## Complete User Flow

1. **Create Stream**
   - User creates a stream via UI form
   - Database entry created with `SCHEDULED` status

2. **Prepare to Broadcast**
   - User navigates to broadcast page
   - Device enumeration happens
   - User selects camera/microphone
   - Preview displayed

3. **Start Broadcasting**
   - User clicks "Start Stream"
   - API updates database status to `LIVE`
   - WebSocket connection initializes:
     - Request RTP capabilities
     - Create producer transport
     - Connect transport
     - Start producing audio/video

4. **Broadcasting**
   - Broadcaster sends media streams through WebRTC
   - Viewers connect and consume the stream
   - Real-time chat happens over WebSocket

5. **End Stream**
   - User clicks "End Stream"
   - API updates database status to `ENDED`
   - WebSocket connections notify all clients
   - WebRTC resources are cleaned up

## WebRTC Technical Process

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        BROADCASTER                          │
│                                                             │
│  ┌───────────┐     ┌─────────────┐     ┌───────────────┐   │
│  │           │     │             │     │               │   │
│  │  Camera   │────►│  Producer   │────►│  WebRTC       │   │
│  │  Mic      │     │  Transport  │     │  Transport    │   │
│  │           │     │             │     │               │   │
│  └───────────┘     └─────────────┘     └───────┬───────┘   │
│                                                 │           │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │                 │
                                         │    MediaSoup    │
                                         │    Router       │
                                         │                 │
                                         └────────┬────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────┼───────────┐
│                                                 │           │
│                         VIEWER                  │           │
│                                                 │           │
│  ┌───────────┐     ┌─────────────┐     ┌───────▼───────┐   │
│  │           │     │             │     │               │   │
│  │  Video    │◄────┤  Consumer   │◄────┤  WebRTC       │   │
│  │  Audio    │     │  Transport  │     │  Transport    │   │
│  │           │     │             │     │               │   │
│  └───────────┘     └─────────────┘     └───────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## System State Synchronization

To ensure database state and WebRTC state remain synchronized:

1. **Room Creation Lock**: Prevents multiple room creation attempts
2. **Database Validation**: Checks stream state before WebRTC operations via `validateStreamState()`
3. **Event Emission**: Logs and tracks state changes
4. **Single Source of Truth with Clear Authority Flow**:
   - Database is the single source of truth for stream state
   - API endpoints initiate state transition "intents" (e.g., SCHEDULED → STARTING)
   - WebRTC layer confirms operational success/failure and finalizes states (e.g., STARTING → LIVE or FAILED_TO_START)
   - All state updates occur through `updateDatabaseStreamState()` which directly updates the database
   - Eliminates circular dependencies by avoiding API calls within the WebRTC layer
5. **Intermediate States**: Uses states like STARTING and ENDING to reflect ongoing transitions
6. **Graceful Disconnection Handling**: Timeout for unexpected disconnects, moving streams to INTERRUPTED state

## Connection Handling

The system implements special handling for different connection types:

```typescript
// Function to determine appropriate ICE servers based on connection type
const getAppropriateIceConfiguration = (
  socket: Socket
): MediasoupTypes.WebRtcTransportOptions => {
  const baseConfig = { ...mediasoupAppConfig.webRtcTransport };

  // Check if this is a loopback connection
  const clientIp =
    socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  const host = socket.handshake.headers.host;
  const isLoopback =
    socket.data?.isLoopback ||
    isLoopbackAddress(clientIp as string) ||
    isLoopbackAddress(host?.split(":")[0]);

  // For loopback connections, adjust the configuration to be more reliable
  if (isLoopback) {
    return {
      ...baseConfig,
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: false, // On loopback, TCP can be more reliable
    };
  }

  // Regular configuration for non-loopback connections
  return {
    ...baseConfig,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  };
};
```

## Conclusion

The BidPazar live streaming architecture implements a sophisticated WebRTC system with MediaSoup, ensuring robust real-time video streaming with proper state management between the database and WebRTC layers. The modular design separates concerns between the UI, API, and WebRTC components while maintaining state synchronization through event hooks and validation checks. 

The comprehensive API structure provides endpoints for all necessary stream operations, including state management, content creation, and analytics. The WebSocket layer using Socket.IO provides real-time communication for both signaling and chat, while the MediaSoup integration handles the actual WebRTC media streaming with proper room management and peer connections. 

## Frontend Implementation

### Stream Pages Structure

The frontend implementation is organized in the `src/app/(streams)/live-streams` directory with the following structure:

```
/live-streams
├── page.tsx                  # Main streams listing page
└── [id]/                     # Dynamic stream page by ID
    ├── page.tsx              # Individual stream view
    ├── components/           # Stream UI components
    │   ├── DeviceSelector.tsx         # Camera/mic selection UI 
    │   ├── StreamChat.tsx             # Chat functionality
    │   ├── StreamControls.tsx         # Stream control buttons
    │   ├── WebRTCStreamManager/       # Core WebRTC components
    │   │   ├── index.tsx              # Main component
    │   │   ├── types.ts               # Type definitions
    │   │   ├── components/            # Sub-components
    │   │   ├── hooks/                 # WebRTC-specific hooks
    │   │   └── utils/                 # Utility functions
    │   └── ...
    └── hooks/                # Stream-related hooks
        ├── useMedia.ts                # Media device management
        ├── useStreamControls.ts       # Stream state control
        ├── useStreamDetails.ts        # Stream metadata fetching
        └── ...
```

### Key Frontend Components

#### 1. Stream Listing (`page.tsx`)

The main page displays all active and scheduled streams:

```tsx
export default function LiveStreamsPage() {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const token = getToken();
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  
  useEffect(() => {
    const fetchLiveStreams = async () => {
      // Fetch streams from API
      const response = await fetch(`${apiUrl}/live-streams`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        next: { revalidate: 60 },
      });
      
      // Process streams data
      const data = await response.json();
      setLiveStreams(activeStreams);
    };
    
    fetchLiveStreams();
  }, [token, runtimeConfig, isConfigLoading]);
  
  // Render stream grid
}
```

#### 2. Individual Stream Page (`[id]/page.tsx`)

The stream detail page combines multiple components:

```tsx
export default function LiveStreamPage() {
  const params = useParams();
  const streamId = params.id as string;
  const { user } = useAuth();
  const userId = user?.id;
  
  // Determine if current user is the streamer
  const isCurrentUserStreamer = userId === streamDetails?.creatorId;
  
  // Media device management
  const {
    isCameraOn,
    isMicrophoneOn,
    devices,
    selectedDevices,
    stream,
    toggleCamera,
    toggleMicrophone,
    selectDevice
  } = useMedia({ 
    onMediaError: handleMediaError,
    isStreamer: isCurrentUserStreamer
  });
  
  // Stream control functions
  const { 
    handleStartStream, 
    handleEndStream 
  } = useStreamControls({
    streamId,
    token,
    isStreamer: isCurrentUserStreamer
  });
  
  // Render stream components
  return (
    <div>
      <StreamHeader />
      
      <WebRTCStreamManager
        streamId={streamId}
        userId={effectiveUserId}
        username={effectiveUsername}
        isStreamer={isCurrentUserStreamer}
      />
      
      <StreamChat streamId={streamId} />
      
      {isCurrentUserStreamer && (
        <StreamControls
          onStartStream={handleStreamStart}
          onEndStream={handleEndStream}
        />
      )}
    </div>
  );
}
```

#### 3. WebRTC Stream Manager

The core component that handles the WebRTC connection:

```tsx
export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
}) {
  // Set up MediaSoup device
  const { 
    deviceRef, 
    rtpCapabilitiesRef, 
    initializeMediasoupDevice 
  } = useMediasoupDevice();
  
  // Set up socket connection
  const { 
    socket, 
    isRecovering
  } = useSocketConnection({
    streamId,
    userId,
    username,
    isStreamer,
    deviceRef,
    rtpCapabilitiesRef,
    onDeviceInitialized: initializeMediasoupDevice
  });
  
  // Set up media handling
  const {
    localStreamRef,
    isMuted,
    isVideoHidden,
    captureLocalMedia,
    toggleMute,
    toggleVideo
  } = useMedia({
    isCameraOn,
    isMicrophoneOn,
    selectedVideoDevice,
    selectedAudioDevice,
    isStreamer
  });
  
  // Set up media transports
  const {
    transportRef,
    producersRef,
    consumersRef,
    produceLocalMedia
  } = useMediaTransports({
    socket,
    deviceRef,
    isStreamer,
    streamId,
    localStreamRef
  });
  
  // UI rendering
  return (
    <div>
      <VideoDisplay
        videoRef={videoRef}
        isStreamer={isStreamer}
        autoplayBlocked={autoplayBlocked}
        onManualPlay={handleManualPlay}
      />
      
      {isStreamer && (
        <DeviceSelector
          devices={devices}
          selectedDevices={selectedDevices}
          onDeviceChange={handleDeviceChange}
          isLoading={mediaLoading}
        />
      )}
      
      <ConnectionInfo
        status={connectionStatus}
        participantCount={participantCount}
        error={error}
      />
    </div>
  );
}
```

#### 4. Device Selector Component

Handles camera and microphone selection:

```tsx
export function DeviceSelector({
  devices,
  selectedDevices,
  onDeviceChange,
  isLoading
}) {
  // Handle device selection
  const handleVideoDeviceChange = (event) => {
    const deviceId = event.target.value;
    if (deviceId) {
      onDeviceChange("video", deviceId);
    }
  };

  const handleAudioDeviceChange = (event) => {
    const deviceId = event.target.value;
    if (deviceId) {
      onDeviceChange("audio", deviceId);
    }
  };
  
  return (
    <div>
      {/* Camera selection */}
      <select
        value={selectedDevices.videoId || ""}
        onChange={handleVideoDeviceChange}
      >
        {devices.video.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
          </option>
        ))}
      </select>
      
      {/* Microphone selection */}
      <select
        value={selectedDevices.audioId || ""}
        onChange={handleAudioDeviceChange}
      >
        {devices.audio.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${device.deviceId.substring(0, 5)}...`}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Custom Hooks

#### 1. useMedia Hook

Manages media devices and streams:

```typescript
export function useMedia({
  onMediaError,
  onMediaReady,
  initialState = {},
  isStreamer
}) {
  // Core media state
  const [state, setState] = useState({
    isCameraOn: initialCamera,
    isMicrophoneOn: initialMic,
    isLoading: true,
    error: null,
    devices: {
      video: [],
      audio: []
    },
    selectedDevices: {
      videoId: initialVideoId,
      audioId: initialAudioId
    },
    stream: null
  });
  
  // Initialize or update media stream
  const initializeMediaStream = useCallback(async (forceReinitialize = false) => {
    // Cleanup existing stream
    cleanupStream();
    
    try {
      // Get devices list
      const webrtcInit = await initializeOptimizedWebRTC();
      
      // Update device lists
      setState(prev => ({
        ...prev,
        devices: webrtcInit.devices,
        isLoading: false
      }));
      
      // Get user media with selected devices
      const constraints = {
        audio: state.isMicrophoneOn ? { deviceId: { ideal: effectiveAudioId } } : false,
        video: state.isCameraOn ? { 
          deviceId: { ideal: effectiveVideoId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Update state with new stream
      setState(prev => ({ ...prev, stream: newStream, isLoading: false }));
      streamRef.current = newStream;
      
      // Notify completion
      if (onMediaReady) {
        onMediaReady(newStream);
      }
    } catch (error) {
      // Handle errors
      if (onMediaError) {
        onMediaError('initialization', error.message, error);
      }
    }
  }, []);
  
  // Toggle camera/mic and handle device selection
  // ...

  return {
    isCameraOn: state.isCameraOn,
    isMicrophoneOn: state.isMicrophoneOn,
    isLoading: state.isLoading,
    error: state.error,
    devices: state.devices,
    selectedDevices: state.selectedDevices,
    stream: state.stream,
    toggleCamera,
    toggleMicrophone,
    selectDevice,
    reinitialize: initializeMediaStream
  };
}
```

#### 2. useMediasoupDevice Hook

Handles MediaSoup device initialization:

```typescript
export function useMediasoupDevice({
  onDeviceLoaded,
  onDeviceLoadFailed
} = {}) {
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const rtpCapabilitiesRef = useRef<mediasoupClient.types.RtpCapabilities | null>(null);
  
  // Initialize MediaSoup device with router capabilities
  const initializeMediasoupDevice = useCallback(
    async (routerRtpCapabilities) => {
      try {
        // Create device if needed
        if (!deviceRef.current) {
          deviceRef.current = new mediasoupClient.Device();
        }

        // Only load the device if it's not loaded yet
        if (!deviceRef.current.loaded) {
          await deviceRef.current.load({ routerRtpCapabilities });
          rtpCapabilitiesRef.current = routerRtpCapabilities;
          
          if (onDeviceLoaded && deviceRef.current) {
            onDeviceLoaded(deviceRef.current);
          }
        }

        return deviceRef.current;
      } catch (err) {
        if (onDeviceLoadFailed) {
          onDeviceLoadFailed(err);
        }
        throw err;
      }
    },
    [onDeviceLoaded, onDeviceLoadFailed]
  );

  return {
    deviceRef,
    rtpCapabilitiesRef,
    initializeMediasoupDevice,
  };
}
```

## MediaSoup/WebRTC Configuration

### MediaSoup Server Configuration

The MediaSoup server is configured with specific parameters in the `socketHandler.ts` file:

```typescript
// Router configuration - defines supported codecs
const mediasoupAppConfig = {
  router: {
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
    ],
  },
  
  // WebRTC Transport configuration
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
      },
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
  
  // MediaSoup Worker configuration
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || "40000"),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || "40100"),
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
};
```

### Dynamic ICE Configuration

The system dynamically adjusts ICE configuration based on connection type:

```typescript
// Function to determine appropriate ICE servers based on connection type
const getAppropriateIceConfiguration = (socket: Socket) => {
  const baseConfig = { ...mediasoupAppConfig.webRtcTransport };

  // Check if this is a loopback connection
  const clientIp = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  const host = socket.handshake.headers.host;
  const isLoopback = isLoopbackAddress(clientIp as string) || isLoopbackAddress(host?.split(":")[0]);

  // For loopback connections, adjust the configuration to be more reliable
  if (isLoopback) {
    return {
      ...baseConfig,
      listenIps: [{
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
      }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: false, // On loopback, TCP can be more reliable
    };
  }

  // Regular configuration for non-loopback connections
  return {
    ...baseConfig,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  };
};
```

### MediaSoup Worker Initialization

The MediaSoup worker is initialized in a separate script for reliability:

```javascript
// scripts/start-mediasoup.js
async function testMediasoupWorker() {
  try {
    const worker = await mediasoup.createWorker({
      logLevel: 'debug',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: MEDIASOUP_MIN_PORT,
      rtcMaxPort: MEDIASOUP_MAX_PORT,
    });
    
    // Create a test router
    const routerOptions = {
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
            'x-google-start-bitrate': 1000
          }
        }
      ]
    };
    
    const router = await worker.createRouter(routerOptions);
    console.log(`MediaSoup worker and router created successfully!`);
  } catch (error) {
    console.error('MediaSoup worker test failed:', error.message);
    process.exit(1);
  }
}
```

### Client-Side Transport Creation

```typescript
// Create WebRTC transport for producing (sending) media
async function createSendTransport() {
  try {
    // Request transport parameters from server
    const { params } = await socket.request('createProducerTransport', {
      forceTcp: false,
      rtpCapabilities: device.rtpCapabilities
    });
    
    // Create the transport in mediasoup-client
    const transport = device.createSendTransport(params);
    
    // Set up event listeners
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Signal to connect the transport
        await socket.request('connectProducerTransport', {
          transportId: transport.id,
          dtlsParameters
        });
        callback();
      } catch (error) {
        errback(error);
      }
    });
    
    transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        // Signal to create a producer
        const { id } = await socket.request('produce', {
          transportId: transport.id,
          kind,
          rtpParameters
        });
        callback({ id });
      } catch (error) {
        errback(error);
      }
    });
    
    return transport;
  } catch (error) {
    throw new Error(`Failed to create send transport: ${error.message}`);
  }
}
```

## Complete Stream Flow with Implementation Details

### 1. Stream Creation

1. User creates a stream by submitting the form at `/live-streams/create`
2. The form sends a POST request to `/api/live-streams`
3. The server creates a new stream with the `SCHEDULED` status in the database:

```typescript
const stream = await prisma.liveStream.create({
  data: {
    ...validatedData,
    userId: user.id,
    status: "SCHEDULED"
  }
});
```

### 2. Broadcaster Preparation

1. Broadcaster opens `/live-streams/[id]` page
2. `useMedia` hook initializes and enumerates available devices:

```typescript
const { devices, selectedDevices, stream } = useMedia({
  isStreamer: true,
  onMediaReady: (stream) => setIsDeviceSetupComplete(true)
});
```

3. Device selection UI is displayed via `DeviceSelector` component
4. Broadcaster selects devices and sees a preview of their camera

### 3. Start Streaming

1. Broadcaster clicks "Start Stream" button
2. `useStreamControls` hook sends API request to update database status:

```typescript
const handleStartStream = async () => {
  const response = await fetch(`${apiUrl}/live-streams/${streamId}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};
```

3. WebSocket connection is established with Socket.IO:

```typescript
socket.emit('broadcaster_ready', {
  streamId,
  userId,
  rtpCapabilities: device.rtpCapabilities
});
```

4. MediaSoup transport is created for the broadcaster:

```typescript
const sendTransport = device.createSendTransport(transportParams);
sendTransport.on('connect', async ({ dtlsParameters }, callback) => {
  await socket.request('connect-transport', {
    transportId: sendTransport.id,
    dtlsParameters
  });
  callback();
});
```

5. Local media is produced (camera and microphone):

```typescript
const videoProducer = await sendTransport.produce({
  track: localStream.getVideoTracks()[0],
  encodings: [], // Can be configured for simulcast
  codecOptions: { videoGoogleStartBitrate: 1000 }
});

const audioProducer = await sendTransport.produce({
  track: localStream.getAudioTracks()[0]
});
```

### 4. Viewer Connection

1. Viewer opens the stream page
2. Socket.IO connection is established with viewer role:

```typescript
socket.emit('viewer_ready', {
  streamId,
  userId,
  rtpCapabilities: device.rtpCapabilities
});
```

3. MediaSoup receive transport is created:

```typescript
const recvTransport = device.createRecvTransport(transportParams);
recvTransport.on('connect', async ({ dtlsParameters }, callback) => {
  await socket.request('connect-transport', {
    transportId: recvTransport.id,
    dtlsParameters
  });
  callback();
});
```

4. Consumers are created for the existing producers:

```typescript
const { producerId } = await socket.request('get-producer-info', {
  kind: 'video',
  streamId
});

const consumer = await recvTransport.consume({
  id: consumerId,
  producerId,
  kind,
  rtpParameters
});

const stream = new MediaStream();
stream.addTrack(consumer.track);
videoRef.current.srcObject = stream;
```

### 5. End Stream Process

1. Broadcaster clicks "End Stream" button
2. API request updates database status:

```typescript
const handleEndStream = async () => {
  await fetch(`${apiUrl}/live-streams/${streamId}/end`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};
```

3. WebSocket event notifies all clients:

```typescript
socket.emit('stream_ended', { streamId });
```

4. MediaSoup resources are cleaned up:

```typescript
// Close producers
producers.forEach(producer => producer.close());

// Close consumers
consumers.forEach(consumer => consumer.close());

// Close transports
transports.forEach(transport => transport.close());
```

## Conclusion

The BidPazar live streaming architecture implements a sophisticated WebRTC system with MediaSoup, ensuring robust real-time video streaming with proper state management between the database and WebRTC layers. The modular design separates concerns between the UI, API, and WebRTC components while maintaining state synchronization through event hooks and validation checks. 

The comprehensive API structure provides endpoints for all necessary stream operations, including state management, content creation, and analytics. The WebSocket layer using Socket.IO provides real-time communication for both signaling and chat, while the MediaSoup integration handles the actual WebRTC media streaming with proper room management and peer connections. 

## Recent WebRTC Optimizations

### Media Initialization Improvements

The BidPazar streaming system recently received several optimizations to improve reliability and performance:

1. **Duplicate Initialization Prevention**
   - Added a static initialization counter in `useMedia` hook to prevent duplicate media device initialization across component remounts
   - Implemented timestamp tracking to throttle rapid initialization attempts
   - Added instance IDs for better debugging of component lifecycles

2. **Optimized WebRTC for Loopback Connections**
   - Added automatic detection of localhost/loopback connections
   - Implemented specialized media constraints for development environments
   - Reduced video resolution and bitrate for local testing to improve performance

3. **Progressive Fallback Strategy**
   - Implemented a multi-stage fallback approach for media initialization:
     - First attempt: Full constraints with device IDs
     - Second attempt: Generic constraints without device IDs
     - Third attempt: Audio-only as last resort
   - Added counters to limit excessive retry attempts

4. **Improved Error Handling**
   - Enhanced error capture and reporting
   - Added detailed logging with device information
   - Implemented graceful degradation instead of hard failures

### MediaSoup Worker Fixes

A dedicated `fix-mediasoup.js` script was created to address binary compilation issues:

```javascript
function rebuildMediaSoup() {
  info("Rebuilding MediaSoup...");
  
  // Clean npm cache for mediasoup
  execCommand("npm cache clean --force mediasoup");
  
  // Force reinstall with binary rebuild
  execCommand("npm install mediasoup@latest --build-from-source");
  
  // Verify installation
  const mediasoupPath = require.resolve("mediasoup");
  info(`MediaSoup resolved at: ${mediasoupPath}`);
  
  // Test worker binary
  try {
    const mediasoup = require("mediasoup");
    const worker = mediasoup.createWorker({
      logLevel: "warn",
    });
    success("MediaSoup worker created successfully!");
    return true;
  } catch (err) {
    error(`Failed to create MediaSoup worker: ${err.message}`);
    return false;
  }
}
```

### WebRTC Diagnostics and Monitoring

A new lightweight `WebRTCDiagnostics` component was introduced to help troubleshoot common WebRTC issues:

- Browser compatibility detection
- Media permission status checking
- Device enumeration
- Connection type detection (loopback/production)
- Media capture testing

This component was implemented without UI library dependencies to ensure it can be used anywhere in the application without introducing additional package requirements.

### Architecture Refactoring

The media initialization system was refactored to better separate concerns:

1. **Core Media Hooks**
   - `useMedia`: General-purpose media device management (camera/microphone)
   - `useMediasoupDevice`: MediaSoup device initialization
   - `useMediaTransports`: WebRTC transport management
   - `useSocketConnection`: Socket.IO connection handling

2. **Specialized Utilities**
   - `loopbackUtils.ts`: Detection and optimization for local development
   - `mediasoupFix.ts`: Utilities for diagnosing and fixing MediaSoup issues
   - `storage.ts`: Session persistence for reconnection handling

These improvements have significantly enhanced the reliability and performance of the BidPazar streaming system, particularly for development environments and in situations with unreliable connections.