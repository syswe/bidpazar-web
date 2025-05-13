# BidPazar Live Streaming Architecture with Jitsi Meet

## Overview

BidPazar's live streaming system integrates a frontend React/Next.js interface with Jitsi Meet SDK for video/audio streaming, and Socket.IO for real-time messaging and bidding. The architecture consists of several interconnected layers:

1. **Database Layer**: Prisma schema for stream metadata storage
2. **API Layer**: Next.js API routes for CRUD operations
3. **Jitsi Layer**: Jitsi Meet SDK integration for real-time video conferencing
4. **Socket.IO Layer**: Real-time messaging for chat and bidding
5. **UI Layer**: React components for stream creation, integration, and viewing

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
│  Socket.IO      │◄────►│  Jitsi Meet SDK   │      
│  (Chat/Bidding) │      │  (Video/Audio)    │      
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
- `src/components/stream/JitsiStreamManager.tsx` - Core streaming component
- `src/hooks/useJitsiMeet.ts` - Hook for Jitsi Meet functionality

**Process:**
1. User navigates to `/streams/{id}/broadcast`
2. `JitsiStreamManager` initializes and loads the Jitsi Meet SDK
3. Jitsi Meet interface is displayed to the user
4. Device selection is handled by Jitsi Meet UI

```
┌────────────────┐     ┌─────────────────────┐     ┌───────────────┐
│                │     │                     │     │               │
│  Broadcast UI  │────►│  JitsiStreamManager │────►│  useJitsiMeet │
│                │     │                     │     │               │
└────────────────┘     └─────────────────────┘     └───────────────┘
                                │                          │
                                │                          │
                                ▼                          ▼
                        ┌─────────────────┐      ┌──────────────────┐
                        │                 │      │                  │
                        │  Socket.IO      │      │  Jitsi Meet      │
                        │  Connection     │      │  IFrame API      │
                        └─────────────────┘      └──────────────────┘
```

### 3. Socket.IO Connection Establishment

**Files involved:**
- `src/hooks/useSocketChat.ts` - WebSocket connection for chat
- `src/hooks/useSocketBidding.ts` - WebSocket connection for bidding
- `server.js` - Socket.IO server initialization

**Process:**
1. When user navigates to stream page, a Socket.IO connection is initiated
2. Connection includes parameters: `streamId`, `userId`, `username`
3. Socket.IO server processes the connection and assigns the user to the appropriate room
4. A bidirectional channel is established for chat messages and bids

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│              │     │                │     │                 │
│  useSocketIO │────►│  Socket.IO     │────►│  Server.js      │
│              │     │  Client        │     │  Socket Handler │
└──────────────┘     └────────────────┘     └─────────────────┘
        │                                           │
        │                                           │
        └───────────────────────────────────────────┘
                 Real-time Communication
```

### 4. Starting the Stream

**Files involved:**
- `src/components/stream/StreamControls.tsx` - UI controls for broadcasting
- `src/app/api/live-streams/[id]/start/route.ts` - API to start a stream
- `src/hooks/useJitsiMeet.ts` - Jitsi Meet initialization

**Process:**
1. User clicks "Start Stream" button
2. API request to `/api/live-streams/{id}/start` updates database status to `LIVE`
3. Jitsi Meet room is created/joined:

```javascript
const options = {
  roomName: `bidpazar-stream-${streamId}`,
  width: '100%',
  height: '100%',
  parentNode: document.getElementById('jitsi-container'),
  configOverwrite: {
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    disableDeepLinking: true,
    prejoinPageEnabled: false,
    disableInviteFunctions: true,
  },
  interfaceConfigOverwrite: {
    TOOLBAR_BUTTONS: [
      'microphone', 'camera', 'desktop', 'settings',
    ],
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
  },
  userInfo: {
    displayName: username || 'BidPazar Seller',
    email: user?.email,
  },
};

