import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import BiddingInterface from '@/app/live-streams/[id]/components/BiddingInterface';
import { useAuth } from '@/components/AuthProvider';
import { getAuth } from '@/lib/auth'; // Assuming this is used alongside useAuth
import io from 'socket.io-client';

// --- Mocks ---

// Mock useAuth
jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-123', username: 'BidderBob' },
  })),
}));

// Mock getAuth (if different/used)
const mockGetAuth = {
    token: 'test-auth-token',
    // Add other properties if needed
};
jest.mock('@/lib/auth', () => ({
  getAuth: jest.fn(() => mockGetAuth),
}));

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  id: 'mock-socket-id',
  connected: false, // Initial state
  io: {
    on: jest.fn(), // Mocking manager events like reconnect_attempt
  },
};
// Keep track of event listeners to simulate them
let socketEventListeners: { [key: string]: Function } = {};
let socketIOEventListeners: { [key: string]: Function } = {};

jest.mock('socket.io-client', () => {
  return jest.fn().mockImplementation(() => {
    // Reset listeners for each new instance
    socketEventListeners = {};
    socketIOEventListeners = {};
    mockSocket.on = jest.fn((event, callback) => {
      socketEventListeners[event] = callback;
    });
    mockSocket.io.on = jest.fn((event, callback) => {
       socketIOEventListeners[event] = callback;
    });
    mockSocket.emit = jest.fn();
    mockSocket.disconnect = jest.fn();
    mockSocket.connected = false; // Reset connected state

    // Simulate connection shortly after instantiation for basic tests
    // We control this more explicitly in tests now
    // setTimeout(() => {
    //   act(() => {
    //      mockSocket.connected = true;
    //      socketEventListeners['connect']?.();
    //   });
    // }, 50);

    return mockSocket;
  });
});

// Mock global fetch
const mockProduct = {
  id: 'prod-abc',
  name: 'Test Product',
  description: 'A great item for auction',
  startingBid: 50,
  currentBid: 75,
};
global.fetch = jest.fn().mockImplementation((url) => {
  if (url.includes('/api/live-streams/test-stream-id/product')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockProduct),
    });
  }
  return Promise.reject(new Error(`Unhandled fetch: ${url}`));
});

// Helper to simulate socket connection
const simulateSocketConnect = () => {
    act(() => {
        mockSocket.connected = true;
        if (socketEventListeners['connect']) {
             socketEventListeners['connect']();
        }
    });
};

// Helper to simulate socket disconnection
const simulateSocketDisconnect = (reason = 'io client disconnect') => {
     act(() => {
        mockSocket.connected = false;
        if (socketEventListeners['disconnect']) {
            socketEventListeners['disconnect'](reason);
        }
    });
};

// --- Tests ---

