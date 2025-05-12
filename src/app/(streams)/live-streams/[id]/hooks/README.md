# BidPazar Live Streaming Hooks

This directory contains the core hooks used in the BidPazar livestreaming feature. These hooks provide functionality for managing WebRTC connections, media devices, stream state, and more.

## Hook Architecture

The hooks are organized in a hierarchical structure:

### Main Page Hooks
These hooks are used directly in the `[id]/page.tsx` component:

- `useStreamDetails` - Fetches and manages stream metadata
- `useStreamControls` - Handles stream lifecycle (start/end)
- `useStreamLogging` - Provides logging and connection state tracking
- `useActiveBid` - Manages active product bids in stream
- `useMedia` - Media device management (camera/mic)
- `useReconnection` - Handles WebRTC reconnection logic

### WebRTCStreamManager Component Hooks
The WebRTCStreamManager component uses these hooks internally:

- `useSocketConnection` - Manages socket.io connection to signaling server
- `useMediasoupDevice` - Sets up MediaSoup client device
- `useMediaTransports` - Handles WebRTC transports, producers, and consumers

## Hook Relationships

```
                              [page.tsx]
                                  │
          ┌─────────┬─────────┬──┴───┬─────────┬──────────┐
          ▼         ▼         ▼      ▼         ▼          ▼
   useStreamDetails useMedia useActiveBid useReconnection useStreamControls useStreamLogging
                     │                         │                   │
                     │                         │                   │
                     ▼                         ▼                   ▼
             [WebRTCStreamManager]────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
 useSocketConnection useMediasoupDevice useMediaTransports
```

## Important Implementation Notes

1. **Media Management**: `useMedia` is the canonical hook for all camera/microphone operations. It's used by both the main page and WebRTCStreamManager.

2. **Connection States**: Connection state is tracked in multiple places:
   - `useStreamLogging` provides connection state for the main page
   - `useSocketConnection` manages internal connection details
   - `useReconnection` handles reconnection logic

3. **Potential Conflict Areas**:
   - Media initialization should only happen in `useMedia`
   - Stream status management should only happen in `useStreamControls`
   - Connection events should flow through the established paths

## Usage Guidelines

- Always use `useMedia` for camera/mic operations instead of direct browser APIs
- Use `logMessage` from `useStreamLogging` to ensure consistent logging
- For component-specific media handling in WebRTCStreamManager, props are passed from the parent rather than duplicating logic

## Architecture Decisions

- The WebRTCStreamManager component is isolated with its own hooks to enable reuse in other contexts
- Main page hooks focus on application state while WebRTCStreamManager hooks focus on WebRTC internals
- The `useMedia` hook serves as bridge between user-facing controls and internal WebRTC implementation 