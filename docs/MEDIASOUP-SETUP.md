# MediaSoup WebRTC Setup Guide

This document provides instructions for setting up and using the MediaSoup WebRTC streaming system in BidPazar, which is integrated into the main Next.js application server.

## Overview

BidPazar uses MediaSoup, a powerful WebRTC SFU (Selective Forwarding Unit), for live streaming. The Mediasoup logic is handled primarily by `src/lib/socket/socketHandler.ts` and initialized by the custom server `server.js`. This enables:

- Low-latency, high-quality video streaming via WebRTC.
- Multiple viewers with optimized server resources using SFU architecture.
- Signaling for WebRTC handled via Socket.IO.
- Chat during live streams.
- Mobile-friendly TikTok-style vertical video interface.

## Quick Start

To start development with Mediasoup enabled (it's part of the main server):

```bash
# Start the Next.js development server (which includes Mediasoup initialization)
npm run dev

# For better debugging, use enhanced logging:
DEBUG=mediasoup*,socket.io*,engine* npm run dev
```

## Requirements

- Node.js 18+ (20.x recommended)
- C/C++ compiler toolchain for MediaSoup
  - For macOS: `xcode-select --install`
  - For Ubuntu/Debian: `apt-get install -y build-essential python3`
  - For Windows: Visual Studio Build Tools with C++ workload
- For macOS/Linux: Ensure the user running the application has permissions for the configured UDP port range.
- For production: A server with a public IP address and properly configured firewall.

## Configuration

### Essential Environment Variables

The minimal required configuration in your `.env` file:

```dotenv
# Required MediaSoup configuration
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=your.server.ip.address  # Critical setting - your server's accessible IP
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100

# At least one STUN server (even a public one works)
NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
```

### Full Configuration Reference

These are all the available options used by `src/lib/socket/socketHandler.ts`:

```dotenv
# MediaSoup Server Configuration
MEDIASOUP_LISTEN_IP=0.0.0.0 # IP address for Mediasoup to listen on (usually 0.0.0.0 for local/docker)
MEDIASOUP_ANNOUNCED_IP=your.server.ip.address # Your server's public IP, or local network IP for dev
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100 # UDP port range for WebRTC media

# Mediasoup Logging
MEDIASOUP_LOG_LEVEL=warn # Worker log level: debug, warn, error, none
MEDIASOUP_LOG_TAGS=info,ice,dtls,rtp,srtp,rtcp # Comma-separated list of log tags

# WebRTC NAT Traversal (STUN/TURN - for production environments)
NEXT_PUBLIC_TURN_SERVER_URL=turn:your_turn_server.com:3478
NEXT_PUBLIC_TURN_USERNAME=your_turn_username
NEXT_PUBLIC_TURN_PASSWORD=your_turn_password
NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
```

### Configuration Guidelines

#### MEDIASOUP_ANNOUNCED_IP

This is the **most critical setting** and must be configured correctly:

- **For local development**: Use your machine's local network IP address (e.g., `192.168.1.x`), not `localhost` or `127.0.0.1`.

  ```bash
  # macOS/Linux - Find your local IP
  ifconfig | grep "inet " | grep -v 127.0.0.1

  # Windows - Find your local IP
  ipconfig | findstr /i "IPv4"
  ```

- **For production**: Use your server's public IP address.
  ```bash
  # Find your public IP
  curl https://api.ipify.org
  ```

#### Port Range

Ensure the UDP port range is:

1. Open on your firewall
2. Not conflicting with other services
3. Large enough for your expected number of connections

## Development vs Production Setup

### Development Setup (Simplified)

For local development:

1. Configure `.env` with your local network IP:

   ```
   MEDIASOUP_LISTEN_IP=0.0.0.0
   MEDIASOUP_ANNOUNCED_IP=192.168.1.X  # Your actual local network IP
   MEDIASOUP_MIN_PORT=40000
   MEDIASOUP_MAX_PORT=40100
   NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Access via your local network IP (not localhost):

   ```
   http://192.168.1.X:3000/live-streams/[id]
   ```

4. Run the client on the same network as the server.

### Production Setup

For a robust production environment:

1. Server with static public IP address.
2. Proper firewall configuration:

   ```bash
   # Example for UFW on Ubuntu
   sudo ufw allow 3000/tcp  # For Next.js/Socket.IO
   sudo ufw allow 40000:40100/udp  # For MediaSoup WebRTC
   ```

3. Production `.env` configuration:

   ```
   MEDIASOUP_LISTEN_IP=0.0.0.0
   MEDIASOUP_ANNOUNCED_IP=your.server.public.ip
   MEDIASOUP_MIN_PORT=40000
   MEDIASOUP_MAX_PORT=40100
   MEDIASOUP_LOG_LEVEL=warn

   # TURN server recommended for production
   NEXT_PUBLIC_STUN_SERVER_URL=stun:your-stun-server.com:3478
   NEXT_PUBLIC_TURN_SERVER_URL=turn:your-turn-server.com:3478
   NEXT_PUBLIC_TURN_USERNAME=your_secure_username
   NEXT_PUBLIC_TURN_PASSWORD=your_secure_password
   ```

4. NGINX or similar as a reverse proxy (optional but recommended):

   ```nginx
   # Sample NGINX configuration
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

5. Run with PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start npm --name "bidpazar" -- run start
   ```

## Enhanced Debugging and Troubleshooting

### Server-Side Debugging

Use environment variables to control logging verbosity:

```bash
# Show all MediaSoup logs
DEBUG=mediasoup* npm run dev

# Show both MediaSoup and Socket.IO logs (recommended)
DEBUG=mediasoup*,socket.io* npm run dev

# Focused debugging on specific components
DEBUG=mediasoup:WARN*,mediasoup:ERROR*,socket.io:error* npm run dev
```

### Client-Side Debugging

1. Enable browser WebRTC logging:

   ```javascript
   // In Chrome, open DevTools console and run:
   webrtc.debug.enable("*");
   ```

2. Use browser's WebRTC-internals:

   - Chrome: navigate to `chrome://webrtc-internals/`
   - Firefox: navigate to `about:webrtc`

3. Check for these common errors in browser console:
   - ICE connection failures
   - Device enumeration errors
   - Transport connection issues
   - Missing or invalid SDP messages

### Network Testing

1. **Test UDP connectivity** between client and server:

   ```bash
   # On server
   nc -ul 40000

   # On client (replace SERVER_IP with your server's IP)
   nc -u SERVER_IP 40000
   ```

2. **Verify STUN/TURN** server connectivity:

   ```bash
   # Install stun-client
   npm install -g stun-client

   # Test STUN server
   stun stun.l.google.com:19302
   ```

3. **MediaSoup port availability check**:
   ```javascript
   // Add this to socketHandler.ts to test port availability
   async function testPortAvailability(min, max) {
     for (let port = min; port <= max; port++) {
       try {
         const server = dgram.createSocket("udp4");
         await new Promise((resolve, reject) => {
           server.on("error", reject);
           server.bind(port, "0.0.0.0", resolve);
         });
         server.close();
         console.log(`Port ${port} is available`);
       } catch (error) {
         console.error(`Port ${port} is NOT available:`, error.message);
       }
     }
   }
   ```

### Common Issues and Solutions

#### 1. ICE Connection Failed

**Symptoms**: WebRTC connection never established, "ICE Failed" in console or webrtc-internals

**Causes and Solutions**:

- **Incorrect MEDIASOUP_ANNOUNCED_IP**:

  - Ensure it's the public IP for production or correct LAN IP for development
  - The client must be able to reach this IP directly

- **Firewall blocking UDP ports**:
  - Verify UDP port range is open on server firewall
  - Check for corporate firewalls or VPNs on client side
- **STUN/TURN servers unreachable**:
  - Test STUN connectivity with a tool like stun-client
  - Ensure TURN credentials are correct
  - Try adding multiple STUN/TURN servers for redundancy

#### 2. Socket.IO Connection Issues

**Symptoms**: Unable to connect to Socket.IO server, connection drops frequently

**Causes and Solutions**:

- **Incorrect Socket.IO URL or path**:

  - Check that client URL matches server host/port/path
  - Ensure WebSocket upgrades are properly handled in your server.js

- **CORS issues**:

  - Verify CORS settings in Socket.IO initialization
  - Check for blocked requests in browser console

- **Middleware intercepting WebSocket connections**:
  - Ensure Next.js middleware is configured to bypass Socket.IO paths

#### 3. Media Permission or Device Issues

**Symptoms**: No video/audio producers created, getUserMedia errors

**Causes and Solutions**:

- **Missing camera/microphone permissions**:

  - Ensure proper permission prompts and handling
  - Check site permissions in browser settings

- **Invalid constraints in getUserMedia call**:

  - Validate video/audio constraints
  - Try with minimal constraints first

- **Incompatible browser or device**:
  - Check browser support with adapter.js
  - Test with latest Chrome/Firefox

## Improving MediaSoup Implementation

### Better Error Handling

Add more robust error handling to socketHandler.ts:

```typescript
// Example: Improved MediaSoup worker initialization
async function startMediasoupWorker() {
  if (mediasoupWorker && !mediasoupWorker.closed) {
    logger.info("[MediaSoup] Worker already running.");
    return mediasoupWorker;
  }

  // Validate critical configuration
  if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
    logger.error(
      "[MediaSoup] CRITICAL: MEDIASOUP_ANNOUNCED_IP not configured!"
    );
    throw new Error(
      "MEDIASOUP_ANNOUNCED_IP must be set to your server IP address"
    );
  }

  try {
    logger.info("[MediaSoup] Creating Mediasoup worker...");
    mediasoupWorker = await mediasoup.createWorker(mediasoupAppConfig.worker);

    mediasoupWorker.on("died", (error) => {
      logger.error("[MediaSoup] Worker died.", error);
      mediasoupWorker = null;
      // Attempt to restart worker instead of exiting
      setTimeout(() => {
        logger.info("[MediaSoup] Attempting to restart worker...");
        startMediasoupWorker().catch((err) => {
          logger.error("[MediaSoup] Failed to restart worker, exiting.", err);
          process.exit(1);
        });
      }, 2000);
    });

    return mediasoupWorker;
  } catch (error) {
    logger.error("[MediaSoup] Failed to create worker", error);
    throw error;
  }
}
```

### Health Monitoring

Add health checks to detect and recover from common issues:

```typescript
// Add to socketHandler.ts
function startHealthMonitoring() {
  setInterval(() => {
    // Check worker health
    if (!mediasoupWorker || mediasoupWorker.closed) {
      logger.warn(
        "[HealthCheck] MediaSoup worker not running, attempting restart"
      );
      startMediasoupWorker().catch((err) => {
        logger.error("[HealthCheck] Failed to restart worker", err);
      });
    }

    // Log active streams and connections
    const rooms = io.sockets.adapter.rooms;
    const streamRooms = Array.from(rooms.keys()).filter((room) =>
      room.startsWith("stream:")
    );

    logger.info("[HealthCheck] Active streams", {
      count: streamRooms.length,
      rooms: streamRooms,
      totalConnections: io.engine.clientsCount,
      totalSockets: io.sockets.sockets.size,
    });

    // Check for zombie rooms (rooms with no peers)
    streamRooms.forEach((room) => {
      const roomName = room.split(":")[1];
      const roomData = getRoom(roomName);
      if (roomData && (!roomData.peers || roomData.peers.size === 0)) {
        logger.warn("[HealthCheck] Found zombie room, cleaning up", {
          roomName,
        });
        rooms.delete(room);
      }
    });
  }, 60000); // Run every minute
}
```

### Fallback Mechanisms

Implement fallback options for environments where WebRTC might be challenging:

```typescript
// In WebRTCStreamManager.tsx
const attemptConnection = async () => {
  try {
    // Try WebRTC connection first
    await connectWebRTC();
  } catch (error) {
    logError("WebRTC connection failed, trying fallback", error);

    // Check if this is a known WebRTC blocker
    if (
      error.message.includes("ICE failed") ||
      error.message.includes("getUserMedia")
    ) {
      // Trigger fallback mechanism
      setUseFallback(true);
    } else {
      // For other errors, just report the problem
      onConnectionError(error);
    }
  }
};

// Fallback component (simplified HLS or image-based)
const FallbackViewer = () => {
  return (
    <div className="fallback-viewer">
      <h3>Using compatible viewing mode</h3>
      {/* HLS player or image refresh based streaming */}
      {isHLSSupported ? (
        <HLSPlayer url={`/api/live-streams/${streamId}/hls/index.m3u8`} />
      ) : (
        <PeriodicImageRefresh url={`/api/live-streams/${streamId}/snapshot`} />
      )}
    </div>
  );
};
```

## Alternative WebRTC Implementations

If you encounter persistent issues with MediaSoup, consider these alternatives:

### 1. Simple Peer-to-Peer for Small Streams (< 5 viewers)

Use simple-peer for direct P2P connections:

```javascript
import SimplePeer from "simple-peer";

// Basic setup (streamer side)
const peer = new SimplePeer({
  initiator: true,
  stream: yourMediaStream,
  trickle: false,
});

peer.on("signal", (signal) => {
  // Send signal to viewer via your signaling channel
  socket.emit("signal", { signal, to: viewerId });
});

// Viewer side
socket.on("signal", async ({ signal, from }) => {
  const peer = new SimplePeer({
    initiator: false,
    trickle: false,
  });

  peer.on("stream", (stream) => {
    // Add stream to video element
    videoElement.srcObject = stream;
  });

  peer.signal(signal);
});
```

### 2. Managed Services

For critical production environments, consider these managed services:

- **Agora.io**: Provides a managed WebRTC solution with global distribution
- **Twilio Video**: Robust WebRTC API with good documentation and reliability
- **Amazon IVS**: Low-latency streaming service with WebRTC-like performance

## Performance Optimization

### 1. Bandwidth Management

Add adaptive bitrate handling:

```typescript
// In WebRTCStreamManager.tsx
const handleBandwidthEstimate = (transport, stats) => {
  if (!stats || !stats.availableOutgoingBitrate) return;

  const availableBitrate = stats.availableOutgoingBitrate;
  logger.debug("Bandwidth estimate", { availableBitrate });

  // Adjust video quality based on available bandwidth
  if (videoProducer && videoProducer.track) {
    const track = videoProducer.track;
    const sender = transport.getSenders().find((s) => s.track === track);

    if (sender) {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];

      // Adjust max bitrate based on available bandwidth
      if (availableBitrate < 500000) {
        // 500 kbps
        params.encodings[0].maxBitrate = 250000; // 250 kbps
      } else if (availableBitrate < 1000000) {
        // 1 Mbps
        params.encodings[0].maxBitrate = 500000; // 500 kbps
      } else {
        params.encodings[0].maxBitrate = 1000000; // 1 Mbps
      }

      sender.setParameters(params).catch((error) => {
        logger.error("Failed to set sender parameters", error);
      });
    }
  }
};
```

### 2. Resource Conservation

Optimize MediaSoup worker usage:

```typescript
// In socketHandler.ts
const mediasoupWorkers = [];
let nextWorkerIndex = 0;

// Create multiple workers (one per CPU core)
async function createMediasoupWorkers() {
  const numWorkers = os.cpus().length;
  logger.info(`Creating ${numWorkers} mediasoup Workers...`);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: mediasoupAppConfig.worker.logLevel,
      logTags: mediasoupAppConfig.worker.logTags,
      rtcMinPort: mediasoupAppConfig.worker.rtcMinPort,
      rtcMaxPort: mediasoupAppConfig.worker.rtcMaxPort,
    });

    worker.on("died", () => {
      logger.error(`mediasoup Worker ${i} died, exiting...`);
      setTimeout(() => process.exit(1), 2000);
    });

    mediasoupWorkers.push(worker);
  }
}

// Get next worker in round-robin fashion
function getMediasoupWorker() {
  const worker = mediasoupWorkers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % mediasoupWorkers.length;
  return worker;
}
```

## Load Testing

Before deploying to production, test your system under load:

```javascript
// Simple load testing script
const { io } = require("socket.io-client");
const numViewers = 50;
const viewers = [];

async function simulateViewer(index) {
  const socket = io("https://your-server.com", {
    query: {
      streamId: "test-stream-id",
      userId: `test-user-${index}`,
      username: `Viewer ${index}`,
      isStreamer: false,
      isAnonymous: false,
    },
  });

  socket.on("connect", () => {
    console.log(`Viewer ${index} connected`);
  });

  socket.on("error", (error) => {
    console.error(`Viewer ${index} error:`, error);
  });

  viewers.push(socket);
}

// Start viewers
for (let i = 0; i < numViewers; i++) {
  simulateViewer(i);
  // Stagger connections to avoid overwhelming the server
  await new Promise((resolve) => setTimeout(resolve, 200));
}

// Clean up after test
process.on("SIGINT", () => {
  console.log("Cleaning up connections...");
  viewers.forEach((socket) => socket.disconnect());
  process.exit();
});
```

For more detailed troubleshooting steps, see [WEBRTC-TROUBLESHOOTING.md](./WEBRTC-TROUBLESHOOTING.md).
