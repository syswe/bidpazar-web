# WebRTC Troubleshooting Guide

This document provides detailed troubleshooting steps for fixing WebRTC connectivity issues in the BidPazar streaming system.

## Quick Verification Checklist

Before diving into detailed troubleshooting, verify these essential configurations:

- [ ] `MEDIASOUP_ANNOUNCED_IP` is set to your server's public IP address in production (or a local network IP for development)
- [ ] UDP ports 40000-40100 (or your configured range) are open on your firewall
- [ ] WebSocket connections to your server port (default 3000) are allowed
- [ ] The Next.js server is running with proper permissions
- [ ] At least one STUN server is configured and accessible

## Common Issues

### 1. WebSocket Connection Failures

**Symptoms:**
- "WebSocket connection closed before establishment" errors in browser console
- Socket.IO connection attempts repeatedly failing
- Error messages like "Error in WebSocket connection"
- Live stream appearing to load indefinitely

**Potential Causes:**
- Mismatch between client and server port configuration
- WebSocket upgrade not being handled properly by Next.js
- Firewall or proxy blocking WebSocket connections
- CORS issues preventing connection
- Server not properly initializing Socket.IO

**Solutions:**
- Ensure client is connecting to the correct WebSocket endpoint (check for correct server URL)
- Verify the server is listening on the expected port (default 3000)
- Check for CORS configuration issues in `socketHandler.ts`
- Check server logs for Socket.IO initialization errors
- Try different transports in Socket.IO client configuration

**Debug Command:**
```bash
# Check if the WebSocket server is running and accessible
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Host: localhost:3000" -H "Origin: http://localhost:3000" \
  http://localhost:3000/socket.io/?EIO=4&transport=websocket

# Check server logs for Socket.IO initialization
DEBUG=socket.io*,engine* npm run dev
```

### 2. ICE Connection Failures

**Symptoms:**
- WebRTC peers stuck in "connecting" state
- No video/audio despite successful signaling
- "ICE failed" messages in console
- "Cannot find route" or "Failed to establish connection" errors

**Potential Causes:**
- STUN/TURN server misconfiguration
- Network connectivity issues (especially with NAT/firewall)
- UDP ports required for WebRTC being blocked
- Missing or incorrect `MEDIASOUP_ANNOUNCED_IP` configuration
- Incompatible network configuration between client and server

**Solutions:**
- Check environment variables in `.env` file:
  ```
  # Critical setting - must be your server's actual accessible IP
  MEDIASOUP_ANNOUNCED_IP=your.server.ip.address
  
  # For local development, this can be your local network IP (e.g., 192.168.1.x)
  # For production, this MUST be your server's public IP address
  ```
- Ensure UDP ports (40000-40100 by default) are open on your firewall
- If behind NAT, configure a proper TURN server
- Test with a public STUN server first (like stun:stun.l.google.com:19302)
- Verify client can actually reach the server's announced IP

**Debug Commands:**
```bash
# Check if required UDP ports are open on the server
sudo lsof -i :40000-40100

# Test if STUN/TURN server is accessible
apt-get install -y libnice-dev
stunclient your-stun-server.com 3478

# Find your public IP (server should use this for MEDIASOUP_ANNOUNCED_IP)
curl https://api.ipify.org

# Verify your IP is accessible from outside networks
# On a different network than your server, try:
ping your.server.ip
```

### 3. MediaSoup Worker Issues

**Symptoms:**
- Server errors when initializing MediaSoup
- "Failed to create worker" error logs
- "Router capabilities not available" errors on client
- Server crashing on startup

**Potential Causes:**
- Missing system dependencies for MediaSoup
- Port range conflicts with other applications
- Insufficient permissions for UDP socket binding
- Memory or resource limitations
- Incorrect MediaSoup version compatibility

**Solutions:**
- Install required dependencies for MediaSoup:
  ```bash
  # For Ubuntu/Debian:
  apt-get update && apt-get install -y build-essential python3 python3-pip
  
  # For macOS:
  xcode-select --install
  ```
- Check for processes using the same UDP port range
- Run the server with appropriate permissions
- Check server resources (CPU, memory)
- Verify MediaSoup version compatibility with Node.js version

**Debug Commands:**
```bash
# Start server with detailed MediaSoup logging
DEBUG=mediasoup* npm run dev

# Check if ports are already in use
netstat -tulpn | grep -E '4000[0-9]'

# Verify MediaSoup version
npm list mediasoup

# Check available system resources
free -m  # Memory
nproc    # CPU cores
```

### 4. Client-Side Connection Issues

**Symptoms:**
- WebRTC connection appears to initiate but then fails
- Client logs show transport creation but no media flow
- Browser displays "Camera/microphone permission denied"
- Stream loads but is stuck on "Connecting..." message

