# BidPazar Live Streaming Architecture

This document provides an overview of the live streaming system implemented in BidPazar, a real-time e-commerce platform with integrated video streaming capabilities.

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Overview](#architecture-overview)
3. [Server-Side Implementation](#server-side-implementation)
   - [Socket.IO Server](#socketio-server)
   - [MediaSoup Configuration](#mediasoup-configuration)
   - [Live Stream API](#live-stream-api)
4. [Client-Side Implementation](#client-side-implementation)
   - [WebRTC Stream Manager](#webrtc-stream-manager)
   - [HLS Fallback](#hls-fallback)
   - [Device Selection](#device-selection)
5. [Stream Workflow](#stream-workflow)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)
8. [Implementation Checklist](#implementation-checklist)

## Technology Stack

BidPazar's live streaming functionality is built with the following technologies:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend Framework | Next.js 15.2.2 | React-based web application framework |
| WebRTC Library | mediasoup-client (3.9.5) | Client-side WebRTC implementation |
| Server-Side WebRTC | mediasoup (3.15.7) | SFU (Selective Forwarding Unit) server |
| Real-time Communication | Socket.IO (4.8.1 client, 4.7.4 server) | Bidirectional event-based communication |
| Fallback Streaming | HLS.js (1.6.2) | HTTP Live Streaming client |
| WebRTC Connection | TURN/STUN servers | NAT traversal for peer connections |
| Video/Audio Processing | Browser Media APIs | Camera and microphone access |

## Architecture Overview

The BidPazar live streaming system implements a hybrid architecture that combines:

1. **WebRTC with MediaSoup SFU**: Primary streaming method offering low-latency, high-quality video
2. **HLS Fallback**: Secondary method with higher latency but better compatibility
3. **Socket.IO Signaling**: Manages WebRTC connection establishment and real-time events

The architecture follows a client-server model where:
- Streamers produce media streams that are routed through the MediaSoup SFU
- Viewers consume these streams via WebRTC or HLS, depending on capability
- A signaling server handles coordination between streamers, viewers, and the SFU

## Server-Side Implementation

### Socket.IO Server

Location: `src/app/api/rtc/socket/route.ts`

The Socket.IO server is implemented as a Next.js API route that:
- Creates a persistent WebSocket connection at `/api/rtc/socket`
- Authenticates users via JWT tokens
- Manages room-based communication for stream channels
- Forwards signaling messages between peers
- Handles connection lifecycle events

Key features:
- Authentication middleware verifies user tokens
- Room-based event broadcasting
- Real-time chat message distribution
- WebRTC signaling message forwarding

### MediaSoup Configuration

Location: `src/app/api/rtc/mediasoup/config.ts`

MediaSoup is configured with optimized settings for low-latency streaming:

- **Audio Codecs**: Opus with stereo and in-band FEC enabled
- **Video Codecs**: VP8, VP9, and H.264 with optimized bitrate settings
- **WebRTC Transport**: Configured for both UDP and TCP with preference for UDP
- **Workers**: Scalable multi-worker setup based on environment configuration

The configuration includes extensive diagnostics and validation to ensure proper setup across different environments.

### Live Stream API

The platform includes a RESTful API to manage live streams:

- **GET /api/live-streams**: List all streams (filterable by status)
- **GET /api/live-streams/[id]**: Fetch details for a specific stream
- **POST /api/live-streams**: Create a new scheduled stream
- **POST /api/live-streams/[id]/start**: Start a scheduled stream
- **DELETE /api/live-streams/[id]**: Delete a stream

Each stream has a lifecycle managed through status transitions:
1. `SCHEDULED` - Initial state when created
2. `LIVE` - Active streaming state
3. `ENDED` - Completed stream
4. `CANCELLED` - Cancelled without streaming

## Client-Side Implementation

### WebRTC Stream Manager

Location: `src/app/(streams)/live-streams/[id]/components/WebRTCStreamManager.tsx`

The `WebRTCStreamManager` component is the central piece of the client-side streaming implementation. It handles:

- WebRTC connection establishment and management
- Media device access and stream production (for streamers)
- Stream consumption (for viewers)
- Connection reliability with automatic reconnection
- Fallback mechanism to HLS when WebRTC fails

The component uses Socket.IO for signaling and mediasoup-client for WebRTC:

```javascript
// Socket.IO connection establishment
const ws = io(wsUrl, {
  path: wsPath,
  query: {
    streamId: streamIdRef.current,
    userId: userIdRef.current,
    username: usernameRef.current,
    token: tokenRef.current || '',
    isStreamer: isStreamerRef.current ? '1' : '0'
  },
  transports: ['websocket', 'polling']
});
```

For streamers, the component:
1. Accesses media devices (camera/microphone)
2. Creates a producer transport with MediaSoup
3. Produces audio and video streams
4. Sends media to the SFU server

For viewers, it:
1. Creates a consumer transport with MediaSoup
2. Consumes streams from the SFU server
3. Renders media in a video element
4. Falls back to HLS if WebRTC fails

### HLS Fallback

The WebRTCStreamManager implements an HLS fallback mechanism using the HLS.js library:

```javascript
// HLS fallback initialization
const initializeHlsFallback = useCallback(() => {
  if (!videoRef.current) return;
  
  // Check if HLS.js is supported
  if (!Hls.isSupported()) {
    console.error('[WebRTCStreamManager] HLS.js is not supported in this browser');
    setError('Your browser does not support modern streaming technologies');
    return;
  }
  
  // Construct HLS stream URL
  const hlsUrl = `${serverUrl}/hls/${streamId}/index.m3u8`;
  
  // Create new HLS instance with optimized settings for lower latency
  const hls = new Hls({
    maxBufferLength: 10,
    maxMaxBufferLength: 20,
    enableWorker: true,
    lowLatencyMode: true
  });
  
  hls.attachMedia(videoRef.current);
  hls.loadSource(hlsUrl);
});
```

This fallback activates automatically after WebRTC connection attempts fail, ensuring viewers can still watch streams even in challenging network conditions.

### Device Selection

Location: `src/app/(streams)/live-streams/[id]/components/DeviceSelector.tsx`

For streamers, the platform provides a device selection interface that:
- Lists available cameras and microphones
- Allows switching between devices during a stream
- Stores device preferences
- Provides visual confirmation of selected devices

## Stream Workflow

The typical workflow for a BidPazar live stream is:

1. **Stream Creation**:
   - Streamer creates a scheduled stream with title, description, and start time
   - System assigns a unique stream ID

2. **Stream Start**:
   - Streamer navigates to the stream page
   - Clicks "Start Stream" which calls the start API endpoint
   - System updates stream status to LIVE

3. **Media Connection**:
   - WebRTCStreamManager initializes Socket.IO connection
   - Requests camera and microphone access
   - Establishes WebRTC producer connection via MediaSoup

4. **Viewer Connection**:
   - Viewers navigate to the stream page
   - WebRTCStreamManager connects to Socket.IO
   - System establishes WebRTC consumer connection via MediaSoup
   - If WebRTC fails, falls back to HLS

5. **Stream Interaction**:
   - Real-time chat via Socket.IO
   - Product display and bidding interfaces
   - Viewer count updates

6. **Stream End**:
   - Streamer clicks "End Stream"
   - System updates stream status to ENDED
   - Disconnects all viewers

## Security Considerations

The platform implements several security measures:

1. **Authentication**: JWT-based authentication for API and Socket.IO connections
2. **Authorization**: Stream ownership verification before critical operations
3. **Secure WebRTC**: DTLS encryption for media streams
4. **Input Validation**: Zod schema validation for all API inputs
5. **TURN Server**: Secure relay for NAT traversal

## Troubleshooting

Common issues and solutions:

1. **"Connecting to stream..."** stuck state:
   - Check WebSocket endpoint configuration in .env file
   - Verify TURN/STUN server accessibility
   - Inspect browser console for connection errors

2. **No camera/microphone access**:
   - Ensure browser permissions are granted
   - Check if camera is in use by another application
   - Verify SSL configuration if running in production

3. **High latency**:
   - Check network conditions
   - Adjust MediaSoup bitrate settings
   - Consider disabling video for audio-only streams in poor network conditions

4. **Connection failures**:
   - Verify TURN server configuration
   - Check firewall settings that might block WebRTC
   - Ensure Socket.IO server is properly running

## Implementation Checklist

This checklist tracks the implementation status of various components and features of the BidPazar live streaming system:

### Server-Side Implementation

- [x] Socket.IO server setup in Next.js API route
- [x] Socket.IO authentication middleware with JWT
- [x] Socket.IO room-based event handling
- [x] MediaSoup worker initialization
- [x] MediaSoup router configuration
- [x] MediaSoup WebRTC transport creation
- [x] MediaSoup producer/consumer management
- [x] Live Stream API endpoints for CRUD operations
- [x] Stream status management (SCHEDULED, LIVE, ENDED)
- [ ] HLS server implementation (in progress)
- [ ] Load balancing for multiple MediaSoup workers (in progress)
- [ ] Recording functionality for streams (planned)
- [ ] Analytics collection for stream metrics (planned)

### Client-Side Implementation

- [x] WebRTCStreamManager component
- [x] Socket.IO client connection
- [x] MediaSoup client integration
- [x] WebRTC producer setup for streamers
- [x] WebRTC consumer setup for viewers
- [x] Camera/microphone access management
- [x] Device selection interface
- [x] HLS fallback implementation
- [x] Stream controls (mute, camera toggle)
- [x] Error handling and automatic reconnection
- [ ] Bandwidth adaptation for varying network conditions (in progress)
- [ ] Screen sharing functionality (in progress)
- [ ] Mobile-specific optimizations (planned)

### Configuration & Environment

- [x] TURN/STUN server setup
- [x] Environment variables for media server settings
- [x] WebRTC/HLS quality parameters
- [x] Proper error logging
- [ ] Content Delivery Network integration for HLS (in progress)
- [ ] Production-ready TURN server with proper scaling (planned)

### Security

- [x] JWT authentication for API and WebSocket
- [x] Stream ownership verification
- [x] Input validation with Zod schemas
- [x] DTLS encryption for WebRTC streams
- [ ] Rate limiting for API endpoints (in progress)
- [ ] Content moderation capabilities (planned)

### Testing & Quality Assurance

- [x] Basic functional testing of streaming
- [x] Multi-browser compatibility testing
- [ ] Automated tests for WebRTC components (in progress)
- [ ] Load testing for concurrent viewers (in progress)
- [ ] Network condition simulation testing (planned)
- [ ] End-to-end testing suite (planned)

### Documentation & Maintenance

- [x] Architecture documentation (this document)
- [x] Troubleshooting guide
- [ ] API documentation with examples (in progress)
- [ ] Regular security audits (planned)
- [ ] Performance monitoring setup (planned)
