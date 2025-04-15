import { useEffect, useRef, useState, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { useAuth } from '@/components/AuthProvider';

// Log immediately when the function body executes
console.log('[WebRTCStreamManager] Function body executing');

interface WebRTCStreamManagerProps {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
}

export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
}: WebRTCStreamManagerProps) {
  // Get authentication token
  const { token } = useAuth();

  // Log received props immediately
  console.log('[WebRTCStreamManager] Receiving props:', { streamId, userId, username, isStreamer });

  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number>(0);
  const [mediasoupAvailable, setMediasoupAvailable] = useState<boolean>(true);
  const MAX_CONNECTION_ATTEMPTS = 5;

  // Refs to track connection state
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [producerTransport, setProducerTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [consumerTransport, setConsumerTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [videoProducer, setVideoProducer] = useState<mediasoupClient.types.Producer | null>(null);
  const [audioProducer, setAudioProducer] = useState<mediasoupClient.types.Producer | null>(null);
  const [videoConsumer, setVideoConsumer] = useState<mediasoupClient.types.Consumer | null>(null);
  const [audioConsumer, setAudioConsumer] = useState<mediasoupClient.types.Consumer | null>(null);
  const [routerCapabilities, setRouterCapabilities] = useState<mediasoupClient.types.RtpCapabilities | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  const retryConsumeAttempts = useRef<Record<string, number>>({});

  // Add a ref to track the initial mount/unmount cycle
  const initialMountRef = useRef<boolean>(false);
  const strictModeRenderRef = useRef<boolean>(false);
  // Add a ref to track if we've done a real initialization
  const hasInitializedRef = useRef<boolean>(false);
  // Add mount count to track React 18 double mounting
  const mountCountRef = useRef<number>(0);
  // Add a ref to store timeouts so we can clear them
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Refs for values that shouldn't trigger callback recreation
  const streamIdRef = useRef(streamId);
  const userIdRef = useRef(userId);
  const usernameRef = useRef(username);
  const isStreamerRef = useRef(isStreamer);
  const connectionAttemptsRef = useRef(connectionAttempts);
  
  // Update refs when props change
  useEffect(() => {
    streamIdRef.current = streamId;
    userIdRef.current = userId;
    usernameRef.current = username;
    isStreamerRef.current = isStreamer;
    connectionAttemptsRef.current = connectionAttempts;
  }, [streamId, userId, username, isStreamer, connectionAttempts]);

  // Add a ref for token to prevent callback recreation
  const tokenRef = useRef(token);
  
  // Update token ref when it changes
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Log props on initial mount
  useEffect(() => {
    console.log('[WebRTCStreamManager] Mounted with props:', { streamId, userId, username, isStreamer });
  }, []); // Empty dependency array ensures this runs only once on mount

  // Define connectToSignalingServer first, before it's used in initializeStreamConnection
  const connectToSignalingServer = useCallback(() => {
    // Don't connect if we're currently unmounting or if StrictMode is still initializing
    if (!initialMountRef.current || !hasInitializedRef.current) {
      console.log('[WebRTCStreamManager] Skipping connection attempt during initialization phase');
      return;
    }
    
    // Prevent multiple connection attempts running simultaneously
    if (isConnectingRef.current || (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN))) {
      console.log('[WebRTCStreamManager] Connection already in progress or established, skipping');
      return;
    }
    
    // Mark that we're starting a connection
    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    
    // Use socket URL environment variable
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5001';
    console.log(`[WebRTCStreamManager] Using socket URL base: ${socketUrl}`);

    // Ensure socket URL uses correct protocol and remove any trailing slashes
    const wsUrl = socketUrl.startsWith('ws')
      ? socketUrl.replace(/\/$/, '')
      : socketUrl.replace(/^http/, 'ws').replace(/\/$/, '');
    console.log(`[WebRTCStreamManager] Normalized WebSocket URL: ${wsUrl}`);

    // Add auth token to URL if available
    const authParam = tokenRef.current ? `&token=${tokenRef.current}` : '';
    console.log(`[WebRTCStreamManager] Auth token available: ${!!tokenRef.current}`);

    // Use ref values to prevent callback recreation
    const fullWsUrl = `${wsUrl}/rtc/v1?streamId=${streamIdRef.current}&userId=${userIdRef.current}&username=${usernameRef.current}${authParam}`;
    console.log(`[WebRTCStreamManager] Attempting WebSocket connection to: ${fullWsUrl}`);

    try {
      // Close any existing connection before creating a new one
      if (wsRef.current) {
        console.log('[WebRTCStreamManager] Closing existing WebSocket connection');
        if (wsRef.current.readyState !== WebSocket.CLOSING && wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close(1000, "Closing before new connection");
        }
        wsRef.current = null;
      }
      
      // Create new WebSocket with custom timeout
      const ws = new WebSocket(fullWsUrl);
      
      // Log readyState changes
      const logReadyState = () => {
        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        console.log(`[WebRTCStreamManager] WebSocket state: ${states[ws.readyState]}`);
      };
      
      // Log initial state
      logReadyState();
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.error('[WebRTCStreamManager] WebSocket connection timeout after 10 seconds');
          
          // Only close if still in CONNECTING state
          if (ws.readyState === WebSocket.CONNECTING) {
            try {
              ws.close(1000, "Connection timeout");
              console.log('[WebRTCStreamManager] Closed WebSocket after timeout');
            } catch (err) {
              console.error('Error closing WebSocket after timeout:', err);
            }
          }
          
          setError('Connection to streaming server timed out. Please check your network connection and ensure the server is running.');
          setConnectionAttempts(prev => prev + 1);
          isConnectingRef.current = false;
          setConnectionStatus('disconnected');
        }
      }, 10000); // 10 second timeout
      
      // Store timeout to clean it up later if needed
      timeoutsRef.current.push(connectionTimeout);

      // Handle connection errors
      ws.onerror = (event) => {
        console.error('WebSocket connection error:', event);
        clearTimeout(connectionTimeout);
        
        // Only update state if component is still mounted
        if (initialMountRef.current) {
          // Provide a more detailed error message based on browser and URL
          let errorMessage = 'WebSocket connection failed. ';
          
          if (navigator.userAgent.includes('Chrome')) {
            if (!socketUrl.includes(window.location.hostname)) {
              errorMessage += 'This could be a CORS issue. Make sure the server allows connections from this origin.';
            } else {
              errorMessage += 'Check if the server is running and check your network connection.';
            }
          } else {
            errorMessage += 'Check your browser console for more details.';
          }
          
          setError(errorMessage);
          setConnectionAttempts(prev => prev + 1);
          isConnectingRef.current = false;
          setConnectionStatus('disconnected');
        }
        
        // Log details about the WebSocket
        logReadyState();
      };

      // Helper function for reconnection with exponential backoff
      const reconnectWithBackoff = (attempt: number) => {
        // Don't attempt reconnection if unmounting
        if (!initialMountRef.current) {
          console.log('[WebRTCStreamManager] Component unmounting, skipping reconnection attempt');
          return;
        }

        // Calculate exponential backoff time (capped at 30 seconds)
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        
        console.log(`[WebRTCStreamManager] Scheduling reconnection attempt ${attempt + 1}/${MAX_CONNECTION_ATTEMPTS} in ${backoffTime/1000}s`);
        
        // Create timeout for reconnection
        const reconnectTimeout = setTimeout(() => {
          if (initialMountRef.current) {
            console.log(`[WebRTCStreamManager] Attempting reconnection #${attempt + 1}`);
            setConnectionAttempts(attempt + 1);
            connectToSignalingServer();
          }
        }, backoffTime);
        
        // Store timeout reference for cleanup
        timeoutsRef.current.push(reconnectTimeout);
      };

      // Handle connection closure
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        // Only update state if component is still mounted
        if (initialMountRef.current) {
          isConnectingRef.current = false;
          setConnectionStatus('disconnected');
          
          console.log(`[WebRTCStreamManager] WebSocket closed with code: ${event.code}, reason: ${event.reason || 'No reason'}`);
          logReadyState();
          
          // Handle unexpected closure specifically
          if (event.code === 1006 || event.code === 1001) {
            console.warn('WebSocket connection closed unexpectedly');
            
            // Provide more specific error messages based on close code
            let closeReason = "";
            switch(event.code) {
              case 1001:
                closeReason = "The server is going away (shutting down).";
                break;
              case 1006:
                closeReason = "Connection lost unexpectedly. Check your network connection or server status.";
                break;
              default:
                closeReason = event.reason || "Unknown reason";
            }
            
            setError(`WebSocket connection closed: ${closeReason} (Code: ${event.code})`);
            
            // Automatically attempt to reconnect for recoverable errors
            if (connectionAttemptsRef.current < MAX_CONNECTION_ATTEMPTS) {
              console.log(`[WebRTCStreamManager] Connection attempt ${connectionAttemptsRef.current + 1}/${MAX_CONNECTION_ATTEMPTS}`);
              reconnectWithBackoff(connectionAttemptsRef.current);
            } else {
              console.log('[WebRTCStreamManager] Maximum reconnection attempts reached');
            }
          }
        }
      };

      // Handle successful connection
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[WebRTCStreamManager] Connected to signaling server');
        logReadyState();
        
        // Set connected status and reset errors
        setConnectionStatus('connected');
        setError(null);
        setConnectionAttempts(0);
        isConnectingRef.current = false;
        
        // Send initial presence message
        try {
          ws.send(JSON.stringify({
            type: 'join-room',
            streamId: streamIdRef.current,
            userId: userIdRef.current,
            username: usernameRef.current,
            data: {
              timestamp: Date.now(),
              isStreamer: isStreamerRef.current
            }
          }));
          console.log('[WebRTCStreamManager] Join room message sent successfully');
        } catch (err) {
          console.error('Error sending join room message:', err);
        }
      };

      // Handle incoming messages
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebRTCStreamManager] Received message:', message.type || 'unknown-type', message);
          
          // Handle connection status message specifically
          if (message.type === 'connection-status') {
            console.log('[WebRTCStreamManager] Connection acknowledged by server');
            // Request router capabilities after connection is confirmed
            try {
              // Always include all required parameters
              if (wsRef.current) {
                wsRef.current.send(JSON.stringify({
                  type: 'getRouterRtpCapabilities',
                  streamId: streamIdRef.current,
                  userId: userIdRef.current,
                  username: usernameRef.current,
                  data: {}
                }));
              } else {
                console.error('[WebRTCStreamManager] WebSocket not available for RTP capabilities request');
              }
            } catch (err) {
              console.error('Error requesting RTP capabilities:', err);
            }
          }
          
          // Pass the message to the general handler
          handleSignalingMessage(message);
        } catch (error) {
          console.error('Failed to handle WebSocket message:', error);
          setError(`Failed to process server message: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      // Store reference to the WebSocket
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError(`Failed to connect to streaming server: ${error instanceof Error ? error.message : String(error)}`);
      setConnectionAttempts(prev => prev + 1);
      isConnectingRef.current = false;
      setConnectionStatus('disconnected');
    }
  }, [connectionAttempts, MAX_CONNECTION_ATTEMPTS]);

  // Now define initializeStreamConnection which uses connectToSignalingServer
  const initializeStreamConnection = useCallback(() => {
    console.log('[WebRTCStreamManager] Initializing stream connection, isStreamer:', isStreamer);
    
    if (!isConnectingRef.current && connectionStatus === 'disconnected') {
      if (isStreamer) {
        // For streamers, initialize local media capture only
        console.log('[WebRTCStreamManager] Initializing streamer mode');
        navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        }).then(stream => {
          console.log('[WebRTCStreamManager] Local media stream obtained');
          localStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setStreamReady(true);
            console.log('[WebRTCStreamManager] Set local stream to video element');
          }
          // Now connect to server to publish the stream
          console.log('[WebRTCStreamManager] Starting signaling server connection for streamer');
          connectToSignalingServer();
        }).catch(err => {
          console.error('Error accessing camera and microphone:', err);
          setError(`Failed to access camera and microphone: ${err.message || 'Permission denied'}. Please check permissions.`);
        });
      } else {
        // For viewers, just connect to the signaling server to consume the stream
        console.log('[WebRTCStreamManager] Initializing viewer mode');
        connectToSignalingServer();
      }
    } else {
      console.log('[WebRTCStreamManager] Skipping connection setup - already connecting or connected');
    }
  }, [isStreamer, connectionStatus, connectToSignalingServer]);

  // Main connection effect
  useEffect(() => {
    console.log('[WebRTCStreamManager] Main effect running, mountCount:', mountCountRef.current, 
                'strictModeRender:', strictModeRenderRef.current, 
                'initialMount:', initialMountRef.current,
                'hasInitialized:', hasInitializedRef.current);
    
    // Increment mount count on each mount
    mountCountRef.current += 1;
    
    // Handle React 18 StrictMode double-mounting in development
    if (mountCountRef.current === 1) {
      console.log('[WebRTCStreamManager] First mount detected, waiting for potential second mount in StrictMode');
      strictModeRenderRef.current = true;
      
      // Schedule delayed initialization only after we're sure StrictMode mounting is complete
      const initTimeout = setTimeout(() => {
        if (mountCountRef.current === 1) {
          // Single mount - likely production mode without StrictMode
          console.log('[WebRTCStreamManager] Single mount detected (production mode), proceeding with initialization');
          initialMountRef.current = true;
          hasInitializedRef.current = true;
          initializeStreamConnection();
        }
      }, 100); // Small delay to wait for potential second mount in StrictMode
      
      // Store timeout to clean it up later if needed
      timeoutsRef.current.push(initTimeout);
      return;
    }
    
    if (mountCountRef.current === 2 && !hasInitializedRef.current) {
      // Second mount in StrictMode detected
      console.log('[WebRTCStreamManager] Second mount in StrictMode detected, now safe to initialize');
      initialMountRef.current = true;
      hasInitializedRef.current = true;
      
      // Initialize with a small delay to ensure we're past StrictMode's double mount cycle
      const initTimeout = setTimeout(() => {
        initializeStreamConnection();
      }, 50);
      
      timeoutsRef.current.push(initTimeout);
    }
    
    // Only run cleanup when the component is fully unmounting, not during React's double-mount cycles
    return () => {
      console.log('[WebRTCStreamManager] Running effect cleanup, mountCount:', mountCountRef.current, 
                  'initialMount:', initialMountRef.current);
      
      // Only perform cleanup on real unmount, not during StrictMode cycles
      if (mountCountRef.current <= 1 || (mountCountRef.current === 2 && !hasInitializedRef.current)) {
        console.log('[WebRTCStreamManager] Skipping cleanup during StrictMode cycles');
        return;
      }
      
      // Clear all timeouts to prevent any delayed operations
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current = [];
      
      console.log('[WebRTCStreamManager] Performing REAL cleanup on final unmount');
      
      // Set a flag to prevent reconnection attempts during cleanup
      isConnectingRef.current = true;
      
      // Close producers and consumers
      if (videoProducer) {
        console.log('[WebRTCStreamManager] Closing video producer');
        videoProducer.close();
      }
      if (audioProducer) {
        console.log('[WebRTCStreamManager] Closing audio producer');
        audioProducer.close();
      }
      if (videoConsumer) {
        console.log('[WebRTCStreamManager] Closing video consumer');
        videoConsumer.close();
      }
      if (audioConsumer) {
        console.log('[WebRTCStreamManager] Closing audio consumer');
        audioConsumer.close();
      }

      // Close transports
      if (producerTransport) {
        console.log('[WebRTCStreamManager] Closing producer transport');
        producerTransport.close();
      }
      if (consumerTransport) {
        console.log('[WebRTCStreamManager] Closing consumer transport');
        consumerTransport.close();
      }

      // Stop local stream tracks
      if (localStreamRef.current) {
        console.log('[WebRTCStreamManager] Stopping all local media tracks');
        localStreamRef.current.getTracks().forEach(track => {
          console.log(`[WebRTCStreamManager] Stopping ${track.kind} track`);
          track.stop();
        });
      }

      // Close WebSocket connection
      if (wsRef.current) {
        console.log('[WebRTCStreamManager] Cleanup: Closing WebSocket connection, state:', wsRef.current.readyState);
        // Only close if it's not already closing or closed
        if (wsRef.current.readyState !== WebSocket.CLOSING && wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close(1000, "Normal closure, component unmounting");
        }
        wsRef.current = null;
      }
    };
  }, [initializeStreamConnection]); // Use initializeStreamConnection in deps

  const handleSignalingMessage = (message: any) => {
    console.log('Received message:', message);

    switch (message.type) {
      case 'connection-status':
        console.log('[WebRTCStreamManager] Connection status update:', message.data);
        console.log('[WebRTCStreamManager] Full connection status data:', JSON.stringify(message.data, null, 2));
        setConnectionStatus('connected');
        
        // Check if MediaSoup is available on the server
        const isMediasoupAvailable = message.data?.mediasoupAvailable || false;
        setMediasoupAvailable(isMediasoupAvailable);

        if (isMediasoupAvailable) {
          // If MediaSoup is available, request router capabilities
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log('[WebRTCStreamManager] Requesting router capabilities');
            
            // Always include all required parameters
            wsRef.current.send(JSON.stringify({
              type: 'getRouterRtpCapabilities',
              streamId: streamIdRef.current,
              userId: userIdRef.current,
              username: usernameRef.current,
              data: {}
            }));
          }
        } else {
          console.log('[WebRTCStreamManager] MediaSoup not available on server, entering demo mode');
          setDemoMode(true);
          
          // If streaming in demo mode, we'll show a simulated local stream
          if (isStreamer) {
            startDemoStreaming();
          } else {
            // For viewers, we'll show a demo video
            showDemoStream();
          }
        }
        break;

      case 'routerCapabilities':
        console.log('[WebRTCStreamManager] Router capabilities received:', message.data);
        setRouterCapabilities(message.data);
        break;

      case 'transportCreated':
        console.log('[WebRTCStreamManager] Transport created message received:', message.data?.id);
        if (isStreamer) {
          setupProducerTransport(message.data);
        } else {
          // Make sure to set up consumer transport for viewers
          console.log('[WebRTCStreamManager] Setting up consumer transport for viewer');
          setupConsumerTransport(message.data);
        }
        break;

      case 'transportConnected':
        console.log(`Transport ${message.transportId} connected`);
        
        // Do nothing here - we now wait for the transport.on('connectionstatechange') event
        // which will trigger the appropriate consume request when the transport is ready
        console.log('[WebRTCStreamManager] Transport connected acknowledgment received, waiting for connectionstatechange event');
        break;

      case 'produced':
        console.log(`Media produced with ID ${message.producerId}`);
        break;

      case 'consumed':
        console.log('[WebRTCStreamManager] Received consumed message:', message);
        
        if (!message.consumerId || !message.producerId || !message.kind || !message.rtpParameters) {
          console.error('[WebRTCStreamManager] Received consumed message with missing required parameters');
          return;
        }
        
        // Try to handle the consume message
        handleConsume(message).catch(error => {
          console.error('[WebRTCStreamManager] Error in handleConsume:', error);
          
          // Schedule a retry if appropriate
          const { consumerId } = message;
          const retryCount = retryConsumeAttempts.current[consumerId] || 0;
          if (retryCount < 5) {
            retryConsumeAttempts.current[consumerId] = retryCount + 1;
            console.log(`[WebRTCStreamManager] Scheduling retry for consume (attempt ${retryCount + 1}/5)`);
            setTimeout(() => {
              handleSignalingMessage(message);
            }, 1000 * (retryCount + 1));
          } else {
            console.error(`[WebRTCStreamManager] Max retry attempts reached for consumer ${consumerId}`);
            setError('Failed to establish media stream after multiple attempts');
          }
        });
        break;

      case 'join-room':
        setParticipants(message.data.participantCount);
        break;

      case 'leave-room':
        setParticipants(message.data.participantCount);
        break;

      case 'error':
        console.error('[WebRTCStreamManager] Error received from server:', message.data);
        setError(message.data);
        if (message.data.includes('MediaSoup is not initialized') ||
          message.data.includes('Media router not initialized')) {
          setDemoMode(true);
          if (isStreamer) {
            startDemoStreaming();
          } else {
            showDemoStream();
          }
        } else if (message.data.includes('RTP capabilities')) {
          console.error('[WebRTCStreamManager] RTP capabilities mismatch detected. Current device capabilities:', deviceRef.current?.rtpCapabilities);
        }
        break;
    }
  };

  // Initialize device when router capabilities are received
  useEffect(() => {
    const initializeDevice = async () => {
      if (!routerCapabilities) return;
      console.log('[WebRTCStreamManager] Initializing device with router capabilities');

      try {
        const device = new mediasoupClient.Device();
        console.log('[WebRTCStreamManager] Created mediasoup device');

        // Load router RTP capabilities
        await device.load({ routerRtpCapabilities: routerCapabilities });
        console.log('[WebRTCStreamManager] Loaded router RTP capabilities');

        deviceRef.current = device;
        console.log('[WebRTCStreamManager] Device initialized successfully');

        // Create transport
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('[WebRTCStreamManager] Sending createTransport request');
          wsRef.current.send(JSON.stringify({
            type: 'createTransport'
          }));
        } else {
          console.warn('[WebRTCStreamManager] WebSocket not open when trying to create transport');
        }
      } catch (error) {
        console.error('Failed to initialize device:', error);
        setError('Failed to initialize media device');
      }
    };

    initializeDevice();
  }, [routerCapabilities]);

  const setupProducerTransport = (transportOptions: any) => {
    if (!deviceRef.current) {
      setError('Device not initialized');
      return;
    }

    try {
      // Create send transport
      const transport = deviceRef.current.createSendTransport({
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'connectProducerTransport',
              streamId: streamIdRef.current,
              userId: userIdRef.current,
              username: usernameRef.current,
              transportId: transport.id,
              dtlsParameters,
              data: {}
            }));
          }
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'produce',
              streamId: streamIdRef.current,
              userId: userIdRef.current,
              username: usernameRef.current,
              transportId: transport.id,
              kind,
              rtpParameters,
              appData: {
                ...appData,
                streamId: streamIdRef.current,
                userId: userIdRef.current
              },
              data: {}
            }));

            // Normally would wait for response with producerId, for demo just use a random ID
            const producerId = `producer-${Date.now()}`;
            callback({ id: producerId });
          }
        } catch (error) {
          errback(error as Error);
        }
      });

      setProducerTransport(transport);

      // Get local media and start producing
      startProducing(transport);
    } catch (error) {
      console.error('Error setting up producer transport:', error);
      setError('Failed to establish media connection');
    }
  };

  const setupConsumerTransport = (transportOptions: any) => {
    if (!deviceRef.current) {
      console.error('[WebRTCStreamManager] Cannot set up consumer transport: Device not initialized');
      setError('Device not initialized');
      return;
    }

    try {
      console.log('[WebRTCStreamManager] Creating consumer transport with options:', transportOptions);
      
      // Create receive transport
      const transport = deviceRef.current.createRecvTransport({
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      console.log('[WebRTCStreamManager] Consumer transport created:', transport.id);

      // Track transport connection state
      let isTransportConnected = false;

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('[WebRTCStreamManager] Consumer transport connect event triggered');
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'connectConsumerTransport',
              streamId: streamIdRef.current,
              userId: userIdRef.current,
              username: usernameRef.current,
              transportId: transport.id,
              dtlsParameters,
              data: {}
            }));
            console.log('[WebRTCStreamManager] Sent connect consumer transport message');
          } else {
            console.error('[WebRTCStreamManager] WebSocket not available for transport connection');
            errback(new Error('WebSocket not available'));
            return;
          }
          callback();
        } catch (error) {
          console.error('[WebRTCStreamManager] Error in consumer transport connect:', error);
          errback(error as Error);
        }
      });

      transport.on('connectionstatechange', async (state) => {
        console.log(`[WebRTCStreamManager] Consumer transport connection state changed to ${state}`);
        
        // Mark as connected when we reach connected state
        if (state === 'connected') {
          isTransportConnected = true;
        }
        
        // If we're connected, ensure we're consuming
        if (state === 'connected' && 
            wsRef.current && 
            wsRef.current.readyState === WebSocket.OPEN && 
            deviceRef.current) {
          
          console.log('[WebRTCStreamManager] Consumer transport connected, sending consume request');
          
          // Send consume request now that transport is connected with all required parameters
          wsRef.current.send(JSON.stringify({
            type: 'consume',
            streamId: streamIdRef.current,
            userId: userIdRef.current,
            username: usernameRef.current,
            transportId: transport.id,
            rtpCapabilities: deviceRef.current.rtpCapabilities,
            data: {} // Include empty data object for consistency
          }));
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.error(`[WebRTCStreamManager] Consumer transport entered problematic state: ${state}`);
          setError(`Transport connection ${state}`);
          
          // If we're in a bad state, consider reconnecting
          if (connectionAttemptsRef.current < MAX_CONNECTION_ATTEMPTS) {
            console.log('[WebRTCStreamManager] Attempting to reconnect after transport failure');
            setConnectionAttempts(prev => prev + 1);
            // Let the transport clean up naturally and try to reconnect
            setTimeout(connectToSignalingServer, 2000);
          }
        }
      });

      setConsumerTransport(transport);

      // IMPORTANT: Do NOT request to consume stream here.
      // Instead, wait for the transport 'connectionstatechange' event to fire with 'connected' state
      // The consume request is sent in the connectionstatechange handler above when state === 'connected'
      console.log('[WebRTCStreamManager] Waiting for transport to connect before consuming media');
      
    } catch (error) {
      console.error('[WebRTCStreamManager] Error setting up consumer transport:', error);
      setError('Failed to establish media connection');
    }
  };

  const startProducing = async (transport: mediasoupClient.types.Transport) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Produce video
      if (stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        const videoProducer = await transport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000
          }
        });

        setVideoProducer(videoProducer);
      }

      // Produce audio
      if (stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        const audioProducer = await transport.produce({
          track: audioTrack
        });

        setAudioProducer(audioProducer);
      }
    } catch (error) {
      console.error('Error producing media:', error);
      setError('Failed to access camera and microphone');
    }
  };

  const handleConsume = async (message: any) => {
    if (!deviceRef.current) {
      console.error('[WebRTCStreamManager] Cannot consume: Device not ready');
      setError('Media device not ready');
      return false;
    }
    
    if (!consumerTransport) {
      console.error('[WebRTCStreamManager] Cannot consume: Transport not created');
      const retryCount = retryConsumeAttempts.current[message.consumerId] || 0;
      if (retryCount < 5) {
        retryConsumeAttempts.current[message.consumerId] = retryCount + 1;
        console.log(`[WebRTCStreamManager] Retrying to consume media after delay (attempt ${retryCount + 1}/5)`);
        setTimeout(() => {
          handleSignalingMessage(message);
        }, 1000 * (retryCount + 1));
      }
      return false;
    }
    
    // Check transport connection state
    const connectionState = consumerTransport.connectionState;
    if (connectionState !== 'connected') {
      console.error(`[WebRTCStreamManager] Cannot consume: Transport not connected (state: ${connectionState})`);
      const retryCount = retryConsumeAttempts.current[message.consumerId] || 0;
      if (retryCount < 5) {
        retryConsumeAttempts.current[message.consumerId] = retryCount + 1;
        console.log(`[WebRTCStreamManager] Waiting for transport to connect before consuming (attempt ${retryCount + 1}/5)`);
        setTimeout(() => {
          handleSignalingMessage(message);
        }, 1000 * (retryCount + 1));
      } else {
        setError(`Failed to consume media: Transport not connected after multiple attempts (state: ${connectionState})`);
      }
      return false;
    }

    try {
      // Create consumer
      const { consumerId, producerId, kind, rtpParameters } = message;

      console.log(`[WebRTCStreamManager] Creating consumer for producer ${producerId} of kind ${kind}`);

      // Validate required parameters
      if (!consumerId || !producerId || !kind || !rtpParameters) {
        console.error('[WebRTCStreamManager] Missing required consumer parameters', message);
        throw new Error('Missing required consumer parameters');
      }

      // Create the consumer
      const consumer = await consumerTransport.consume({
        id: consumerId,
        producerId,
        kind,
        rtpParameters,
      });

      console.log(`[WebRTCStreamManager] Consumer created successfully: ${consumer.id}`);

      // Store consumer reference
      if (kind === 'video') {
        setVideoConsumer(consumer);
        console.log('[WebRTCStreamManager] Video consumer stored');
      } else if (kind === 'audio') {
        setAudioConsumer(consumer);
        console.log('[WebRTCStreamManager] Audio consumer stored');
      }

      // Create media stream from the consumer track
      const stream = new MediaStream([consumer.track]);
      console.log(`[WebRTCStreamManager] Media stream created from ${kind} track`);

      // Display the stream
      if (videoRef.current) {
        if (kind === 'video') {
          console.log('[WebRTCStreamManager] Setting video element source to new stream');
          
          // If we're adding a video track
          videoRef.current.srcObject = stream;
          
          // Make sure to play the video
          videoRef.current.play().catch(error => {
            console.error('[WebRTCStreamManager] Error playing video:', error);
            
            // Try with muted if autoplay was blocked
            if (error.name === 'NotAllowedError') {
              console.log('[WebRTCStreamManager] Autoplay blocked, trying with muted');
              videoRef.current!.muted = true;
              videoRef.current!.play().catch(e => {
                console.error('[WebRTCStreamManager] Still cannot play even with muted:', e);
              });
            }
          });
          
          console.log('[WebRTCStreamManager] Video stream added to video element');
        } else if (kind === 'audio' && videoRef.current.srcObject) {
          // Add audio track to existing video stream if we already have video
          console.log('[WebRTCStreamManager] Adding audio track to existing stream');
          try {
            const existingStream = videoRef.current.srcObject as MediaStream;
            existingStream.addTrack(consumer.track);
            console.log('[WebRTCStreamManager] Audio track added to existing stream');
          } catch (error) {
            console.error('[WebRTCStreamManager] Error adding audio track to stream:', error);
          }
        }
      }

      // Clear retry counter for this consumer on success
      if (retryConsumeAttempts.current[consumerId]) {
        delete retryConsumeAttempts.current[consumerId];
      }

      // Set stream as successfully consumed
      setStreamReady(true);
      return true;
    } catch (error) {
      console.error('[WebRTCStreamManager] Error consuming media:', error);
      setError(`Failed to consume media: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Start a simulated local stream in demo mode
  const startDemoStreaming = () => {
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    }).then(stream => {
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }).catch(err => {
      console.error('Error accessing camera in demo mode:', err);
      showDemoStream(); // Fall back to demo stream
    });
  };

  // Show a demo stream (e.g., color bars or placeholder)
  const showDemoStream = () => {
    if (videoRef.current) {
      // Create a canvas with animated content to simulate a stream
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const drawDemoContent = () => {
          // Simple gradient background
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          gradient.addColorStop(0, '#0057b7');
          gradient.addColorStop(1, '#071739');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Add some text
          ctx.fillStyle = 'white';
          ctx.font = '24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('MediaSoup Demo Mode', canvas.width / 2, canvas.height / 2 - 20);
          ctx.font = '16px Arial';
          ctx.fillText('Live streaming requires a running MediaSoup server', canvas.width / 2, canvas.height / 2 + 20);

          // Add pulsing circle
          const time = Date.now() / 1000;
          const size = 20 + 5 * Math.sin(time * 2);
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2 + 60, size, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();

          requestAnimationFrame(drawDemoContent);
        };

        drawDemoContent();

        // Convert canvas to stream
        const stream = canvas.captureStream(30); // 30 FPS
        videoRef.current.srcObject = stream;
      }
    }
  };

  // Add an effect to enter demo mode after a few connection attempts
  useEffect(() => {
    // Only process if component is fully mounted
    if (!initialMountRef.current) return;
    
    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS && !demoMode) {
      console.log('Maximum connection attempts reached, switching to demo mode');
      setDemoMode(true);
      setError(null);

      if (isStreamer) {
        startDemoStreaming();
      } else {
        showDemoStream();
      }
    }
  }, [connectionAttempts, demoMode, isStreamer]);

  const connectTransport = async (transportId: string, type: 'producer' | 'consumer') => {
    try {
      const transport = type === 'producer' ? producerTransport : consumerTransport;
      if (!transport) {
        console.error(`${type} transport is not created yet`);
        return;
      }

      // The actual connection is handled by transport.on('connect') handlers
      // This function is just a placeholder now as the event-based approach is used
      console.log(`Transport ${transportId} is being handled by its event handlers`);
    } catch (error) {
      console.error(`Error with ${type} transport:`, error);
    }
  };

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isStreamer}
        className="w-full h-full object-contain"
      />
      
      {/* Error message display */}
      {error && !demoMode && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
          {error}
          {connectionAttempts >= MAX_CONNECTION_ATTEMPTS && (
            <div className="mt-1 text-sm">
              Switching to demo mode after failed connection attempts
            </div>
          )}
        </div>
      )}
      
      {/* Connection status indicator */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2">
        <div 
          className={`w-2 h-2 rounded-full ${
            demoMode ? 'bg-yellow-500' : 
            connectionStatus === 'connected' && streamReady ? 'bg-green-500' : 
            connectionStatus === 'connected' ? 'bg-blue-500' : 
            'bg-red-500'
          }`} 
          title={
            demoMode ? 'Demo Mode' : 
            connectionStatus === 'connected' && streamReady ? 'Stream Active' : 
            connectionStatus === 'connected' ? 'Connected, Waiting for Stream' : 
            'Disconnected'
          }
        />
        <span>
          {demoMode 
            ? 'Demo Mode' 
            : connectionStatus === 'connected' && streamReady 
              ? `${participants} watching` 
              : connectionStatus === 'connected' 
                ? 'Connecting to stream...' 
                : 'Connecting to server...'
          }
        </span>
      </div>
      
      {/* Demo mode indicator */}
      {demoMode && (
        <div className="absolute top-4 right-4 bg-yellow-500/80 text-white px-2 py-1 rounded text-xs font-medium">
          DEMO MODE
        </div>
      )}
      
      {/* Loading indicator when connecting but not in demo mode */}
      {!streamReady && !error && !demoMode && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-white text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" role="status">
              <span className="sr-only">Loading...</span>
            </div>
            <div className="mt-2">
              {connectionStatus === 'connected' 
                ? 'Establishing media connection...' 
                : 'Connecting to server...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}