**Potential Causes:**
- Browser permissions denied for media devices
- Client-side CORS issues
- Client connecting to wrong server endpoint
- Browser WebRTC implementation differences

**Solutions:**
- Ensure browser has permission to access camera/microphone
- Verify correct CORS headers in server responses
- Check client code for correct server URL configuration
- Test on different browsers (Chrome tends to have the best WebRTC support)
- Implement a client-side diagnostics panel to show connection state

## Browser-Specific Debugging

### Chrome

1. Open `chrome://webrtc-internals/` in a new tab
2. Connect to a live stream
3. Examine ICE connection states and candidate gathering
4. Look for failed connection attempts and analyze ICE candidate types
5. Check for successful STUN/TURN server responses
6. Under "Create Offer/Answer" section, verify SDP contains expected codecs and media lines

### Firefox

1. Open `about:webrtc` in a new tab
2. Connect to a live stream
3. Check "ICE Connection State" and "ICE Gathering State"
4. Review "Remote Candidate" and "Local Candidate" sections
5. Examine the SDP negotiation process
6. Look for "host", "srflx" (STUN) or "relay" (TURN) candidate types - if only "host" appears, STUN/TURN is not working

## Client-Side Diagnostics

To enable detailed client-side logging:

1. Open browser developer tools (F12)
2. Go to the Console tab
3. Run the following command before loading the live stream page:
   ```javascript
   localStorage.setItem('debug', 'socket.io-client:*,mediasoup-client:*');
   ```
4. Reload the page and observe the detailed WebRTC logs

You can also use the built-in diagnostics panel in BidPazar:

1. Join a live stream
2. Open the diagnostics panel (usually accessible via a Debug button)
3. Review connection stats, WebRTC state, and error logs

## Server-Side Diagnostics

For detailed server-side logging:

```bash
# Enable comprehensive debug logs
DEBUG=mediasoup*,socket.io*,engine* npm run dev

# Monitor application errors in real-time
tail -f logs/error.log 

# Monitor MediaSoup worker processes
ps aux | grep mediasoup

# Verify MediaSoup process is listening on expected ports
sudo lsof -i UDP -P | grep mediasoup
```

The most common server-side issues appear in the logs with these prefixes:
- `[MediaSoup]` - Issues with the MediaSoup worker
- `[Socket.IO]` - Issues with WebSocket connections
- Critical errors during startup usually indicate permission or port binding problems

## Network Configuration

For servers behind NAT or firewalls:

1. Configure your firewall to allow:
   - TCP on port 3000 (or your application port) for HTTP/WebSockets
   - UDP on ports 40000-40100 (or your configured range) for WebRTC media
  
2. Set up a TURN server if clients may be behind restrictive firewalls:
   - Configure Coturn for both UDP and TCP fallback
   - Update environment variables with TURN server credentials
   - Test connectivity with WebRTC testing tools

3. In production, ensure your server has a static IP address and properly set:
   ```
   MEDIASOUP_ANNOUNCED_IP=<your-server-public-ip>
   ```

4. For quick debugging with a free TURN service (not for production):
   ```
   # Add these to your .env file (temporary testing only)
   NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
   NEXT_PUBLIC_TURN_SERVER_URL=turn:numb.viagenie.ca
   NEXT_PUBLIC_TURN_USERNAME=webrtc@live.com
   NEXT_PUBLIC_TURN_PASSWORD=muazkh
   ```

## Simplified Development Setup

For local development, try this minimal configuration:

1. In `.env`:
   ```
   # For local development only
   MEDIASOUP_LISTEN_IP=0.0.0.0
   MEDIASOUP_ANNOUNCED_IP=192.168.1.X  # Use your actual local IP address
   NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302
   ```

2. Start the server with enhanced logging:
   ```bash
   DEBUG=mediasoup*,socket.io* npm run dev
   ```

3. Access through your local IP, not localhost:
   ```
   http://192.168.1.X:3000/live-streams/[id]
   ```

## Testing Tools

Use these tools to diagnose connection issues:

1. [WebRTC Troubleshooter](https://test.webrtc.org/) - Test browser WebRTC capabilities
2. [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) - Test STUN/TURN connectivity
3. [WebRTC Leak Test](https://browserleaks.com/webrtc) - Check for potential privacy issues
4. [Wireshark](https://www.wireshark.org/) - Network packet analysis for WebRTC traffic (filter: `stun || dtls || srtp || rtp || rtcp`)

## Additional Resources

For more information about WebRTC streaming and troubleshooting:

- [MediaSoup Documentation](https://mediasoup.org/documentation/v3/)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [BidPazar Stream API Documentation](./LIVE-STREAM.md) 