const jitsiApi = new JitsiMeetExternalAPI(domain, options);
```

4. Jitsi Meet API event listeners are set up:

```javascript
jitsiApi.addEventListeners({
  videoConferenceJoined: handleJitsiJoined,
  videoConferenceLeft: handleJitsiLeft,
  participantJoined: handleParticipantJoined,
  participantLeft: handleParticipantLeft,
  audioMuteStatusChanged: handleAudioMuteChanged,
  videoMuteStatusChanged: handleVideoMuteChanged,
});
```

5. Stream status is updated in the database and broadcasted to all viewers

```
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│              │     │               │     │                │
│  Start       │────►│  API /start   │────►│  Database      │
│  Button      │     │               │     │  Update        │
│              │     └───────┬───────┘     └────────────────┘
└──────────────┘             │                     │
                             │                     │
                             ▼                     │
                     ┌───────────────┐             │
                     │               │             │
                     │ Socket.IO     │             │
                     │ Notification  │             │
                     └───────┬───────┘             │
                             │                     │
                             ▼                     │
┌──────────────┐     ┌───────────────┐     ┌───────▼────────┐
│              │     │               │     │                │
│  useJitsiMeet│────►│ Jitsi Meet    │────►│ Participants   │
│              │     │ Room Creation │     │ Join           │
└──────────────┘     │               │     │                │
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
  status        String          @default("SCHEDULED") // Values: SCHEDULED, LIVE, PAUSED, ENDED, CANCELLED
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

Updates stream status to LIVE and notifies WebSocket clients:

```typescript
export async function POST(request: NextRequest, { params }) {
  // Authentication check
  // Verify stream exists
  // Update status to LIVE
  const updatedStream = await prisma.liveStream.update({
    where: { id },
    data: {
      status: 'LIVE',
      startTime: new Date()
    }
  });
  
  // Notify WebSocket clients
  const io = getSocketIOInstance();
  if (io) {
    io.to(`stream:${id}`).emit('stream_state_changed', {
      streamId: id,
      status: 'LIVE',
      startTime: updatedStream.startTime
    });
  }
  
  return NextResponse.json(updatedStream);
}
```

### Jitsi Meet Integration

#### Jitsi Manager Hook

**File:** `src/hooks/useJitsiMeet.ts`

The hook that handles Jitsi Meet integration:

```typescript
export function useJitsiMeet({
  roomName,
  displayName,
  containerId,
  onParticipantJoined,
  onParticipantLeft,
  onVideoConferenceJoined,
  onVideoConferenceLeft
}) {
  const [jitsiApi, setJitsiApi] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  
  // Initialize Jitsi Meet
  const initJitsi = useCallback(() => {
    if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) {
      // Clear any existing instances
      if (jitsiApi) {
        jitsiApi.dispose();
      }
      
      // Configure options
      const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si';
      const options = {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: document.getElementById(containerId),
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'settings',
          ],
          SHOW_JITSI_WATERMARK: false,
        },
        userInfo: {
          displayName,
        },
      };
      
      // Create Jitsi Meet External API instance
      const api = new window.JitsiMeetExternalAPI(domain, options);
      
      // Set up event listeners
      api.addEventListeners({
        videoConferenceJoined: (e) => {
          setIsConnected(true);
          if (onVideoConferenceJoined) onVideoConferenceJoined(e);
        },
        videoConferenceLeft: (e) => {
          setIsConnected(false);
          if (onVideoConferenceLeft) onVideoConferenceLeft(e);
        },
        participantJoined: (e) => {
          setParticipants(prev => [...prev, e.id]);
          if (onParticipantJoined) onParticipantJoined(e);
        },
        participantLeft: (e) => {
          setParticipants(prev => prev.filter(id => id !== e.id));
          if (onParticipantLeft) onParticipantLeft(e);
        },
      });
      
      setJitsiApi(api);
      return api;
    }
    return null;
  }, [roomName, displayName, containerId, onParticipantJoined, onParticipantLeft, onVideoConferenceJoined, onVideoConferenceLeft, jitsiApi]);
  
  // Initialize on mount
  useEffect(() => {
    // Load Jitsi Meet API if not already loaded
    if (typeof window !== 'undefined' && !window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    } else if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) {
      initJitsi();
    }
    
    // Cleanup on unmount
    return () => {
      if (jitsiApi) {
        jitsiApi.dispose();
      }
    };
  }, [initJitsi]);
  
  // Helper methods
  const executeCommand = useCallback((command, ...args) => {
    if (jitsiApi) {
      jitsiApi.executeCommand(command, ...args);
      return true;
    }
    return false;
  }, [jitsiApi]);
  
  return {
    jitsiApi,
    isConnected,
    participants,
    participantCount: participants.length,
    executeCommand,
    toggleAudio: () => executeCommand('toggleAudio'),
    toggleVideo: () => executeCommand('toggleVideo'),
    toggleShareScreen: () => executeCommand('toggleShareScreen'),
    hangup: () => executeCommand('hangup'),
  };
}
```

