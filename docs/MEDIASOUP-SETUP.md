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

## Simplification Options

If you're having issues with the current implementation, consider these simplification approaches:

### 1. Use a Simpler WebRTC API

MediaSoup is powerful but complex. For simpler use cases, consider alternatives:

- **Simple-Peer**: A simpler WebRTC implementation
- **PeerJS**: Abstracts much of WebRTC complexity
- **Agora.io or Twilio Video**: Managed services that handle all WebRTC complexity

### 2. Separate WebRTC Server

Instead of integrating MediaSoup with your Next.js app:

1. Create a separate MediaSoup server that only handles WebRTC
2. Keep your Next.js app focused on the UI and business logic
3. Communicate between them via HTTP APIs

### 3. Replace with HLS/DASH for One-to-Many Streaming

If your use case is primarily one broadcaster to many viewers:

- Replace WebRTC with HLS or DASH streaming
- Much simpler to implement and scale
- Higher latency (5-30 seconds) but more reliable for large audiences
- Can use services like AWS MediaLive/MediaPackage or Mux.com

## Troubleshooting 

For detailed troubleshooting steps, see [WEBRTC-TROUBLESHOOTING.md](./WEBRTC-TROUBLESHOOTING.md).

Common issues with quick fixes:

1. **No WebRTC connection**: Check `MEDIASOUP_ANNOUNCED_IP` matches your actual server IP
2. **WebSocket connection fails**: Ensure Socket.IO is properly configured in server.js
3. **Permission errors**: Make sure the server has permission to bind to the UDP ports

## Improving MediaSoup Implementation

### Add Better Error Handling

Modify `socketHandler.ts` to provide better error handling:

```typescript
// Example: Improved MediaSoup worker initialization
async function startMediasoupWorker() {
  if (mediasoupWorker && !mediasoupWorker.closed) {
    logger.info('[MediaSoup] Worker already running.');
    return mediasoupWorker;
  }
  
  // Validate critical configuration
  if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
    logger.error('[MediaSoup] CRITICAL: MEDIASOUP_ANNOUNCED_IP not configured!');
    throw new Error('MEDIASOUP_ANNOUNCED_IP must be set to your server IP address');
  }
  
  try {
    logger.info('[MediaSoup] Creating Mediasoup worker...');
    mediasoupWorker = await mediasoup.createWorker(mediasoupAppConfig.worker);
    
    // Test if ports are available
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[MediaSoup] Testing UDP port availability in range ${mediasoupAppConfig.worker.rtcMinPort}-${mediasoupAppConfig.worker.rtcMaxPort}...`);
      // Add port testing logic here
    }
    
    mediasoupWorker.on('died', (error) => {
      logger.error('[MediaSoup] Worker died.', error);
      mediasoupWorker = null;
      // Attempt to restart worker instead of exiting
      setTimeout(() => {
        logger.info('[MediaSoup] Attempting to restart worker...');
        startMediasoupWorker().catch(err => {
          logger.error('[MediaSoup] Failed to restart worker, exiting.', err);
          process.exit(1);
        });
      }, 2000);
    });
    
    logger.info('[MediaSoup] Worker created successfully.');
    return mediasoupWorker;
  } catch (error) {
    logger.error('[MediaSoup] Failed to create Mediasoup worker:', error);
    throw error;
  }
}
```

### Add Diagnostics API

Add a diagnostics endpoint to help troubleshoot:

```typescript
// Example: Add this to your API routes
// GET /api/diagnostics/webrtc
export async function GET(req: NextRequest) {
  try {
    const workerStatus = mediasoupWorker && !mediasoupWorker.closed ? 'running' : 'stopped';
    const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || 'not configured';
    const portRange = `${process.env.MEDIASOUP_MIN_PORT || '40000'}-${process.env.MEDIASOUP_MAX_PORT || '40100'}`;
    const rooms = Array.from(rooms.keys());
    
    return NextResponse.json({
      mediasoup: {
        version: require('mediasoup/package.json').version,
        workerStatus,
        workerPid: mediasoupWorker?.pid || null,
        config: {
          announcedIp,
          portRange,
          logLevel: process.env.MEDIASOUP_LOG_LEVEL || 'warn',
        },
      },
      socketio: {
        connections: io?.engine?.clientsCount || 0,
      },
      rooms: {
        count: rooms.length,
        ids: rooms,
      },
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Diagnostics failed', message: error.message }, { status: 500 });
  }
}
```

## Architecture Diagram

```
                       Signaling (Socket.IO on HTTP server)
 STREAMER ------------=======================================
    |                     WebRTC (UDP via Mediasoup)         SERVER (Next.js/Node.js)
    |                <-------------------------------------> Media Transports
    |                (Producer: sends media)                 (Mediasoup Router in socketHandler.ts)
    |                                                        |   ^ 
    |                                                        |   | Signaling
 CLIENT <-----------========================================|---|
                       WebRTC (UDP via Mediasoup)            |   | Media
                   <-------------------------------------> Media Transports
                   (Consumer: receives media)                V   |
                                                          CLIENTS
```

## Implementation Details

The MediaSoup implementation in BidPazar involves several key components:

1. **Custom Server**: `server.js` sets up both the Next.js application and the Socket.IO server, ensuring they share the same HTTP server. It also initializes the MediaSoup worker.

2. **Socket Handler**: `src/lib/socket/socketHandler.ts` contains:
   - MediaSoup worker creation and management
   - Room creation and management for each stream
   - WebRTC transport handling (creation, connection)
   - Producer/consumer management
   - Socket.IO event handlers for signaling

3. **Client-Side Integration**: The React components in `src/app/(streams)/live-streams/[id]/components/` handle the client-side WebRTC connection, including:
   - `WebRTCStreamManager.tsx` for managing the WebRTC connection
   - `StreamDiagnostics.tsx` for debugging connection issues
   - Various UI components for the streaming interface

## References

- [Mediasoup Documentation](https://mediasoup.org/documentation/v3/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [WebRTC Overview](https://webrtc.org/) 
- [Public STUN Servers List](https://gist.github.com/zziuni/3741933)
- [Coturn TURN Server Setup Guide](https://github.com/coturn/coturn/wiki/turnserver) 