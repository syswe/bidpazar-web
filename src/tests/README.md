# WebRTC Testing Guide

This directory contains mock implementations for WebRTC-related APIs that can be used in tests.

## Available Mocks

- `mocks/mediasoup-client.ts` - Mock implementation of the mediasoup-client library
- `setup-webrtc-mocks.ts` - Helper to set up global WebRTC mocks in test environments

## Using the Mocks

### In Jest Tests

To use these mocks in your Jest tests, you need to:

1. Import the mocks in your test file or test setup file:

```typescript
import mediasoupClientMock from '../tests/mocks/mediasoup-client';
import { mockMediaDevices, mockDevices } from '../tests/mocks/mediasoup-client';
```

2. Mock the relevant modules:

```typescript
// Mock mediasoup-client
jest.mock('mediasoup-client', () => mediasoupClientMock);

// Set up navigator.mediaDevices in your tests
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockMediaDevices.getUserMedia,
    enumerateDevices: jest.fn().mockResolvedValue(mockDevices),
    // Add other methods as needed
  },
  writable: true
});
```

### Example Test Setup

Here's an example of how to set up a test for the WebRTCStreamManager component:

```typescript
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import WebRTCStreamManager from '../app/live-streams/[id]/components/WebRTCStreamManager';
import mediasoupClientMock from '../tests/mocks/mediasoup-client';
import { mockMediaDevices, mockDevices } from '../tests/mocks/mediasoup-client';

// Mock mediasoup-client
jest.mock('mediasoup-client', () => mediasoupClientMock);

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockMediaDevices.getUserMedia,
    enumerateDevices: jest.fn().mockResolvedValue(mockDevices),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  },
  writable: true
});

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: WebSocket.CONNECTING,
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe('WebRTCStreamManager', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <WebRTCStreamManager
        streamId="test-stream"
        userId="test-user"
        username="Test User"
        isStreamer={false}
      />
    );
    
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });
  
  // Add more tests as needed
});
```

## Known Limitations

- The current mock implementations are designed to support the basic functionality needed for testing the WebRTCStreamManager component.
- Some advanced WebRTC features might not be fully mocked.
- When testing real connections, you may need to manually trigger events like connection state changes.

## Extending the Mocks

To extend the mocks for additional functionality:

1. Add more features to `mocks/mediasoup-client.ts` as needed
2. Update the `MockDevice`, `MockTransport`, etc. classes to match your testing requirements

## Troubleshooting

If you encounter type errors with the mocks:

- Make sure you're using the correct mock implementations
- Consider using `as any` type assertions in your tests when necessary
- Remember that these are mocks and don't need to perfectly match the real implementations

# BidPazar Test Suite

## E2E Tests (Playwright)

End-to-end browser tests for live stream and auction flows are located in `src/tests/e2e/`.

To run all E2E tests:

```
npx playwright test
```

To run a specific test or in headed mode, see Playwright documentation. 