#### Jitsi Stream Manager Component

**File:** `src/components/stream/JitsiStreamManager.tsx`

React component that uses the Jitsi Meet hook:

```tsx
const JitsiStreamManager: React.FC<JitsiStreamManagerProps> = ({
  streamId,
  userId,
  username,
  isStreamer,
  onParticipantJoined,
  onParticipantLeft,
  onConferenceJoined,
  onConferenceLeft,
}) => {
  const containerId = `jitsi-container-${streamId}`;
  const roomName = `bidpazar-stream-${streamId}`;
  
  // Get Jitsi Meet instance and controls
  const {
    jitsiApi,
    isConnected,
    participants,
    participantCount,
    toggleAudio,
    toggleVideo,
    toggleShareScreen,
    hangup,
  } = useJitsiMeet({
    roomName,
    displayName: username || (isStreamer ? 'Broadcaster' : 'Viewer'),
    containerId,
    onParticipantJoined,
    onParticipantLeft,
    onVideoConferenceJoined: onConferenceJoined,
    onVideoConferenceLeft: onConferenceLeft,
  });
  
  // Use Socket.IO for chat
  const { messages, sendMessage } = useSocketChat(streamId, userId, username);
  
  return (
    <div className="jitsi-stream-manager">
      <div id={containerId} className="jitsi-container"></div>
      
      {isStreamer && (
        <div className="stream-controls">
          <button onClick={toggleAudio}>Toggle Audio</button>
          <button onClick={toggleVideo}>Toggle Video</button>
          <button onClick={toggleShareScreen}>Share Screen</button>
          <button onClick={hangup}>End Stream</button>
        </div>
      )}
      
      <div className="stream-info">
        <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        <p>Participants: {participantCount}</p>
      </div>
      
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className="message">
              <span className="username">{msg.username}: </span>
              <span className="content">{msg.message}</span>
            </div>
          ))}
        </div>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
          sendMessage(input.value);
          input.value = '';
        }}>
          <input type="text" name="message" placeholder="Type a message..." />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};
```

### Socket.IO for Chat and Bidding

**File:** `server.js` (Socket.IO initialization)

```javascript
// Socket.IO initialization in server.js
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io"
});

// Socket event handling
io.on('connection', (socket) => {
  const { streamId, userId, username } = socket.handshake.query;
  
  // Join appropriate room
  if (streamId) {
    socket.join(`stream:${streamId}`);
    console.log(`User ${username || userId || socket.id} joined stream ${streamId}`);
  }
  
  // Handle chat messages
  socket.on('chat_message', (data) => {
    const { message, streamId } = data;
    
    if (!streamId) return;
    
    const messageData = {
      streamId,
      userId: socket.handshake.query.userId || 'anonymous',
      username: socket.handshake.query.username || 'Anonymous',
      message,
      timestamp: new Date().toISOString()
    };
    
    io.to(`stream:${streamId}`).emit('chat_message', messageData);
    
    // Optionally save to database
    saveMessageToDatabase(messageData).catch(console.error);
  });
  
  // Handle bidding
  socket.on('place_bid', async (data) => {
    const { amount, streamId, listingId } = data;
    
    try {
      // Validate and save bid to database
      const bid = await saveBidToDatabase({
        amount,
        streamId,
        listingId,
        userId: socket.handshake.query.userId
      });
      
      // Broadcast to all viewers
      io.to(`stream:${streamId}`).emit('new_bid', {
        id: bid.id,
        amount: bid.amount,
        userId: bid.userId,
        username: socket.handshake.query.username,
        timestamp: bid.createdAt
      });
    } catch (error) {
      // Send error only to the bidder
      socket.emit('bid_error', {
        message: error.message,
        code: error.code
      });
    }
  });
  
  // Handle stream state changes
  socket.on('update_stream_state', (data) => {
    const { streamId, status } = data;
    io.to(`stream:${streamId}`).emit('stream_state_changed', {
      status,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle countdown timer events
  socket.on('start_countdown', (data) => {
    const { streamId, listingId, duration } = data;
    io.to(`stream:${streamId}`).emit('countdown_started', {
      listingId,
      duration,
      startedAt: new Date().toISOString()
    });
    
    // Set timeout to notify when countdown completes
    setTimeout(() => {
      io.to(`stream:${streamId}`).emit('countdown_completed', {
        listingId,
        completedAt: new Date().toISOString()
      });
    }, duration * 1000);
  });
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log(`User ${socket.handshake.query.username || socket.id} disconnected`);
  });
});
```