describe('BiddingInterface', () => {
  const streamId = 'test-stream-id';

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear().mockImplementation((url) => {
        if (url.includes(`/api/live-streams/${streamId}/product`)) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProduct) });
        }
        return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
    (io as jest.Mock).mockClear();
    socketEventListeners = {}; // Clear listeners
    socketIOEventListeners = {};
  });

  it('renders loading state initially', () => {
    render(<BiddingInterface streamId={streamId} />);
    expect(screen.getByText(/Loading bidding interface/i)).toBeInTheDocument();
  });

  it('fetches product data and displays it', async () => {
    render(<BiddingInterface streamId={streamId} />);

    // Wait for loading to finish and product to be displayed
    await waitFor(() => {
      expect(screen.queryByText(/Loading bidding interface/i)).not.toBeInTheDocument();
    });

    // Check if fetch was called
    expect(global.fetch).toHaveBeenCalledWith(`/api/live-streams/${streamId}/product`);

    // Check if product bid info is displayed
    expect(screen.getByText(`$${mockProduct.currentBid}`)).toBeInTheDocument(); // Current bid
    const bidInput = screen.getByPlaceholderText(`${mockProduct.currentBid + 1}+`);
    expect(bidInput).toBeInTheDocument();
    expect(screen.getByText(`Minimum bid: $${mockProduct.currentBid + 1}`)).toBeInTheDocument();
  });

  it('handles fetch error for product data', async () => {
    // Override fetch mock for this test
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ ok: false, status: 500 })
    );

    render(<BiddingInterface streamId={streamId} />);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to load product information/i)).toBeInTheDocument();
    });
  });

  it('attempts to connect to socket server on mount', async () => {
    render(<BiddingInterface streamId={streamId} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled()); // Wait for product fetch

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001',
      expect.objectContaining({
        path: '/socket.io/',
        query: expect.objectContaining({
          streamId: streamId,
          room: `stream:${streamId}`,
          userId: 'test-user-123',
          username: 'BidderBob'
        }),
        auth: {
          token: 'test-auth-token'
        }
      })
    );
  });

   it('enables bid button when connected and input is valid', async () => {
     render(<BiddingInterface streamId={streamId} />);
     await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());

     const bidInput = screen.getByPlaceholderText(`${mockProduct.currentBid + 1}+`) as HTMLInputElement;
     const bidButton = screen.getByRole('button', { name: /Bid/i });

     // Initially disabled (socket not connected yet)
     expect(bidButton).toBeDisabled();

     // Simulate socket connection
     simulateSocketConnect();

     // Still disabled (no input)
     expect(bidButton).toBeDisabled();

     // Enter valid bid amount
     fireEvent.change(bidInput, { target: { value: (mockProduct.currentBid + 1).toString() } });

     // Should be enabled now
     await waitFor(() => {
        expect(bidButton).toBeEnabled();
     });
   });

  it('disables bid button when socket disconnects', async () => {
    render(<BiddingInterface streamId={streamId} />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());

    const bidInput = screen.getByPlaceholderText(`${mockProduct.currentBid + 1}+`) as HTMLInputElement;
    const bidButton = screen.getByRole('button', { name: /Bid/i });

    // Connect and enable button
    simulateSocketConnect();
    fireEvent.change(bidInput, { target: { value: (mockProduct.currentBid + 1).toString() } });
    await waitFor(() => expect(bidButton).toBeEnabled());

    // Simulate disconnect
    simulateSocketDisconnect();

    // Should be disabled again
    expect(bidButton).toBeDisabled();
  });

  it('updates current bid when receiving bid-update event', async () => {
    render(<BiddingInterface streamId={streamId} />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    simulateSocketConnect();

    const newBidAmount = 100;
    // Simulate receiving a bid update
    act(() => {
      socketEventListeners['bid-update']?.({ amount: newBidAmount });
    });

    // Check if UI updated
    await waitFor(() => {
       expect(screen.getByText(`$${newBidAmount}`)).toBeInTheDocument();
       expect(screen.getByPlaceholderText(`${newBidAmount + 1}+`)).toBeInTheDocument();
       expect(screen.getByText(`Minimum bid: $${newBidAmount + 1}`)).toBeInTheDocument();
    });
  });

  it('displays error message when receiving bid-error event', async () => {
    jest.useFakeTimers();
    render(<BiddingInterface streamId={streamId} />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    simulateSocketConnect();

    const errorMessage = 'Bid is too low!';
    // Simulate receiving a bid error
    act(() => {
      socketEventListeners['bid-error']?.({ message: errorMessage });
    });

    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Check if error message disappears after timeout
    act(() => {
       jest.advanceTimersByTime(5100); // Advance past 5000ms timeout
    });
    await waitFor(() => {
       expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('emits place-bid event with correct data when submitting a valid bid', async () => {
    render(<BiddingInterface streamId={streamId} />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    simulateSocketConnect();

    const bidInput = screen.getByPlaceholderText(`${mockProduct.currentBid + 1}+`) as HTMLInputElement;
    const bidButton = screen.getByRole('button', { name: /Bid/i });
    const bidForm = bidInput.closest('form') as HTMLFormElement;

    const bidAmount = mockProduct.currentBid + 5;
    fireEvent.change(bidInput, { target: { value: bidAmount.toString() } });
    await waitFor(() => expect(bidButton).toBeEnabled());

    // Submit the form
    fireEvent.submit(bidForm);

    // Check if socket.emit was called correctly
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('place-bid', {
        streamId: streamId,
        listingId: mockProduct.id,
        amount: bidAmount,
      });
    });

    // Check if input is cleared (optimistic update)
    expect(bidInput.value).toBe('');
  });

  it('shows error when submitting a bid lower than current bid', async () => {
    render(<BiddingInterface streamId={streamId} />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    simulateSocketConnect();

    const bidInput = screen.getByPlaceholderText(`${mockProduct.currentBid + 1}+`) as HTMLInputElement;
    const bidButton = screen.getByRole('button', { name: /Bid/i });
    const bidForm = bidInput.closest('form') as HTMLFormElement;

    const lowBidAmount = mockProduct.currentBid - 5;
    fireEvent.change(bidInput, { target: { value: lowBidAmount.toString() } });
    await waitFor(() => expect(bidButton).toBeEnabled()); // Button enables based on input presence

    // Submit the form
    fireEvent.submit(bidForm);

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(`Bid must be higher than the current bid of $${mockProduct.currentBid}`)).toBeInTheDocument();
    });

    // Check socket.emit was NOT called
    expect(mockSocket.emit).not.toHaveBeenCalledWith('place-bid', expect.anything());
  });

   it('shows error when submitting a non-numeric bid', async () => {
     render(<BiddingInterface streamId={streamId} />);
     await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
     simulateSocketConnect();

     const bidInput = screen.getByPlaceholderText(`${mockProduct.currentBid + 1}+`) as HTMLInputElement;
     const bidButton = screen.getByRole('button', { name: /Bid/i });
     const bidForm = bidInput.closest('form') as HTMLFormElement;

     fireEvent.change(bidInput, { target: { value: 'not-a-number' } });
     await waitFor(() => expect(bidButton).toBeEnabled());

     // Submit the form
     fireEvent.submit(bidForm);

     // Check for error message
     await waitFor(() => {
       expect(screen.getByText(`Bid must be higher than the current bid of $${mockProduct.currentBid}`)).toBeInTheDocument();
     });

     // Check socket.emit was NOT called
     expect(mockSocket.emit).not.toHaveBeenCalledWith('place-bid', expect.anything());
   });

   it('disconnects socket on unmount', async () => {
      const { unmount } = render(<BiddingInterface streamId={streamId} />);
      await waitFor(() => expect(io).toHaveBeenCalled()); // Ensure socket was created
      simulateSocketConnect(); // Simulate connection

      // Unmount
      unmount();

      // Check if disconnect was called
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
   });

}); 