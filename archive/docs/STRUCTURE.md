# docs/STRUCTURE.md

# Project Structure Overview

This document outlines the directory structure and key components of the BidPazar application, now a unified full-stack Next.js 15 application. A mobile application is planned for future development.

## Full-Stack Application (Next.js 15 + TypeScript)

The application provides both frontend and backend functionality in a single Next.js 15 codebase, including API routes, real-time features, and database access.

```
/                       # Project root
├── .next/              # Next.js build cache and output
├── node_modules/       # Project dependencies
├── public/             # Static assets served directly (images, fonts, robots.txt, uploads/)
│   └── uploads/        # Local storage for user-uploaded files
├── prisma/             # Prisma ORM schema, migrations, and client generation
│   ├── schema.prisma   # Main database schema definition
│   ├── test-schema.prisma # Test database schema
│   └── migrations/     # Prisma migration files
├── src/                # Main source code directory
│   ├── app/            # Next.js App Router: pages, layouts, API routes, route groups
│   │   ├── api/        # API route handlers (REST endpoints, WebSocket, etc.)
│   │   │   ├── auth/           # Authentication endpoints (register, login, logout, verify, etc.)
│   │   │   ├── users/          # User management endpoints
│   │   │   ├── products/       # Product management endpoints
│   │   │   ├── categories/     # Category management endpoints
│   │   │   ├── devices/        # Device management endpoints
│   │   │   ├── messages/       # Messaging endpoints
│   │   │   ├── socket/         # Socket.IO helpers for WebSocket fallbacks
│   │   │   ├── live-streams/   # Live stream management endpoints (REST API for stream lifecycle: create, start, end, fetch details).
│   │   │   └── ...             # Additional API endpoints
│   │   ├── (auth)/     # Route group for authentication pages (login, register, etc.)
│   │   ├── (dashboard)/# Route group for user/admin dashboards
│   │   ├── (streams)/  # Route group for live streams
│   │   │   └── live-streams/[id]/ # Dynamic route for individual live stream pages
│   │   │       ├── page.tsx    # Main page component for a live stream. Responsible for fetching stream details, rendering UI, managing user interactions (chat, bidding), and hosting the JitsiStreamManager. It handles stream start/stop UI and passes relevant props (streamId, userId, isStreamer) to JitsiStreamManager.
│   │   │       └── components/ # Components specific to the live stream page
│   │   │           ├── JitsiStreamManager.tsx # Core client-side component for Jitsi Meet integration. Manages Jitsi Meet SDK initialization, room creation/joining, and event handling.
│   │   │           ├── StreamChat.tsx          # Component for handling live chat functionality.
│   │   │           ├── BiddingInterface.tsx    # Component for product bidding during a stream.
│   │   │           └── ...                     # Other stream-specific UI components (e.g., ProductDisplay, StreamControls).
│   │   ├── (products)/ # Route group for product pages
│   │   ├── (admin)/    # Route group for admin pages
│   │   ├── (static)/   # Route group for static/informational pages
│   │   ├── layout.tsx  # Root application layout
│   │   └── page.tsx    # Root application page
│   ├── components/     # Reusable React components (UI elements, forms, layouts, etc.)
│   │   └── ui/         # Shared UI primitives and design system components
│   ├── hooks/          # Custom React hooks (e.g., useAuth, useJitsiMeet, useSocketChat)
│   │   ├── useJitsiMeet.ts # Hook for Jitsi Meet integration
│   │   ├── useSocketChat.ts # Hook for Socket.IO chat functionality
│   │   └── useSocketBidding.ts # Hook for Socket.IO bidding functionality
│   ├── lib/            # Shared libraries, utilities, API clients, Prisma, auth, SMS, etc.
│   │   └── logger.ts   # Centralized logging utility.
│   ├── services/       # Business logic and service modules
│   ├── tests/          # Unit, integration, and E2E tests (setup, mocks, utils, etc.)
│   ├── types/          # Custom TypeScript type definitions and interfaces
│   └── middleware.ts   # Next.js middleware for route protection, CORS, etc. (Configured to bypass Socket.IO paths).
├── .env                # Main environment variables for development. Contains settings for NEXT_PUBLIC_SOCKET_URL (e.g., ws://localhost:3001), NEXT_PUBLIC_JITSI_DOMAIN (e.g., meet.jit.si).
├── .env.local          # Local environment overrides (Gitignored).
├── .env.prod           # Environment variables for production. Contains settings for NEXT_PUBLIC_SOCKET_URL (e.g., wss://socket.bidpazar.com), NEXT_PUBLIC_JITSI_DOMAIN.
├── .env.docker         # (If used) Environment variables specific to Docker deployment, often sourced by `docker-compose.yaml`.
├── .gitignore          # Specifies intentionally untracked files that Git should ignore
├── Dockerfile          # Instructions for building the Docker image. Includes steps to copy source code, install dependencies, build the Next.js app, and copy the server.js.
├── docker-compose.yaml # Docker Compose configuration for multi-container setups (e.g., app + db).
├── docker-compose-prod.yaml # Docker Compose configuration for production.
├── jest.config.js      # Configuration for the Jest testing framework
├── next.config.ts      # Next.js configuration file
├── package.json        # Node.js project manifest (dependencies, scripts, metadata)
├── package-lock.json   # Records exact versions of dependencies
├── postcss.config.js   # PostCSS configuration (used by Tailwind CSS)
├── tailwind.config.js  # Tailwind CSS theme and plugin configuration
├── tsconfig.json       # TypeScript compiler options
├── server.js           # Custom Next.js server initialization file that integrates Socket.IO for chat and bidding.
├── README.md           # Detailed project documentation
└── docs/               # Additional documentation files
    ├── STRUCTURE.md    # This document - project structure overview
    ├── JITSI-SETUP.md  # Jitsi Meet configuration and setup details
    ├── LIVE-STREAM.md  # Live streaming feature documentation
    ├── AUTH.md         # Authentication system documentation
    ├── API.md          # API documentation guide
    ├── ENV.md          # Environment variables documentation
    ├── MIGRATION.md    # Migration guides for version updates
    └── PRODUCTS.md     # Product management documentation
```

