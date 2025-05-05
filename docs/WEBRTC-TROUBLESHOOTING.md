# WebRTC Troubleshooting Guide

This document provides detailed troubleshooting steps for fixing WebRTC connectivity issues in the BidPazar streaming system.

## Common Issues

### 1. WebSocket Connection Failures

**Symptoms:**
- "WebSocket connection closed before establishment" errors in browser console
- Socket.IO connection attempts repeatedly failing

**Potential Causes:**
- Mismatch between client and server port configuration
- WebSocket upgrade not being handled properly by Next.js
- Firewall or proxy blocking WebSocket connections

**Solutions:**
- Ensure client is connecting to the correct WebSocket endpoint
- Check Next.js WebSocket middleware is properly configured
- Verify the server is listening on the expected port
- Test direct WebSocket connection with a tool like wscat

**Debug Command:**
```bash
# Check if the WebSocket server is running
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Host: localhost:3000" -H "Origin: http://localhost:3000" \
  http://localhost:3000/api/rtc/socket
```

### 2. ICE Connection Failures

**Symptoms:**
- WebRTC peers stuck in "connecting" state
- No video/audio despite successful signaling
- "ICE failed" messages in console

**Potential Causes:**
- STUN/TURN server misconfiguration
- Network connectivity issues
- Firewall blocking UDP ports

**Solutions:**
- Verify COTURN server is running and accessible
- Check credentials for TURN server
- Make sure required UDP ports are open
- Try falling back to TCP-only mode

**Debug Commands:**
```bash
# Test COTURN server connectivity
npm run mediasoup:test-coturn

# Check if ports are open
nc -vz localhost 3478
```

### 3. MediaSoup Worker Issues

**Symptoms:**
- Server crashes when initializing MediaSoup
- No router capabilities received by client
- "Failed to initialize MediaSoup" errors

**Potential Causes:**
- Missing system dependencies
- Incompatible MediaSoup version
- Port range conflicts

**Solutions:**
- Reinstall MediaSoup dependencies
- Check MediaSoup worker logs
- Ensure port range is available and not blocked
- Run the debug script

**Debug Commands:**
```bash
# Start MediaSoup in debug mode
DEBUG=mediasoup* npm run dev:mediasoup

# Check port availability
npm run mediasoup:ports
```

## Browser-Specific Debugging

### Chrome

1. Open `chrome://webrtc-internals/` in a new tab
2. Connect to a live stream
3. Examine ICE connection states and candidate gathering
4. Look for failed connection attempts

### Firefox

1. Open `about:webrtc` in a new tab
2. Connect to a live stream
3. Check "ICE Connection State" and "ICE Gathering State"
4. Review "Remote Candidate" and "Local Candidate" sections

## Client-Side Diagnostics

If you're having issues with the client-side WebRTC connection:

1. Open browser developer tools (F12)
2. Go to the "Console" tab
3. Set logging level with: `localStorage.setItem('debug', 'webrtc:*')`
4. Reload the page and look for detailed WebRTC logs

## Server-Side Diagnostics

To debug server-side MediaSoup issues:

1. Enable detailed logging:
   ```bash
   DEBUG=mediasoup* npm run dev
   ```

2. Check for port conflicts:
   ```bash
   lsof -i :40000-40100
   ```

3. Verify COTURN server status:
   ```bash
   docker logs bidpazar-coturn-1
   ```

## Network Configuration

If you're behind NAT or a strict firewall:

1. Ensure UDP ports 3478 (STUN/TURN) and 40000-40100 (media) are open
2. Consider configuring TURN to use TCP fallback (port 80/443)
3. If using a VPN, try disconnecting as some VPNs block WebRTC traffic

## Contact Support

If you're still experiencing issues after trying the above steps, contact the development team with:

1. Browser console logs
2. WebRTC-internals logs (exported as file)
3. Server-side MediaSoup logs
4. Network environment details (NAT, firewall, VPN) 