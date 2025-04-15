import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import WebRTCStreamManager from '@/app/live-streams/[id]/components/WebRTCStreamManager';
import * as mediasoupClient from 'mediasoup-client';
import { useAuth } from '@/components/AuthProvider';

// --- Mocks ---

// Mock mediasoup-client
jest.mock('mediasoup-client', () => ({
  Device: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    rtpCapabilities: { codecs: [], headerExtensions: [] },
    createSendTransport: jest.fn().mockImplementation((options) => ({
      id: options.id || 'mock-send-transport-id',
      iceParameters: options.iceParameters,
      iceCandidates: options.iceCandidates,
      dtlsParameters: options.dtlsParameters,
      iceServers: options.iceServers,
      on: jest.fn((event, callback) => {
        // Simulate connection for tests needing it
        if (event === 'connect') {
          // Store callback to trigger later
          mockTransportConnectCallback = callback;
        }
        if (event === 'produce') {
           mockTransportProduceCallback = callback;
        }
      }),
      produce: jest.fn().mockResolvedValue({ id: 'mock-producer-id', kind: 'video', track: {} }),
      close: jest.fn(),
    })),
    createRecvTransport: jest.fn().mockImplementation((options) => ({
      id: options.id || 'mock-recv-transport-id',
      iceParameters: options.iceParameters,
      iceCandidates: options.iceCandidates,
      dtlsParameters: options.dtlsParameters,
      iceServers: options.iceServers,
      on: jest.fn((event, callback) => {
         if (event === 'connect') {
          mockTransportConnectCallback = callback;
         }
         if (event === 'connectionstatechange') {
           mockTransportStateChangeCallback = callback;
         }
      }),
      consume: jest.fn().mockResolvedValue({ id: 'mock-consumer-id', kind: 'video', track: {}, appData: {} }),
      close: jest.fn(),
    })),
  })),
}));

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.CONNECTING as 0 | 1 | 2 | 3, // Use explicit types
  onopen: jest.fn(),
  onclose: jest.fn(),
  onerror: jest.fn(),
  onmessage: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  ping: jest.fn(),
  pong: jest.fn(),
  dispatchEvent: jest.fn(),
};
let mockWebSocketInstance: typeof mockWebSocket | null = null; // To hold the instance for tests
global.WebSocket = jest.fn().mockImplementation(() => {
  mockWebSocketInstance = { ...mockWebSocket }; // Create a fresh mock instance each time
  // Reset readyState for new instances
  mockWebSocketInstance.readyState = WebSocket.CONNECTING;
  // Reset handlers
  mockWebSocketInstance.onopen = jest.fn();
  mockWebSocketInstance.onmessage = jest.fn();
  mockWebSocketInstance.onerror = jest.fn();
  mockWebSocketInstance.onclose = jest.fn();
  mockWebSocketInstance.send = jest.fn();
  mockWebSocketInstance.close = jest.fn();

  // Simulate connection opening shortly after creation for basic tests
  // REMOVED: Automatic opening simulation via setTimeout.
  // Tests will now explicitly trigger onopen/onmessage etc. using act().

  return mockWebSocketInstance;
}) as any;


// Mock useAuth
jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    token: 'test-auth-token',
    user: { id: 'test-user-id', username: 'TestUser' },
  })),
}));

// Mock navigator.mediaDevices using Object.defineProperty
const mockMediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    // Simulate a MediaStream-like object
    getVideoTracks: jest.fn(() => [{ id: 'mock-video-track', kind: 'video', stop: jest.fn() }]),
    getAudioTracks: jest.fn(() => [{ id: 'mock-audio-track', kind: 'audio', stop: jest.fn() }]),
    getTracks: jest.fn(() => [
      { id: 'mock-video-track', kind: 'video', stop: jest.fn() },
      { id: 'mock-audio-track', kind: 'audio', stop: jest.fn() },
    ]),
  }),
  // Add other methods if needed by the component
  enumerateDevices: jest.fn(),
  getSupportedConstraints: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
};
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices,
});

