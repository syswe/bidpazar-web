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
│   │   ├── api/        # API route handlers (REST endpoints, WebSocket, WebRTC, etc.)
│   │   │   ├── auth/           # Authentication endpoints (register, login, logout, verify, etc.)
│   │   │   ├── users/          # User management endpoints
│   │   │   ├── products/       # Product management endpoints
│   │   │   ├── categories/     # Category management endpoints
│   │   │   ├── devices/        # Device management endpoints
│   │   │   ├── messages/       # Messaging endpoints
│   │   │   ├── rtc/            # Real-time communication (WebSocket, MediaSoup, etc.)
│   │   │   ├── live-streams/   # Live stream management endpoints (REST API for stream lifecycle: create, start, end, fetch details).
│   │   │   └── ...             # Additional API endpoints
│   │   ├── (auth)/     # Route group for authentication pages (login, register, etc.)
│   │   ├── (dashboard)/# Route group for user/admin dashboards
│   │   ├── (streams)/  # Route group for live streams
│   │   │   └── live-streams/[id]/ # Dynamic route for individual live stream pages
│   │   │       ├── page.tsx    # Main page component for a live stream. Responsible for fetching stream details, rendering UI, managing user interactions (chat, bidding), and hosting the WebRTCStreamManager. It handles stream start/stop UI and passes relevant props (streamId, userId, isStreamer, media states) to WebRTCStreamManager.
│   │   │       └── components/ # Components specific to the live stream page
│   │   │           ├── WebRTCStreamManager.tsx # Core client-side component for WebRTC logic. Manages Socket.IO connection for signaling, MediaSoup device initialization, creation of send/receive transports, media track production (from camera/mic via getUserMedia) and consumption, and handles all WebRTC eventing.
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
│   ├── hooks/          # Custom React hooks (e.g., useAuth, useSimplePeer)
│   ├── lib/            # Shared libraries, utilities, API clients, Prisma, auth, SMS, etc.
│   │   ├── logger.ts   # Centralized logging utility.
│   │   └── socket/     # Modules related to WebSocket and real-time communication.
│   │       └── socketHandler.ts # Server-side module responsible for all Socket.IO event handling, WebRTC signaling logic, and MediaSoup integration. It manages MediaSoup workers, routers, transports, producers, and consumers. Key events handled include `getRouterRtpCapabilities`, `createProducerTransport`, `connectTransport`, `produce`, `consume`, `broadcaster_ready`, `viewer_ready`, and chat messages.
│   ├── services/       # Business logic, streaming, and service modules
│   ├── tests/          # Unit, integration, and E2E tests (setup, mocks, utils, etc.)
│   ├── types/          # Custom TypeScript type definitions and interfaces
│   └── middleware.ts   # Next.js middleware for route protection, CORS, etc. (Configured to bypass Socket.IO paths).
├── .env                # Main environment variables for development. Contains settings for NEXT_PUBLIC_SOCKET_URL (e.g., ws://localhost:3000), MEDIASOUP_ANNOUNCED_IP (e.g., 127.0.0.1 or LAN IP), STUN/TURN server URLs.
├── .env.local          # Local environment overrides (Gitignored).
├── .env.prod           # Environment variables for production. Contains settings for NEXT_PUBLIC_SOCKET_URL (e.g., wss://yourdomain.com), MEDIASOUP_ANNOUNCED_IP (public IP of the server), STUN/TURN server URLs and credentials.
├── .env.docker         # (If used) Environment variables specific to Docker deployment, often sourced by `docker-compose.yaml`.
├── .gitignore          # Specifies intentionally untracked files that Git should ignore
├── Dockerfile          # Instructions for building the Docker image. Includes steps to copy source code, install dependencies, build the Next.js app, and copy the `dist` and `server.js`.
├── docker-compose.yaml # Docker Compose configuration for multi-container setups (e.g., app + db).
├── docker-compose-prod.yaml # Docker Compose configuration for production, potentially including services like a CoTURN server and defining UDP port mappings for MediaSoup (e.g., 40000-40100).
├── jest.config.js      # Configuration for the Jest testing framework
├── next.config.ts      # Next.js configuration file
├── package.json        # Node.js project manifest (dependencies, scripts, metadata)
├── package-lock.json   # Records exact versions of dependencies
├── postcss.config.js   # PostCSS configuration (used by Tailwind CSS)
├── tailwind.config.js  # Tailwind CSS theme and plugin configuration
├── tsconfig.json       # TypeScript compiler options
├── server.js           # Custom Next.js server initialization file that integrates Socket.IO and MediaSoup.
├── README.md           # Detailed project documentation
└── docs/               # Additional documentation files
    ├── STRUCTURE.md    # This document - project structure overview
    ├── MEDIASOUP-SETUP.md # MediaSoup configuration and setup details
    ├── WEBRTC-TROUBLESHOOTING.md # Guide for troubleshooting WebRTC issues
    ├── LOGGING.md      # Logging standards and patterns
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
- Socket.IO server integration
- MediaSoup initialization (via socketHandler)
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

