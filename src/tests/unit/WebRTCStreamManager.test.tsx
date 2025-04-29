/**
 * @jest-environment jsdom
 */

// Note: Install these types if they're missing:
// npm install --save-dev @types/jest @types/testing-library__react

import React from 'react';
import { render } from '@testing-library/react';
import WebRTCStreamManager from '../../app/live-streams/[id]/components/WebRTCStreamManager';
import { setupWebRTCMocks } from '../setup-webrtc-mocks';
import { jest, describe, test, expect } from '@jest/globals';

// Setup WebRTC mocks before tests
setupWebRTCMocks();

// Mock dependencies to avoid type errors
jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    token: 'test-auth-token'
  })
}));

jest.mock('mediasoup-client');
jest.mock('hls.js');
jest.mock('../../../../lib/env', () => ({
  SOCKET_URL: 'ws://localhost:5001'
}));

describe('WebRTCStreamManager Component', () => {
  test('renders without crashing', () => {
    render(
      <WebRTCStreamManager
        streamId="test-stream"
        userId="test-user"
        username="Test User"
        isStreamer={false}
      />
    );
    // If the test doesn't throw, the component rendered successfully
  });
}); 