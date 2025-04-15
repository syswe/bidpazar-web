# Testing the BidPazar Web Application

This document provides guidelines for testing the BidPazar web application, with a particular focus on the live auction streaming functionality.

## Test Setup

The project uses Jest and React Testing Library for testing. The configuration has been enhanced to support testing of Next.js components, including those that use WebRTC and WebSocket for live streaming.

### Key Testing Files

- `jest.config.js`: Configuration for Jest testing environment
- `babel.config.js`: Babel configuration for transpiling JSX and TypeScript in tests
- `src/tests/setup.ts`: Global setup for tests, including mocks for WebSocket and MediaStream APIs
- `src/tests/mockTTY.js`: Mock for TTY interfaces to fix CI environment issues
- `src/tests/mocks/mediasoup-client.ts`: Mock for the MediaSoup client library

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test-file.test.tsx
```

## Testing Live Streaming Components

The live auction streaming functionality combines WebRTC for media streaming with auction-specific features. Testing this requires mocking several browser APIs and external dependencies.

### WebRTC Testing Approach

Due to the complexity of WebRTC APIs, our testing approach leverages component mocking:

1. **Component Mocking**: We mock the `WebRTCStreamManager` component to avoid dealing with actual WebRTC APIs in tests.
2. **WebSocket Mocking**: We mock the WebSocket API to simulate signaling server interactions.
3. **MediaStream Mocking**: We mock the MediaStream API for handling audio/video streams.

### Example: Testing the WebRTCStreamManager Component

```typescript
// Mock the WebRTCStreamManager component
jest.mock('@/app/live-streams/[id]/components/WebRTCStreamManager', () => {
  return function MockWebRTCStreamManager(props: any) {
    return (
      <div data-testid="mock-webrtc-manager">
        <div>Stream ID: {props.streamId}</div>
        <div>Is Streamer: {props.isStreamer ? 'Yes' : 'No'}</div>
      </div>
    );
  };
});

// Then test with the mocked component
it('renders with the correct props', () => {
  render(<WebRTCStreamManager streamId="test-id" isStreamer={false} />);
  expect(screen.getByText('Stream ID: test-id')).toBeInTheDocument();
  expect(screen.getByText('Is Streamer: No')).toBeInTheDocument();
});
```

### Integration Testing

Integration tests simulate the interaction between WebRTC streaming and auction features:

1. Test that auction data can be displayed alongside the stream
2. Test that streamers can broadcast while managing auctions
3. Test that viewers can see the stream and place bids

## Testing Live Auction Functionality

The live auction functionality is tested by verifying:

1. Auction state management (current bid, time left, highest bidder)
2. Bidding interactions
3. Real-time updates via WebSocket
4. Integration with the streaming interface

## Future Testing Improvements

Future improvements to the testing setup include:

1. End-to-end testing with Playwright or Cypress to test actual WebRTC connections
2. Visual regression testing for the auction UI
3. Performance testing for the streaming functionality
4. Load testing for simultaneous viewers/bidders
5. Testing with actual MediaSoup server in a controlled environment

## Best Practices

1. **Mock External Dependencies**: Always mock WebRTC APIs, WebSocket communications, and external services
2. **Test Each Component in Isolation**: Test components in isolation before testing their integration
3. **Test User Flows**: Test complete user flows rather than individual UI elements
4. **Keep Tests Fast**: Avoid excessive use of timers and complex mocks that slow down tests
5. **Test Edge Cases**: Test edge cases like disconnections, reconnections, and auction timeouts 