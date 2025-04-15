import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';
import LiveStreamPage from '@/app/live-streams/[id]/page';
import { useAuth } from '@/components/AuthProvider'; // Import useAuth directly

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    // No query needed if using useParams
  })),
  usePathname: jest.fn(() => '/live-streams/test-stream-id'),
  useParams: () => ({
    id: 'test-stream-id',
  }),
}));

// Mock AuthProvider
const mockUseAuth = useAuth as jest.Mock; // Keep reference for modification in tests
jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(), // Initialize as jest.fn()
}));

// Mock the WebRTCStreamManager component
let mockWebRTCProps: any = {}; // To capture props passed to the mock
jest.mock('@/app/live-streams/[id]/components/WebRTCStreamManager', () => ({
  __esModule: true,
  default: (props: any) => {
     mockWebRTCProps = props; // Capture props when rendered
     return <div data-testid="mock-webrtc-manager">Mock WebRTC Manager</div>;
  }
}));

// Mock Bidding Interface (simple mock for integration test focus)
jest.mock('@/app/live-streams/[id]/components/BiddingInterface', () => ({
    __esModule: true,
    default: () => <div data-testid="mock-bidding-interface">Mock Bidding Interface</div>
}));

// Mock global fetch
const mockStreamDetailsViewer = {
  id: 'test-stream-id',
  title: 'Viewer Test Stream',
  description: 'This is a test stream for viewer',
  status: 'LIVE',
  startTime: new Date().toISOString(),
  user: {
    id: 'streamer-id',
    username: 'StreamerUser',
  },
  // viewerCount etc. can be added if needed
};

const mockStreamDetailsStreamer = {
    ...mockStreamDetailsViewer,
    title: 'Streamer Test Stream',
    user: {
        id: 'test-user-id', // Match the logged-in user for streamer tests
        username: 'TestUser'
    }
};

global.fetch = jest.fn(); // Initialize fetch mock
const mockFetch = global.fetch as jest.Mock;

// Base describe block - tests for viewer
describe('LiveStreamPage - Viewer View', () => {
    const viewerUser = { id: 'test-user-id', username: 'TestUser' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebRTCProps = {}; // Reset captured props

    // Setup viewer auth state
    mockUseAuth.mockReturnValue({
        token: 'viewer-token',
        user: viewerUser,
        isAuthenticated: true,
    });

    // Setup fetch mock for viewer
    mockFetch.mockImplementation((url) => {
        if (url.toString().endsWith(`/live-streams/${mockStreamDetailsViewer.id}`)) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStreamDetailsViewer) });
        }
        // Add mocks for product/auction if needed by other components rendered on the page
        if (url.toString().includes('/product')) { // Example product mock
             return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'p1', name: 'Item', currentBid: 100 }) });
        }
        return Promise.reject(new Error(`Unhandled fetch in viewer test: ${url}`));
    });

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  test('fetches stream details on mount', async () => {
    render(<LiveStreamPage />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/live-streams/${mockStreamDetailsViewer.id}`), expect.anything());
    });
  });

  test('renders stream title and WebRTC/Bidding components', async () => {
    render(<LiveStreamPage />);
    await waitFor(() => {
      expect(screen.getByText(mockStreamDetailsViewer.title)).toBeInTheDocument();
      expect(screen.getByTestId('mock-webrtc-manager')).toBeInTheDocument();
      expect(screen.getByTestId('mock-bidding-interface')).toBeInTheDocument();
    });
  });

  test('passes correct props (isStreamer=false) to WebRTCStreamManager', async () => {
    render(<LiveStreamPage />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled(); // Ensure data has been fetched
    });

    // Wait for the component state to settle after fetch
    await act(async () => {
       await new Promise(resolve => setTimeout(resolve, 0)); // Allow state updates
    });

    await waitFor(() => {
        // Check props captured by the mock component
        expect(mockWebRTCProps).toEqual(expect.objectContaining({
            streamId: mockStreamDetailsViewer.id,
            userId: viewerUser.id, // Should be the logged-in user's ID
            username: viewerUser.username,
            isStreamer: false, // Crucial check for viewer
        }));
    });

  });

});

// Separate describe block for streamer
describe('LiveStreamPage - Streamer View', () => {
    const streamerUser = { id: 'test-user-id', username: 'TestUser' }; // Same ID as in mockStreamDetailsStreamer.user

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebRTCProps = {};

    // Setup streamer auth state
    mockUseAuth.mockReturnValue({
      token: 'streamer-token',
      user: streamerUser,
      isAuthenticated: true,
    });

     // Setup fetch mock for streamer
    mockFetch.mockImplementation((url) => {
        if (url.toString().endsWith(`/live-streams/${mockStreamDetailsStreamer.id}`)) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStreamDetailsStreamer) });
        }
        if (url.toString().includes('/product')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'p1', name: 'Item', currentBid: 100 }) });
        }
        return Promise.reject(new Error(`Unhandled fetch in streamer test: ${url}`));
    });

    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  test('passes correct props (isStreamer=true) to WebRTCStreamManager', async () => {
    render(<LiveStreamPage />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled(); // Wait for fetch
    });

    // Wait for the component state to settle after fetch
    await act(async () => {
       await new Promise(resolve => setTimeout(resolve, 0));
    });

     await waitFor(() => {
        expect(mockWebRTCProps).toEqual(expect.objectContaining({
            streamId: mockStreamDetailsStreamer.id,
            userId: streamerUser.id,
            username: streamerUser.username,
            isStreamer: true, // Crucial check for streamer
        }));
    });
  });

   test('renders streamer-specific controls (example: Start Stream button if applicable)', async () => {
      // Modify mock stream details to be SCHEDULED for this test
      const scheduledStream = { ...mockStreamDetailsStreamer, status: 'SCHEDULED' };
       mockFetch.mockImplementation((url) => {
        if (url.toString().endsWith(`/live-streams/${scheduledStream.id}`)) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(scheduledStream) });
        }
        // ... other mocks ...
        return Promise.reject(new Error(`Unhandled fetch in streamer scheduled test: ${url}`));
      });

      render(<LiveStreamPage />);

      // Wait for data and potential conditional rendering
      await waitFor(() => {
         // Look for a button or element specific to streamers, e.g., "Start Streaming"
         // This depends heavily on the actual UI implementation
         const startButton = screen.queryByRole('button', { name: /start stream/i });
         // If the stream is scheduled and user is streamer, the button should exist
         expect(startButton).toBeInTheDocument();
      });
   });

}); 