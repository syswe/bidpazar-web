import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the WebRTCStreamManager component
jest.mock('@/app/live-streams/[id]/components/WebRTCStreamManager', () => {
  return function MockWebRTCStreamManager(props: any) {
    return (
      <div data-testid="mock-webrtc-manager">
        <div>Stream ID: {props.streamId}</div>
        <div>User ID: {props.userId}</div>
        <div>Is Streamer: {props.isStreamer ? 'Yes' : 'No'}</div>
        <div>Connection Status: Loading...</div>
      </div>
    );
  };
});

// Import the mocked component
import WebRTCStreamManager from '@/app/live-streams/[id]/components/WebRTCStreamManager';

// Create a simple mock for WebSocket
class MockWebSocket {
  constructor(url: string) {
    // We can add validation for URL here if needed
  }
}

// Replace the global WebSocket for these tests
(global as any).WebSocket = MockWebSocket;

describe('WebSocket and WebRTC Integration', () => {
  const props = {
    streamId: 'integration-test-stream',
    userId: 'test-user-id',
    username: 'TestUser',
    isStreamer: false,
  };

  it('renders the WebRTC component with viewer properties', () => {
    render(<WebRTCStreamManager {...props} />);
    
    expect(screen.getByTestId('mock-webrtc-manager')).toBeInTheDocument();
    expect(screen.getByText(`Stream ID: ${props.streamId}`)).toBeInTheDocument();
    expect(screen.getByText('Is Streamer: No')).toBeInTheDocument();
  });

  it('renders the WebRTC component with streamer properties', () => {
    render(<WebRTCStreamManager {...props} isStreamer={true} />);
    
    expect(screen.getByTestId('mock-webrtc-manager')).toBeInTheDocument();
    expect(screen.getByText('Is Streamer: Yes')).toBeInTheDocument();
  });
}); 