## Key Components in Detail

### 1. Custom Server (`server.js`)

This is the entry point for the application and handles:

- Next.js application initialization
- HTTP server setup
- Socket.IO server integration for chat and bidding
- Graceful shutdown handling

```javascript
// Example server.js structure
const { createServer } = require("http");
const { Server } = require("socket.io");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT, 10) || 3000;
const socketPort = parseInt(process.env.PORT_SOCKET, 10) || 3001;

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Start HTTP server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Always use a separate server for Socket.IO
  const io = socketio(socketPort, {
    cors: {
      // Allow connections from the main app
      origin: dev 
        ? `http://${hostname}:${port}` 
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://bidpazar.com'),
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: process.env.WS_URL || '/socket.io',
  });
  
  console.log(`> Socket.IO server running on port ${socketPort}`);

  // Handle socket connections
  io.on('connection', (socket) => {
    // Extract data from connection query
    const { streamId, userId, username } = socket.handshake.query;
    
    if (streamId) {
      socket.join(`stream:${streamId}`);
      console.log(`User ${username || userId || socket.id} joined stream ${streamId}`);
    }
    
    // Handle chat messages
    socket.on('chat_message', (data) => {
      // Process and broadcast message
    });
    
    // Handle bidding
    socket.on('place_bid', (data) => {
      // Process and broadcast bid
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
});
```

### 2. Jitsi Meet Integration (`src/hooks/useJitsiMeet.ts`)

This hook handles the integration with Jitsi Meet SDK for video conferencing:

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
  
  // Load Jitsi Meet script and initialize
  useEffect(() => {
    // Dynamically load Jitsi Meet API if not already loaded
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

### 3. Stream Manager Component (`src/app/(streams)/live-streams/[id]/components/JitsiStreamManager.tsx`)

This React component integrates Jitsi Meet into the UI:

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
        {/* Chat messages UI */}
        {/* Chat input form */}
      </div>
    </div>
  );
};
```

### 4. Socket.IO Chat Hook (`src/hooks/useSocketChat.ts`)

This hook handles real-time chat functionality:

```typescript
export function useSocketChat(streamId, userId, username) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  
  useEffect(() => {
    // Get Socket.IO URL from environment or runtime config
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
    
    // Connect to Socket.IO server
    socketRef.current = io(socketUrl, {
      path: '/socket.io',
      query: {
        streamId,
        userId,
        username
      }
    });
    
    // Set up event handlers
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to chat server');
      
      // Join stream room
      socketRef.current.emit('join-stream', streamId);
    });
    
    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from chat server');
    });
    
    // Listen for incoming messages
    socketRef.current.on('stream-message', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [streamId, userId, username]);
  
  // Function to send a message
  const sendMessage = useCallback((content) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('stream-message', {
        streamId,
        userId,
        username,
        message: content,
        timestamp: new Date().toISOString()
      });
    }
  }, [isConnected, streamId, userId, username]);
  
  return {
    messages,
    isConnected,
    sendMessage
  };
}
```

### 5. Database Models (Prisma Schema)

The main entities for the live streaming feature include:

```prisma
// Live Stream model
model LiveStream {
  id            String           @id @default(cuid())
  title         String
  description   String?
  thumbnailUrl  String?
  status        StreamStatus     @default(SCHEDULED)
  startTime     DateTime?
  endTime       DateTime?
  userId        String           // Streamer's user ID
  user          User             @relation(fields: [userId], references: [id])
  viewers       User[]           @relation("StreamViewers")
  viewerCount   Int              @default(0)
  listings      AuctionListing[]
  chatMessages  ChatMessage[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

// StreamStatus enum
enum StreamStatus {
  SCHEDULED
  LIVE
  PAUSED
  ENDED
  CANCELLED
}
```

## Architecture Diagram

```
                    HTTP/REST API
User Interface <----------------> Next.js API Routes <-------> Database (PostgreSQL)
     |                                  |                           |
     |                                  |                           |
     |          Socket.IO               |                           |
     |<---------------------------> Socket Handler                  |
     |          (Chat/Bidding)          |                           |
     |                                  |                           |
     |          Jitsi Meet SDK          |                           |
     |<-----> (Video Conferencing) <----------------------------> Storage
```

## Development Workflow

1. **Local Development**:

   ```bash
   # Install dependencies
   npm install

   # Set up environment variables
   cp .env.example .env.local
   # Edit .env.local with your local configuration

   # Run database migrations
   npx prisma migrate dev

   # Start the development server
   npm run dev
   ```

2. **Testing**:

   ```bash
   # Run unit tests
   npm test

   # Run E2E tests
   npm run test:e2e
   ```

3. **Production Deployment**:

   ```bash
   # Build the application
   npm run build

   # Start the production server
   npm start
   ```

## Documentation

Comprehensive documentation is maintained in the `docs/` directory:

- `STRUCTURE.md` - This document detailing project structure
- `JITSI-SETUP.md` - Jitsi Meet configuration and troubleshooting
- `LIVE-STREAM.md` - Live streaming feature documentation
- `AUTH.md` - Authentication flow and implementation details
- `API.md` - API documentation and usage examples
- `ENV.md` - Environment variables reference
- `MIGRATION.md` - Guides for version migrations
- `PRODUCTS.md` - Product management documentation

## Conclusion

The BidPazar application follows a modern full-stack architecture using Next.js 15 with App Router, integrating real-time features through Socket.IO for chat/bidding and Jitsi Meet SDK for video conferencing. The codebase is organized to maintain clear separation of concerns while enabling seamless integration between frontend and backend functionality.