// Mock HTMLVideoElement properties
Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
  set: jest.fn(),
});
Object.defineProperty(HTMLMediaElement.prototype, 'playsInline', {
  set: jest.fn(),
});
Object.defineProperty(HTMLMediaElement.prototype, 'autoPlay', {
  set: jest.fn(),
});


// Helper functions/variables for mocks
let mockTransportConnectCallback: Function | null = null;
let mockTransportProduceCallback: Function | null = null;
let mockTransportStateChangeCallback: Function | null = null;

const defaultProps = {
  streamId: 'test-stream-123',
  userId: 'test-user-id',
  username: 'TestUser',
  isStreamer: false,
};

// --- Tests ---

describe('WebRTCStreamManager', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockWebSocketInstance = null; // Clear instance reference
    mockTransportConnectCallback = null;
    mockTransportProduceCallback = null;
    mockTransportStateChangeCallback = null;

    // Reset WebSocket mock states if needed (though new instance helps)
    mockWebSocket.readyState = WebSocket.CONNECTING as 0;
    // Reset mocks on the constructor itself if necessary
    (global.WebSocket as any as jest.Mock).mockClear();
    (mediasoupClient.Device as jest.Mock).mockClear();
    // Clear mocks on the prototype methods of the mock device
    const mockDeviceInstance = new mediasoupClient.Device();
    (mockDeviceInstance.load as jest.Mock).mockClear();
    (mockDeviceInstance.createSendTransport as jest.Mock).mockClear();
    (mockDeviceInstance.createRecvTransport as jest.Mock).mockClear();


    // Reset media device mock
     (mockMediaDevices.getUserMedia as jest.Mock).mockClear().mockResolvedValue({
       // Ensure reset mock provides the same MediaStream-like structure
       getVideoTracks: jest.fn(() => [{ id: 'mock-video-track', kind: 'video', stop: jest.fn() }]),
       getAudioTracks: jest.fn(() => [{ id: 'mock-audio-track', kind: 'audio', stop: jest.fn() }]),
       getTracks: jest.fn(() => [
         { id: 'mock-video-track', kind: 'video', stop: jest.fn() },
         { id: 'mock-audio-track', kind: 'audio', stop: jest.fn() },
       ]),
     });
  });

  it('renders the video element', () => {
    render(<WebRTCStreamManager {...defaultProps} />);
    expect(screen.getByRole('video')).toBeInTheDocument();
  });

  it('attempts to connect to WebSocket on mount', async () => {
     render(<WebRTCStreamManager {...defaultProps} />);
     // Check if WebSocket constructor was called
     await waitFor(() => {
       expect(global.WebSocket).toHaveBeenCalledTimes(1);
       // Check if the URL contains the correct parameters
       expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining(`streamId=${defaultProps.streamId}`));
       expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining(`userId=${defaultProps.userId}`));
       expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining(`username=${defaultProps.username}`));
       expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('token=test-auth-token'));
     });
  });

   it('requests router capabilities after connection status message', async () => {
     render(<WebRTCStreamManager {...defaultProps} />);

     await waitFor(() => {
       expect(mockWebSocketInstance).not.toBeNull();
       expect(mockWebSocketInstance?.readyState).toBe(WebSocket.OPEN);
     });

     // Simulate receiving the connection status message
     act(() => {
         mockWebSocketInstance?.onmessage?.({
             data: JSON.stringify({ type: 'connection-status', data: { status: 'connected', mediasoupAvailable: true } })
         } as MessageEvent);
     });

     // Check if getRouterRtpCapabilities message was sent
     await waitFor(() => {
         expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
             JSON.stringify({ type: 'getRouterRtpCapabilities' })
         );
     });
   });

    it('initializes MediaSoup device after receiving router capabilities', async () => {
        render(<WebRTCStreamManager {...defaultProps} />);
        const mockDevice = new mediasoupClient.Device();

        await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());

        // Simulate receiving router capabilities
        const mockCaps = { codecs: [{ kind: 'audio', mimeType: 'audio/opus' }] };
        act(() => {
            mockWebSocketInstance?.onmessage?.({
                data: JSON.stringify({ type: 'routerCapabilities', data: mockCaps })
            } as MessageEvent);
        });

        // Check if device.load was called
        await waitFor(() => {
            expect(mockDevice.load).toHaveBeenCalledWith({ routerRtpCapabilities: mockCaps });
        });

         // Check if createTransport message was sent
        await waitFor(() => {
            expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(
                JSON.stringify({ type: 'createTransport' })
            );
        });
    });


   // --- Streamer Tests ---
   describe('when isStreamer is true', () => {
     const streamerProps = { ...defaultProps, isStreamer: true };

     it('calls getUserMedia on initialization', async () => {
       render(<WebRTCStreamManager {...streamerProps} />);
       await waitFor(() => {
         expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
       });
     });

     it('sets up producer transport after receiving transport info', async () => {
       render(<WebRTCStreamManager {...streamerProps} />);
       const mockDevice = new mediasoupClient.Device();
       const mockTransportOptions = {
         id: 'tp_send_1',
         iceParameters: { usernameFragment: 'test', password: 'test' },
         iceCandidates: [],
         dtlsParameters: { role: 'client' as mediasoupClient.types.DtlsRole, fingerprints: [] }
       };

       // Wait for connection and capabilities request
       await waitFor(() => expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify({ type: 'getRouterRtpCapabilities' })));

       // Simulate receiving router caps and transport created
       act(() => {
         mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent);
       });
       await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
       act(() => {
         mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockTransportOptions }) } as MessageEvent);
       });

       // Check if send transport was created
       await waitFor(() => {
         expect(mockDevice.createSendTransport).toHaveBeenCalledWith(expect.objectContaining({ id: mockTransportOptions.id }));
       });
     });

     it('sends connectProducerTransport on transport connect event', async () => {
       render(<WebRTCStreamManager {...streamerProps} />);
       const mockDevice = new mediasoupClient.Device();
       const mockTransportOptions = { id: 'tp_send_2', iceParameters: {}, iceCandidates: [], dtlsParameters: { role: 'client' } };

       // Setup transport
       await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());
       act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
       await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
       act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockTransportOptions }) } as MessageEvent); });
       await waitFor(() => expect(mockDevice.createSendTransport).toHaveBeenCalled());

       // Simulate the transport 'connect' event
       expect(mockTransportConnectCallback).not.toBeNull();
       act(() => {
         mockTransportConnectCallback?.({ dtlsParameters: mockTransportOptions.dtlsParameters }, jest.fn(), jest.fn());
       });

       // Check if connectProducerTransport message was sent
       await waitFor(() => {
         expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify({
           type: 'connectProducerTransport',
           transportId: mockTransportOptions.id,
           dtlsParameters: mockTransportOptions.dtlsParameters,
         }));
       });
     });

    // Note: Testing the actual `produce` call requires triggering the `transport.on('produce', ...)` callback.
    // This is slightly complex as it depends on `startProducing` being called after transport setup.
    // We will test the WebSocket message sending part for now.
    it('calls transport.produce and sends produce message via WebSocket', async () => {
      render(<WebRTCStreamManager {...streamerProps} />);
      const mockDevice = new mediasoupClient.Device();
      // Provide necessary mock options
      const mockTransportOptions = {
         id: 'tp_send_3',
         iceParameters: { usernameFragment: 'test', password: 'test' },
         iceCandidates: [],
         dtlsParameters: { role: 'client' as mediasoupClient.types.DtlsRole, fingerprints: [] }
      };
      const sendTransportInstance = mockDevice.createSendTransport(mockTransportOptions);

      // Setup transport
      await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());
      act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
      await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
      act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockTransportOptions }) } as MessageEvent); });
      await waitFor(() => expect(mockDevice.createSendTransport).toHaveBeenCalled());

      // Ensure getUserMedia was called
      await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());

      // Verify transport.produce was called (implicitly by startProducing after transport setup)
      // We expect it to be called for both video and audio tracks obtained from getUserMedia
      await waitFor(() => {
         expect(sendTransportInstance.produce).toHaveBeenCalledTimes(2); // video + audio
         expect(sendTransportInstance.produce).toHaveBeenCalledWith(expect.objectContaining({ track: { id: 'mock-video-track' } }));
         expect(sendTransportInstance.produce).toHaveBeenCalledWith(expect.objectContaining({ track: { id: 'mock-audio-track' } }));
      });

       // Simulate the 'produce' callback being called by the (mocked) transport
       // This callback is what triggers the WebSocket message
       expect(mockTransportProduceCallback).not.toBeNull();
       const produceParams = { kind: 'video', rtpParameters: { encodings: [] }, appData: {} };
       act(() => {
         mockTransportProduceCallback?.(produceParams, jest.fn(({ id }) => id), jest.fn());
       });

       // Check if the produce message was sent
       await waitFor(() => {
         expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify({
            type: 'produce',
            transportId: mockTransportOptions.id,
            kind: produceParams.kind,
            rtpParameters: produceParams.rtpParameters,
            appData: produceParams.appData,
         }));
       });
    });
  });

   // --- Viewer Tests ---
   describe('when isStreamer is false (viewer)', () => {
     it('does NOT call getUserMedia on initialization', () => {
       render(<WebRTCStreamManager {...defaultProps} />);
       expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
     });

     it('sets up consumer transport after receiving transport info', async () => {
       render(<WebRTCStreamManager {...defaultProps} />);
       const mockDevice = new mediasoupClient.Device();
       const mockTransportOptions = {
         id: 'tp_recv_1',
         iceParameters: { usernameFragment: 'test', password: 'test' },
         iceCandidates: [],
         dtlsParameters: { role: 'client' as mediasoupClient.types.DtlsRole, fingerprints: [] }
       };

       // Wait for connection and capabilities request
       await waitFor(() => expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify({ type: 'getRouterRtpCapabilities' })));

       // Simulate receiving router caps and transport created
       act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
       await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
       act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockTransportOptions }) } as MessageEvent); });

       // Check if receive transport was created
       await waitFor(() => {
         expect(mockDevice.createRecvTransport).toHaveBeenCalledWith(expect.objectContaining({ id: mockTransportOptions.id }));
       });
     });

     it('sends connectConsumerTransport on transport connect event', async () => {
        render(<WebRTCStreamManager {...defaultProps} />);
        const mockDevice = new mediasoupClient.Device();
        const mockTransportOptions = { id: 'tp_recv_2', iceParameters: {}, iceCandidates: [], dtlsParameters: { role: 'client' } };

        // Setup transport
        await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());
        act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
        await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
        act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockTransportOptions }) } as MessageEvent); });
        await waitFor(() => expect(mockDevice.createRecvTransport).toHaveBeenCalled());

        // Simulate the transport 'connect' event
        expect(mockTransportConnectCallback).not.toBeNull();
        act(() => {
            mockTransportConnectCallback?.({ dtlsParameters: mockTransportOptions.dtlsParameters }, jest.fn(), jest.fn());
        });

        // Check if connectConsumerTransport message was sent
        await waitFor(() => {
            expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify({
                type: 'connectConsumerTransport',
                transportId: mockTransportOptions.id,
                dtlsParameters: mockTransportOptions.dtlsParameters,
            }));
        });
     });

     it('sends consume message when transport connection state changes to connected', async () => {
       render(<WebRTCStreamManager {...defaultProps} />);
       const mockDevice = new mediasoupClient.Device();
       const mockTransportOptions = { id: 'tp_recv_3', iceParameters: {}, iceCandidates: [], dtlsParameters: {} };
       const mockRtpCapabilities = { codecs: [{ kind: 'video', mimeType: 'video/vp8' }] }; // Mock device caps
       (mockDevice.rtpCapabilities as any) = mockRtpCapabilities; // Assign to mock

       // Setup transport
       await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());
       act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
       await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
       act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockTransportOptions }) } as MessageEvent); });
       await waitFor(() => expect(mockDevice.createRecvTransport).toHaveBeenCalled());

       // Simulate the transport 'connectionstatechange' event to connected
       expect(mockTransportStateChangeCallback).not.toBeNull();
       act(() => {
         mockTransportStateChangeCallback?.('connected');
       });

       // Check if consume message was sent
       await waitFor(() => {
         expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify({
           type: 'consume',
           streamId: defaultProps.streamId,
           transportId: mockTransportOptions.id,
           rtpCapabilities: mockRtpCapabilities, // Use the mocked caps
         }));
       });
     });

     it('calls transport.consume after receiving consumed message', async () => {
        render(<WebRTCStreamManager {...defaultProps} />);
        const mockDevice = new mediasoupClient.Device();
        // Provide necessary mock options for transport creation
        const mockRecvTransportOptions = {
          id: 'tp_recv_4',
          iceParameters: { usernameFragment: 'test', password: 'test' }, // Mock required fields
          iceCandidates: [],
          dtlsParameters: { role: 'client' as mediasoupClient.types.DtlsRole, fingerprints: [] }
        };
        const recvTransportInstance = mockDevice.createRecvTransport(mockRecvTransportOptions);
        const consumedMessage = {
            type: 'consumed',
            consumerId: 'cons-123',
            producerId: 'prod-abc',
            kind: 'video' as mediasoupClient.types.MediaKind,
            rtpParameters: { mid: '0', codecs: [], headerExtensions: [], encodings: [], rtcp: {} },
        };

        // Setup transport (simplified)
        await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());
        act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
        await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
        act(() => {
          // Send the full mock options in the message
          mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockRecvTransportOptions }) } as MessageEvent);
        });
        await waitFor(() => expect(mockDevice.createRecvTransport).toHaveBeenCalled());

       // Simulate receiving the consumed message
        act(() => {
            mockWebSocketInstance?.onmessage?.({ data: JSON.stringify(consumedMessage) } as MessageEvent);
        });

        // Check if transport.consume was called
        await waitFor(() => {
            expect(recvTransportInstance.consume).toHaveBeenCalledWith({
                id: consumedMessage.consumerId,
                producerId: consumedMessage.producerId,
                kind: consumedMessage.kind,
                rtpParameters: consumedMessage.rtpParameters,
            });
        });

       // Check if video srcObject was updated (basic check)
       // Note: Verifying the actual stream content requires more complex mocking
       const videoElement = screen.getByRole('video') as HTMLVideoElement;
       await waitFor(() => {
          expect(videoElement.srcObject).not.toBeNull();
       });
     });

   });

   // --- Common Tests ---
   describe('Error Handling, Reconnection, Demo Mode, and Cleanup', () => {

    it('displays an error message on WebSocket connection error', async () => {
      // Override WebSocket mock for this test to force an error
      (global.WebSocket as any as jest.Mock).mockImplementationOnce(() => {
         mockWebSocketInstance = { ...mockWebSocket, readyState: WebSocket.CONNECTING };
         setTimeout(() => {
             act(() => { mockWebSocketInstance?.onerror?.({} as Event); });
             // Also trigger close for full error path
             mockWebSocketInstance!.readyState = WebSocket.CLOSED;
             act(() => { mockWebSocketInstance?.onclose?.({ code: 1006, reason: 'Error' } as CloseEvent); });
         }, 50);
         return mockWebSocketInstance;
      });

      render(<WebRTCStreamManager {...defaultProps} />);

      // Wait for the error message to appear
      await waitFor(() => {
        expect(screen.getByText(/Could not connect to streaming server/i)).toBeInTheDocument();
      });
      expect(mockWebSocketInstance?.close).toHaveBeenCalled();
    });

     it('attempts to reconnect on unexpected WebSocket close', async () => {
       jest.useFakeTimers();
       render(<WebRTCStreamManager {...defaultProps} />);

       // Wait for initial connection
       await waitFor(() => expect(global.WebSocket).toHaveBeenCalledTimes(1));
       const firstInstance = mockWebSocketInstance;

       // Simulate unexpected close
       act(() => {
         firstInstance!.readyState = WebSocket.CLOSED;
         firstInstance?.onclose?.({ code: 1006, reason: 'Network Error' } as CloseEvent);
       });

       // Expect a reconnect attempt after a delay
       await act(async () => {
           jest.advanceTimersByTime(2100); // Advance past the 2000ms reconnect delay
       });

       // Check if WebSocket constructor was called again
       await waitFor(() => {
           expect(global.WebSocket).toHaveBeenCalledTimes(2);
       });

       jest.useRealTimers();
     });

      it('enters demo mode after maximum reconnection attempts', async () => {
         jest.useFakeTimers();
         const MAX_ATTEMPTS = 5; // As defined in the component
         render(<WebRTCStreamManager {...defaultProps} />);

         // Simulate MAX_ATTEMPTS failed connections
         for (let i = 0; i < MAX_ATTEMPTS; i++) {
             await waitFor(() => expect(global.WebSocket).toHaveBeenCalledTimes(i + 1));
             const currentInstance = mockWebSocketInstance;
             act(() => {
                 currentInstance!.readyState = WebSocket.CLOSED;
                 currentInstance?.onclose?.({ code: 1006, reason: `Error ${i + 1}` } as CloseEvent);
             });
             // Advance timer for the next reconnect attempt (if i < MAX_ATTEMPTS - 1)
             if (i < MAX_ATTEMPTS - 1) {
               await act(async () => {
                  jest.advanceTimersByTime(2100);
               });
             }
         }

         // Should not attempt to connect again
         expect(global.WebSocket).toHaveBeenCalledTimes(MAX_ATTEMPTS);

         // Check if demo mode content is potentially rendered (mocked canvas)
         // A simple check might be looking for text associated with demo mode
         await waitFor(() => {
            // The component renders a canvas for demo mode, which is hard to test directly.
            // We check if the error message mentioning demo mode *disappears* as demo mode takes over.
            expect(screen.queryByText(/Could not connect/i)).not.toBeInTheDocument();
            // We could also check if the getUserMedia (for streamer demo) or canvas generation was triggered,
            // but that depends on implementation details of startDemoStreaming/showDemoStream.
            // For now, we assume entering demo mode suppresses the connection error.
         });

         jest.useRealTimers();
      });

      it('displays server error message when received via WebSocket', async () => {
        render(<WebRTCStreamManager {...defaultProps} />);

        await waitFor(() => expect(mockWebSocketInstance?.readyState).toBe(WebSocket.OPEN));

        // Simulate receiving an error message
        const errorMessage = "Server authorization failed";
        act(() => {
          mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'error', data: errorMessage }) } as MessageEvent);
        });

        // Check if the error message is displayed
        await waitFor(() => {
          expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
      });

     it('cleans up WebSocket and transports on unmount', async () => {
        const { unmount } = render(<WebRTCStreamManager {...defaultProps} isStreamer={true} />); // Test with streamer to ensure producer transport cleanup
        const mockDevice = new mediasoupClient.Device();
        // Provide necessary mock options
        const mockSendTransportOptions = {
          id: 'cleanup-test',
          iceParameters: { usernameFragment: 'test', password: 'test' },
          iceCandidates: [],
          dtlsParameters: { role: 'client' as mediasoupClient.types.DtlsRole, fingerprints: [] }
        };
        const sendTransport = mockDevice.createSendTransport(mockSendTransportOptions);

        // Simulate transport creation
        await waitFor(() => expect(mockWebSocketInstance).not.toBeNull());
        act(() => { mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'routerCapabilities', data: { codecs: [] } }) } as MessageEvent); });
        await waitFor(() => expect(mockDevice.load).toHaveBeenCalled());
        act(() => {
          // Send the full mock options
          mockWebSocketInstance?.onmessage?.({ data: JSON.stringify({ type: 'transportCreated', data: mockSendTransportOptions }) } as MessageEvent);
        });
        await waitFor(() => expect(mockDevice.createSendTransport).toHaveBeenCalled());

        const instanceToClose = mockWebSocketInstance;

        // Unmount the component
        unmount();

        // Check if WebSocket was closed
        expect(instanceToClose?.close).toHaveBeenCalledWith(1000, 'Component unmounted');

        // Check if transport was closed
        // Note: We need to get the *instance* returned by the mock createSendTransport
        // This requires the mock setup to potentially store created transports or use mock.results
        // For simplicity, let's assume the mock `close` on the instance was called.
        expect(sendTransport.close).toHaveBeenCalled();

        // Check if local media stream tracks were stopped (if streamer)
        // This requires mocking the MediaStream and its tracks more thoroughly.
        // We'll skip this specific check for now.
     });

   });

}); 