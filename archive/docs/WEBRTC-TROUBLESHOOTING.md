# WebRTC Troubleshooting Guide

This guide provides solutions for common WebRTC and MediaSoup issues in your BidPazar application.

## Quick Setup

The fastest way to set up your development environment for WebRTC:

```bash
# Run the automated setup script
npm run setup-webrtc

# Restart your development server
npm run dev
```

Then visit: `http://localhost:3000/live-streams/diagnostics` to test your connection.

## Understanding the Connection Flow

WebRTC with MediaSoup follows this sequence:

1. **Socket.IO Connection**: Client connects to server via Socket.IO
2. **MediaSoup Device Loading**: Server sends router RTP capabilities to client
3. **Transport Creation**: Client and server establish send/receive transports
4. **ICE Connectivity**: NAT traversal using STUN/TURN servers
5. **Media Streaming**: Producer/consumer tracks are created for audio/video

If any step fails, the entire connection will fail.

## Common Issues and Solutions

### 1. Socket.IO Connection Failures

**Symptoms:**

- "Socket connection failed" or timeout errors
- WebRTC diagnostic tool fails at step 1

**Solutions:**

- Ensure `NEXT_PUBLIC_SOCKET_URL` uses your machine's actual IP, not localhost/127.0.0.1
- Check that your firewall allows incoming connections on your server port (default: 3000)
- Verify CORS is properly configured in server.js

### 2. MediaSoup Device Loading Failures

**Symptoms:**

- "Failed to load device" errors
- WebRTC diagnostic tool fails at step 2

**Solutions:**

- Check if MediaSoup router is being created properly
- Verify browser compatibility (Chrome, Firefox, or Safari are recommended)
- Look for errors in server logs related to MediaSoup worker creation

### 3. Transport Connection Failures

**Symptoms:**

- "Failed to connect transport" errors
- ICE connection timeouts
- WebRTC diagnostic tool fails at steps 3-5

**Solutions:**

- **Critical setting**: Ensure `MEDIASOUP_ANNOUNCED_IP` is set to your machine's actual network IP, not 127.0.0.1
- Check that UDP ports in the range `MEDIASOUP_MIN_PORT` to `MEDIASOUP_MAX_PORT` (default: 40000-40100) are open in your firewall
- Verify the STUN/TURN server configuration is correct

### 4. Media Permission Issues

**Symptoms:**

- Camera/microphone access fails
- "NotFoundError" or "NotAllowedError" for media devices

**Solutions:**

- Ensure you've granted camera/microphone permissions in your browser
- Check that your selected media devices exist and work
- Try using different devices if available

### 5. ICE Connection Issues

**Symptoms:**

- "ICE failed" or "ICE disconnected" errors
- Connection established but then drops

**Solutions:**

- Ensure your STUN server is correctly configured (e.g., `stun:stun.l.google.com:19302`)
- For connections across different networks, set up a TURN server
- Check if symmetric NAT or strict firewalls are blocking UDP traffic

## Environment Configuration Guide

### Local Development

For local development, use `.env.local` with these critical settings:

```
# Replace with your actual LAN IP address
MY_LOCAL_IP=192.168.x.x

# Socket.IO connection
NEXT_PUBLIC_SOCKET_URL=ws://${MY_LOCAL_IP}:3000

# MediaSoup IP configuration - CRITICAL
MEDIASOUP_ANNOUNCED_IP=${MY_LOCAL_IP}
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100

# STUN/TURN configuration
NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
```

### Production Environment

For production, ensure these settings:

```
# Use your server's public IP or domain
MEDIASOUP_ANNOUNCED_IP=your.public.ip.address
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100

# Production should use secure WebSockets
NEXT_PUBLIC_SOCKET_URL=wss://your-domain.com

# STUN/TURN servers
NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
NEXT_PUBLIC_TURN_SERVER_URL=turn:your-turn-server:3478
NEXT_PUBLIC_TURN_USERNAME=username
NEXT_PUBLIC_TURN_PASSWORD=password
```

## Firewall Configuration

### Windows

```
# PowerShell commands to open UDP ports for MediaSoup
New-NetFirewallRule -DisplayName "MediaSoup WebRTC" -Direction Inbound -Protocol UDP -LocalPort 40000-40100 -Action Allow
```

### Linux

```bash
# Open UDP ports for MediaSoup
sudo iptables -A INPUT -p udp --dport 40000:40100 -j ACCEPT
```

### macOS

On macOS, you'll need to configure the firewall through System Preferences > Security & Privacy > Firewall > Firewall Options.

## Testing Tools

1. **Built-in Diagnostic Tool**: `/live-streams/diagnostics`
2. **Browser WebRTC Stats**: Open Chrome DevTools, go to Network tab, and select the WebSocket connection

## Debugging in Production

For debugging in production environments, set these environment variables:

```
MEDIASOUP_LOG_LEVEL=debug
SOCKET_LOG_LEVEL=debug
```

Enable client-side debug logging in the browser console:

```javascript
localStorage.debug = "*"; // Enable all Socket.IO debugging
```

## Getting Help

If you've tried all the troubleshooting steps and still have issues:

1. Collect full diagnostic logs from the WebRTC diagnostic tool
2. Check server logs for MediaSoup worker errors
3. Verify your network configuration, especially firewalls and NAT type
