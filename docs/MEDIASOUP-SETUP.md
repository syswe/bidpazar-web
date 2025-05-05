# MediaSoup WebRTC Setup Guide

This document provides instructions for setting up and using the MediaSoup WebRTC streaming system in BidPazar.

## Overview

BidPazar uses MediaSoup, a powerful WebRTC SFU (Selective Forwarding Unit) for live streaming. The implementation enables:

- Low-latency, high-quality video streaming
- Multiple viewers with optimized server resources
- Device selection for streamer (camera, microphone)
- Chat during live streams
- Mobile-friendly TikTok-style vertical video interface

## Quick Start

To start development with MediaSoup enabled:

```bash
# Start the MediaSoup initialization script and Next.js dev server
npm run dev:mediasoup

# Or start MediaSoup separately if needed
npm run mediasoup:start
npm run dev
```

## Requirements

- Node.js 18+ (20.x recommended)
- For macOS: Administrator access (for port configuration)
- For production: Public IP address or TURN server

## Configuration

The MediaSoup configuration is managed through environment variables in `.env`:

```
# WebRTC NAT Traversal 
NEXT_PUBLIC_TURN_SERVER_URL=turn:192.168.1.5:3478
NEXT_PUBLIC_TURN_USERNAME=bidpazar
NEXT_PUBLIC_TURN_PASSWORD=bidpazarpass
NEXT_PUBLIC_STUN_SERVER_URL=stun:192.168.1.5:3478

# MediaSoup Configuration
MEDIASOUP_ANNOUNCED_IP=192.168.1.5
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100
MEDIASOUP_WORKERS=1
```

Important settings:
- `MEDIASOUP_ANNOUNCED_IP`: Public IP address of your server (use private IP for local dev)
- `MEDIASOUP_MIN_PORT` and `MEDIASOUP_MAX_PORT`: UDP port range for WebRTC media
- `NEXT_PUBLIC_TURN_SERVER_URL`: TURN server for NAT traversal

## Troubleshooting

If you're experiencing issues with the WebRTC connection:

1. Check the browser console for error messages
2. Make sure the COTURN server is running: `docker logs bidpazar-coturn-1`
3. Verify that all required ports are open:
   - 3000: Next.js server
   - 3478: COTURN STUN/TURN server
   - 40000-40100: MediaSoup media ports
4. Test ICE connectivity using the diagnostic tool: `npm run mediasoup:test-coturn`
5. See [WEBRTC-TROUBLESHOOTING.md](./WEBRTC-TROUBLESHOOTING.md) for detailed debugging steps

Common issues:

- WebSocket connection failures: Check that the Next.js server is running and accessible
- ICE connection failures: Verify COTURN server and network connectivity
- MediaSoup worker issues: Check for port conflicts or missing dependencies

## Advanced Configuration

### Production Setup

For production, you need:
1. A public IP address or domain
2. Proper firewall configuration for UDP ports 40000-40100
3. A TURN server for NAT traversal (if users are behind restrictive firewalls)

### Custom TURN Server

For users behind restrictive NATs, set up a dedicated TURN server:

1. Install [coturn](https://github.com/coturn/coturn)
2. Configure coturn with proper credentials
3. Update `.env` with TURN server details

## Useful Commands

```bash
# Run just the MediaSoup initialization
npm run mediasoup:start

# Run WebRTC diagnostics
npm run mediasoup:check

# Start development with MediaSoup
npm run dev:mediasoup

# Production start with MediaSoup
npm run start:mediasoup
```

## Architecture Diagram

```
┌─────────────┐      WebRTC      ┌─────────────┐
│   Streamer  │<---------------->│  MediaSoup  │
└─────────────┘     (Producer)   │   Server    │
                                 │             │
┌─────────────┐      WebRTC      │             │
│   Viewer 1  │<---------------->│  (Next.js)  │
└─────────────┘     (Consumer)   │             │
                                 │             │
┌─────────────┐      WebRTC      │             │
│   Viewer 2  │<---------------->│             │
└─────────────┘     (Consumer)   └─────────────┘
```

## References

- [MediaSoup Documentation](https://mediasoup.org/documentation/)
- [WebRTC Overview](https://webrtc.org/)
- [Socket.IO Documentation](https://socket.io/docs/) 