## Complete User Flow

1. **Create Stream**
   - User creates a stream via UI form
   - Database entry created with `SCHEDULED` status

2. **Prepare to Broadcast**
   - User navigates to broadcast page
   - Jitsi Meet SDK is loaded
   - Socket.IO connection for chat/bidding is established

3. **Start Broadcasting**
   - User clicks "Start Stream"
   - API updates database status to `LIVE`
   - Jitsi Meet room is created/joined
   - Socket.IO notifies all listeners of the status change

4. **Broadcasting**
   - Broadcaster streams through Jitsi Meet
   - Viewers join the Jitsi Meet room
   - Chat and bidding happen through Socket.IO

5. **End Stream**
   - User clicks "End Stream"
   - API updates database status to `ENDED`
   - Jitsi Meet connection is terminated
   - Socket.IO notifications about stream ending are sent to all clients

## Jitsi Meet Configuration Options

Jitsi Meet SDK provides extensive configuration options:

```javascript
const options = {
  roomName: `bidpazar-stream-${streamId}`,
  width: '100%',
  height: '100%',
  parentNode: document.getElementById('jitsi-container'),
  configOverwrite: {
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    disableDeepLinking: true,
    prejoinPageEnabled: false,
    disableInviteFunctions: true,
    enableClosePage: false,
    disableInviteFunctions: true,
    toolbarButtons: [
      'microphone', 'camera', 'desktop', 'settings',
      'raisehand', 'filmstrip', 'participants-pane'
    ],
  },
  interfaceConfigOverwrite: {
    TOOLBAR_BUTTONS: [
      'microphone', 'camera', 'desktop', 'settings',
      'raisehand', 'filmstrip'
    ],
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    DEFAULT_BACKGROUND: '#F8F9FA',
    DEFAULT_REMOTE_DISPLAY_NAME: 'BidPazar Viewer',
    LANG_DETECTION: true,
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
    DISABLE_FOCUS_INDICATOR: true,
  },
  userInfo: {
    displayName: username || 'BidPazar Seller',
    email: user?.email,
  },
};
```

## Conclusion

The BidPazar live streaming architecture implements a robust video streaming solution using Jitsi Meet SDK for video/audio and Socket.IO for chat and bidding. This approach offers several advantages:

1. **Reduced Server Complexity**: By leveraging Jitsi Meet's infrastructure, we eliminate the need for a custom WebRTC server setup.

2. **Mature SDK**: Jitsi Meet is a mature, well-tested video conferencing solution that handles device management, screen sharing, and UI components.

3. **Separation of Concerns**: Video/audio are handled by Jitsi Meet, while chat and bidding use Socket.IO, enabling independent scaling of these services.

4. **Mobile-Ready**: The Jitsi Meet SDK supports mobile devices, making it suitable for our mobile-first approach.

5. **Customizable UI**: The Jitsi Meet API allows for extensive UI customization to match the BidPazar brand and UX requirements.

The system successfully delivers a low-latency, high-quality streaming experience with real-time interaction for auctions, while keeping implementation complexity manageable and scalable.