// Import the socket handler dynamically based on environment
const socketHandlerPath = dev
  ? "./src/lib/socket/socketHandler"
  : "./dist/lib/socket/socketHandler";

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Initialize the socket handler with the IO instance
  const { initializeSocketIOServer } = require(socketHandlerPath);
  initializeSocketIOServer(io);

  // Handle WebSocket upgrade requests
  httpServer.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url);

    if (pathname.startsWith("/socket.io/")) {
      io.engine.handleUpgrade(request, socket, head);
    } else {
      socket.destroy();
    }
  });

  // Start the server
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`> Server listening on port ${PORT}`);
  });
});
```

### 2. Socket Handler (`src/lib/socket/socketHandler.ts`)

This module is responsible for all real-time communication and WebRTC functionality:

- Socket.IO event handling
- MediaSoup worker management
- WebRTC signaling
- Room and peer management
- Producer and consumer handling for audio/video streams
- Chat message relay

Key sections include:

```typescript
// MediaSoup configuration setup
const mediasoupAppConfig = {
  worker: {
    rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 40100,
    logLevel: process.env.MEDIASOUP_LOG_LEVEL || "warn",
    logTags: process.env.MEDIASOUP_LOG_TAGS?.split(",") || ["info"],
  },
  router: {
    mediaCodecs: [
      // Video codecs
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {},
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {},
      },
      // Audio codecs
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 800000,
    minimumAvailableOutgoingBitrate: 100000,
    maxSctpMessageSize: 262144,
  },
};

// Initialize the MediaSoup worker
let mediasoupWorker;

