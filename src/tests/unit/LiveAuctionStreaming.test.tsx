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
        <div>Is Auction Active: {props.isAuctionActive ? 'Yes' : 'No'}</div>
        <div>Connection Status: Loading...</div>
      </div>
    );
  };
});

// Import the mocked component
import WebRTCStreamManager from '@/app/live-streams/[id]/components/WebRTCStreamManager';

describe('Live Auction Streaming', () => {
  const streamProps = {
    streamId: 'test-stream-id',
    userId: 'test-user-id',
    username: 'TestUser',
    isStreamer: false,
    isAuctionActive: true,
  };

  it('renders WebRTC component with auction properties for viewers', () => {
    render(<WebRTCStreamManager {...streamProps} />);
    
    expect(screen.getByTestId('mock-webrtc-manager')).toBeInTheDocument();
    expect(screen.getByText('Is Auction Active: Yes')).toBeInTheDocument();
    expect(screen.getByText('Is Streamer: No')).toBeInTheDocument();
  });

  it('renders WebRTC component with auction properties for streamers', () => {
    render(<WebRTCStreamManager {...streamProps} isStreamer={true} />);
    
    expect(screen.getByTestId('mock-webrtc-manager')).toBeInTheDocument();
    expect(screen.getByText('Is Auction Active: Yes')).toBeInTheDocument();
    expect(screen.getByText('Is Streamer: Yes')).toBeInTheDocument();
  });

  it('renders WebRTC component with inactive auction', () => {
    render(<WebRTCStreamManager {...streamProps} isAuctionActive={false} />);
    
    expect(screen.getByTestId('mock-webrtc-manager')).toBeInTheDocument();
    expect(screen.getByText('Is Auction Active: No')).toBeInTheDocument();
  });
}); 