export function initializeSocketIOServer(providedIo) {
  // Use provided IO or create a new one
  io = providedIo || createSocketIOServer();

  // Start the MediaSoup worker
  startMediasoupWorker().catch((error) => {
    logger.error("[MediaSoup] Failed to start worker", error);
    process.exit(1);
  });

  // Handle socket connections
  io.on("connection", async (socket) => {
    // Extract data from connection query
    const { streamId, userId, username, isStreamer, isAnonymous } =
      socket.handshake.query;

    // Handle various WebRTC signaling events
    socket.on("getRouterRtpCapabilities", async (callback) => {
      // Send mediasoup router RTP capabilities to the client
    });

    socket.on("createProducerTransport", async (callback) => {
      // Create a WebRTC transport for producing media
    });

    socket.on("createConsumerTransport", async (callback) => {
      // Create a WebRTC transport for consuming media
    });

    socket.on("connectTransport", async (data, callback) => {
      // Connect a WebRTC transport with client DTLS parameters
    });

    socket.on("produce", async (data, callback) => {
      // Handle media production (audio/video tracks)
    });

    socket.on("consume", async (data, callback) => {
      // Handle media consumption
    });

    socket.on("broadcaster_ready", async (data) => {
      // Handle when a broadcaster is ready to stream
    });

    socket.on("viewer_ready", async () => {
      // Handle when a viewer is ready to receive media
    });

    // Chat and other events
    socket.on("chat_message", (message) => {
      // Relay chat messages to the room
    });

    // Handle disconnection and cleanup
    socket.on("disconnect", () => {
      // Clean up resources when a peer disconnects
    });
  });

  return io;
}
```

### 3. WebRTC Stream Manager (`src/app/(streams)/live-streams/[id]/components/WebRTCStreamManager.tsx`)

This React component handles all client-side WebRTC operations:

- Media device selection and access
- Socket.IO connection for signaling
- MediaSoup device initialization
- Transport creation and connection
- Media track production and consumption
- UI rendering for video/audio elements
- Error handling and reconnection logic

Key features include:

```tsx
// Component structure
const WebRTCStreamManager: React.FC<WebRTCStreamManagerProps> = ({
  streamId,
  userId,
  username,
  isStreamer,
  isCameraOn,
  isMicrophoneOn,
  isAnonymous,
  onConnectionError,
  onMediaError,
}) => {
  // State for WebRTC and media
  const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
  const [device, setDevice] = useState<MediasoupClient.Device | null>(null);
  const [producerTransport, setProducerTransport] =
    useState<MediasoupClient.Transport | null>(null);
  const [consumerTransport, setConsumerTransport] =
    useState<MediasoupClient.Transport | null>(null);
  const [videoProducer, setVideoProducer] =
    useState<MediasoupClient.Producer | null>(null);
  const [audioProducer, setAudioProducer] =
    useState<MediasoupClient.Producer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{
    [id: string]: MediaStream;
  }>({});
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  // Effect for initiating connection
  useEffect(() => {
    attemptConnection();
    return () => {
      cleanup();
    };
  }, [streamId, userId, isStreamer]);

  // Socket connection function
  const connectSocket = () => {
    // Connect to Socket.IO with stream and user info
  };

  // MediaSoup device loading
  const loadDevice = async () => {
    // Load MediaSoup device with router capabilities
  };

  // Media acquisition
  const getMedia = async () => {
    // Get user media (camera/microphone)
  };

  // Transport setup functions
  const setupProducerTransport = async () => {
    // Create and set up producer transport
  };

  const setupConsumerTransport = async () => {
    // Create and set up consumer transport
  };

  // Producing media
  const publishTracks = async () => {
    // Publish audio and video tracks
  };

  // Consuming media
  const subscribeToTracks = async (producerId: string) => {
    // Subscribe to remote tracks
  };

  // Render function
  return (
    <div className="webrtc-stream-manager">
      {/* Local video */}
      {isStreamer && localStream && (
        <video
          ref={(ref) => {
            if (ref) ref.srcObject = localStream;
          }}
          autoPlay
          muted
          playsInline
        />
      )}

      {/* Remote videos */}
      {Object.entries(remoteStreams).map(([id, stream]) => (
        <video
          key={id}
          ref={(ref) => {
            if (ref) ref.srcObject = stream;
          }}
          autoPlay
          playsInline
        />
      ))}

      {/* Device selection UI */}
      {isStreamer && (
        <DeviceSelector
          onVideoDeviceSelected={(deviceId) => {
            // Handle video device selection
          }}
          onAudioDeviceSelected={(deviceId) => {
            // Handle audio device selection
          }}
        />
      )}

      {/* Connection state UI */}
      <ConnectionStatus state={connectionState} />
    </div>
  );
};
```

### 4. Live Stream Page (`src/app/(streams)/live-streams/[id]/page.tsx`)

This page component is responsible for:

- Fetching stream details from the backend
- Managing stream lifecycle (start/stop)
- Handling user interactions
- Rendering the WebRTCStreamManager and other components
- Managing UI state for camera, microphone, etc.

Structure:

```tsx
export default function LiveStreamPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [stream, setStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user } = useAuth();
  const isStreamer = stream?.userId === user?.id;

  // Fetch stream details
  useEffect(() => {
    fetchStreamDetails(id)
      .then((data) => {
        setStream(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, [id]);

  // Start stream
  const handleStartStream = async () => {
    try {
      await startStream(id);
      fetchStreamDetails(id).then(setStream);
    } catch (err) {
      setError(err);
    }
  };

  // End stream
  const handleEndStream = async () => {
    try {
      await endStream(id);
      fetchStreamDetails(id).then(setStream);
    } catch (err) {
      setError(err);
    }
  };

  // Toggle camera
  const handleToggleCamera = () => {
    setIsCameraOn((prev) => !prev);
  };

  // Toggle microphone
  const handleToggleMicrophone = () => {
    setIsMicrophoneOn((prev) => !prev);
  };

  // Handle WebRTC errors
  const handleConnectionError = (error) => {
    console.error("WebRTC connection error:", error);
    setError(error);
  };

  return (
    <div className="live-stream-page">
      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorDisplay error={error} />
      ) : (
        <>
          <StreamHeader
            title={stream.title}
            streamer={stream.user.username}
            status={stream.status}
          />

          <WebRTCStreamManager
            streamId={id}
            userId={user?.id}
            username={user?.username}
            isStreamer={isStreamer}
            isCameraOn={isCameraOn}
            isMicrophoneOn={isMicrophoneOn}
            isAnonymous={!user}
            onConnectionError={handleConnectionError}
          />

          {isStreamer && (
            <StreamControls
              isLive={stream.status === "LIVE"}
              onStartStream={handleStartStream}
              onEndStream={handleEndStream}
              onToggleCamera={handleToggleCamera}
              onToggleMicrophone={handleToggleMicrophone}
              isCameraOn={isCameraOn}
              isMicrophoneOn={isMicrophoneOn}
            />
          )}

          <ProductListing
            streamId={id}
            isStreamer={isStreamer}
            products={stream.products}
          />

          <StreamChat
            streamId={id}
            userId={user?.id}
            username={user?.username}
            isAnonymous={!user}
          />
        </>
      )}
    </div>
  );
}
```

### 5. Database Models (Prisma Schema)

The main entities for the live streaming feature include:

```prisma
// Live Stream model
model LiveStream {
  id          String      @id @default(cuid())
  title       String
  description String?
  status      StreamStatus @default(PENDING)
  startTime   DateTime?
  endTime     DateTime?
  thumbnailUrl String?
  userId      String      // Streamer's user ID
  user        User        @relation(fields: [userId], references: [id])
  products    Product[]
  listings    Listing[]   // Products listed during the stream
  bids        Bid[]
  messages    Message[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

// Listing model (products being auctioned during stream)
model Listing {
  id          String      @id @default(cuid())
  streamId    String
  stream      LiveStream  @relation(fields: [streamId], references: [id])
  productId   String
  product     Product     @relation(fields: [productId], references: [id])
  startPrice  Float
  status      ListingStatus @default(ACTIVE)
  countdownDuration Int?   // In seconds
  countdownStartTime DateTime?
  countdownEndTime   DateTime?
  winnerId    String?
  winner      User?       @relation("WinningBids", fields: [winnerId], references: [id])
  backupBuyer1Id String?
  backupBuyer1 User?      @relation("BackupBids1", fields: [backupBuyer1Id], references: [id])
  backupBuyer2Id String?
  backupBuyer2 User?      @relation("BackupBids2", fields: [backupBuyer2Id], references: [id])
  bids        Bid[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

// Bid model
model Bid {
  id          String      @id @default(cuid())
  amount      Float
  streamId    String
  stream      LiveStream  @relation(fields: [streamId], references: [id])
  listingId   String
  listing     Listing     @relation(fields: [listingId], references: [id])
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  createdAt   DateTime    @default(now())
}

// StreamStatus enum
enum StreamStatus {
  PENDING
  LIVE
  ENDED
  CANCELLED
}

// ListingStatus enum
enum ListingStatus {
  ACTIVE
  COUNTDOWN
  COMPLETED
  CANCELLED
}
```

### 6. Logging System (`src/lib/logger.ts`)

The application uses a centralized logging system to ensure consistent logging across all components:

```typescript
// Logging levels
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

// Current log level from environment or default based on environment
const CURRENT_LOG_LEVEL =
  process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;

// Main logging function
export function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: any
) {
  if (level >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelString = LogLevel[level];
    console.log(
      `[${timestamp}] [${levelString}] [${context}] ${message}`,
      data ? data : ""
    );
  }
}

// Logger object with convenience methods
export const logger = {
  trace: (context: string, message: string, data?: any) =>
    log(LogLevel.TRACE, context, message, data),
  debug: (context: string, message: string, data?: any) =>
    log(LogLevel.DEBUG, context, message, data),
  info: (context: string, message: string, data?: any) =>
    log(LogLevel.INFO, context, message, data),
  warn: (context: string, message: string, data?: any) =>
    log(LogLevel.WARN, context, message, data),
  error: (context: string, message: string, data?: any) =>
    log(LogLevel.ERROR, context, message, data),
};
```

## Architecture Diagram

```
                    HTTP/REST API
User Interface <----------------> Next.js API Routes <-------> Database (MySQL/PostgreSQL)
     |                                  |                           |
     |                                  |                           |
     |          WebSocket (Socket.IO)   |                           |
     |<---------------------------> Socket Handler                  |
     |                               |                              |
     |          WebRTC Media         |                              |
     |<---------------------------> MediaSoup <-----------------> Storage
                                     |
                                TURN Server
                           (for NAT traversal)
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
- `MEDIASOUP-SETUP.md` - MediaSoup configuration and troubleshooting
- `WEBRTC-TROUBLESHOOTING.md` - WebRTC specific troubleshooting guide
- `LOGGING.md` - Logging standards and best practices
- `LIVE-STREAM.md` - Live streaming feature documentation
- `AUTH.md` - Authentication flow and implementation details
- `API.md` - API documentation and usage examples
- `ENV.md` - Environment variables reference
- `MIGRATION.md` - Guides for version migrations
- `PRODUCTS.md` - Product management documentation

## Conclusion

The BidPazar application follows a modern full-stack architecture using Next.js 15 with App Router, integrating real-time features through Socket.IO and WebRTC (MediaSoup). The codebase is organized to maintain clear separation of concerns while enabling seamless integration between frontend and backend functionality.
