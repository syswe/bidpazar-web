import { useEffect, useRef, useState, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { useAuth } from '@/components/AuthProvider';
import env from "../../../../lib/env";
import Hls from 'hls.js';
import DeviceSelector from './DeviceSelector';

// Log immediately when the function body executes
console.log('[WebRTCStreamManager] Function body executing');

// Configure TURN/STUN server URLs
// Use environment values with proper fallbacks
const TURN_SERVER_URL = env.TURN_SERVER_URL || (window.location.hostname !== 'localhost' ? 
  `turn:${window.location.hostname}:3478` : 'turn:bidpazar.com:3478');
const TURN_USERNAME = env.TURN_USERNAME || 'bidpazar';
const TURN_PASSWORD = env.TURN_PASSWORD || 'bidpazarpass';
const STUN_SERVER_URL = env.STUN_SERVER_URL || (window.location.hostname !== 'localhost' ? 
  `stun:${window.location.hostname}:3478` : 'stun:bidpazar.com:3478');

// Define ICE servers configuration
const ICE_SERVERS = [
  { urls: STUN_SERVER_URL },
  {
    urls: TURN_SERVER_URL,
    username: TURN_USERNAME,
    credential: TURN_PASSWORD,
  },
  {
    urls: `${TURN_SERVER_URL}?transport=tcp`,
    username: TURN_USERNAME,
    credential: TURN_PASSWORD,
  },
  // Keep Google's STUN servers as fallback
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

console.log('[WebRTCStreamManager] Using ICE servers:', ICE_SERVERS);

// Retry utilities
const RETRY_DELAYS = [1000, 2000, 3000, 5000, 8000];

interface WebRTCStreamManagerProps {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
}

// Helper function to get proper WebSocket URL
const getWebSocketUrl = (streamId: string, userId: string, username: string, token: string): string => {
  const socketUrl = env.SOCKET_URL;
  
  // Remove trailing slash if present
  const baseUrl = socketUrl.endsWith('/') ? socketUrl.slice(0, -1) : socketUrl;
  
  // Format: 'ws://localhost:5001/rtc/v1?streamId=abc&userId=123&username=user&token=xyz'
  return `${baseUrl}/rtc/v1?streamId=${encodeURIComponent(streamId)}&userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}&token=${encodeURIComponent(token)}`;
};

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
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number>(0);
  const [mediasoupAvailable, setMediasoupAvailable] = useState<boolean>(true);
  const MAX_CONNECTION_ATTEMPTS = 5;
  const [usingHlsFallback, setUsingHlsFallback] = useState<boolean>(false);
  const hlsRef = useRef<Hls | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState<boolean>(isStreamer);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | undefined>(undefined);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(undefined);

  // Refs to track connection state
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const connectionAttemptsRef = useRef<number>(0);
  const userIdRef = useRef<string>(userId);
  const usernameRef = useRef<string>(username);
  const streamIdRef = useRef<string>(streamId);
  const isStreamerRef = useRef<boolean>(isStreamer);
  const tokenRef = useRef<string | null>(token);
  const retryConsumeAttempts = useRef<Record<string, number>>({});
  const timeoutsRef = useRef<(NodeJS.Timeout)[]>([]);

  const [producerTransport, setProducerTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [consumerTransport, setConsumerTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [videoProducer, setVideoProducer] = useState<mediasoupClient.types.Producer | null>(null);
  const [audioProducer, setAudioProducer] = useState<mediasoupClient.types.Producer | null>(null);
  const [videoConsumer, setVideoConsumer] = useState<mediasoupClient.types.Consumer | null>(null);
  const [audioConsumer, setAudioConsumer] = useState<mediasoupClient.types.Consumer | null>(null);
  const [routerCapabilities, setRouterCapabilities] = useState<mediasoupClient.types.RtpCapabilities | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  // Add a ref to track the initial mount/unmount cycle
  const initialMountRef = useRef<boolean>(false);
  const strictModeRenderRef = useRef<boolean>(false);
  // Add a ref to track if we've done a real initialization
  const hasInitializedRef = useRef<boolean>(false);
  // Add mount count to track React 18 double mounting
  const mountCountRef = useRef<number>(0);

  // Near the top of the component, add the muteAudio state
  const [muteAudio, setMuteAudio] = useState<boolean>(true);
  const [hideVideo, setHideVideo] = useState<boolean>(false);

  // Remove the setDemoMode references or add this state if needed
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Update refs when props change
  useEffect(() => {
    streamIdRef.current = streamId;
    userIdRef.current = userId;
    usernameRef.current = username;
    isStreamerRef.current = isStreamer;
    connectionAttemptsRef.current = connectionAttempts;
  }, [streamId, userId, username, isStreamer, connectionAttempts]);

  // Update token ref when it changes
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Log props on initial mount
  useEffect(() => {
    console.log('[WebRTCStreamManager] Mounted with props:', { streamId, userId, username, isStreamer });
    // Set initialMountRef to true immediately on first mount
    initialMountRef.current = true;
  }, []); // Empty dependency array ensures this runs only once on mount

  // Define handleSignalingMessage function needed by ws.onmessage
  const handleSignalingMessage = useCallback(async (message: any) => {
    console.log(`[WebRTCStreamManager] Handling message:`, message.type);

    switch (message.type) {
      case 'routerCapabilities':
        console.log('[WebRTCStreamManager] Router capabilities received:', message.data);
        setRouterCapabilities(message.data);
        break;

      case 'transportCreated':
        console.log('[WebRTCStreamManager] Transport created message received:', message.data?.id);
        if (isStreamerRef.current) {
          setupProducerTransport(message.data);
        } else {
          // Make sure to set up consumer transport for viewers
          console.log('[WebRTCStreamManager] Setting up consumer transport for viewer');
          setupConsumerTransport(message.data);
        }
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

      case 'error':
        console.error('[WebRTCStreamManager] Error from server:', message.data);
        setError(message.data);
        break;

      default:
        console.log('[WebRTCStreamManager] Unhandled message type:', message.type);
    }
  }, []);

  // Define produceWithTransport function needed by startProducingWithSelectedDevices
  const produceWithTransport = async (transport: mediasoupClient.types.Transport, stream: MediaStream) => {
    try {
      // Produce video
      if (stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        const videoProducer = await transport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 600000 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000
          },
          appData: { lowLatency: true },
          codec: deviceRef.current?.rtpCapabilities.codecs?.find(c => c.mimeType.toLowerCase() === 'video/h264')
        });
        
        setVideoProducer(videoProducer);
        console.log('[WebRTCStreamManager] Video producer created');
      }
      
      // Produce audio
      if (stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        const audioProducer = await transport.produce({
          track: audioTrack
        });
        
        setAudioProducer(audioProducer);
        console.log('[WebRTCStreamManager] Audio producer created');
      }
      
      setStreamReady(true);
    } catch (error) {
      console.error('Error producing media:', error);
      setError(`Failed to produce media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Define handleConsume function referenced by handleSignalingMessage
  const handleConsume = async (message: any) => {
    if (!deviceRef.current) {
      console.error('[WebRTCStreamManager] Cannot consume: Device not ready');
      setError('Media device not ready');
      return false;
    }
    
    if (!consumerTransport) {
      console.error('[WebRTCStreamManager] Cannot consume: Transport not created');
      return false;
    }
    
    try {
      // Create consumer
      const { consumerId, producerId, kind, rtpParameters } = message;

      console.log(`[WebRTCStreamManager] Creating consumer for producer ${producerId} of kind ${kind}`);

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
      } else if (kind === 'audio') {
        setAudioConsumer(consumer);
      }

      // Create media stream from the consumer track
      const stream = new MediaStream([consumer.track]);
      
      // Display the stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamReady(true);
      }
      
      return true;
    } catch (error) {
      console.error('[WebRTCStreamManager] Error consuming media:', error);
      setError(`Failed to consume media: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // Define initializeHlsFallback function referenced in connectToSignalingServer
  const initializeHlsFallback = useCallback(() => {
    if (!videoRef.current) return;
    
    // Check if HLS.js is supported
    if (!Hls.isSupported()) {
      console.error('[WebRTCStreamManager] HLS.js is not supported in this browser');
      setError('Your browser does not support modern streaming technologies');
      return;
    }
    
    try {
      // Stop any existing WebRTC streams to free up resources
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Close any existing MediaSoup transports
      if (producerTransport) {
        producerTransport.close();
        setProducerTransport(null);
      }
      
      if (consumerTransport) {
        consumerTransport.close();
        setConsumerTransport(null);
      }
      
      // Construct HLS stream URL
      const socketUrl = env.SOCKET_URL;
      const serverUrl = socketUrl.startsWith('ws') 
        ? socketUrl.replace(/^ws/, 'http').replace(/\/$/, '')
        : socketUrl.replace(/\/$/, '');
      
      const hlsUrl = `${serverUrl}/hls/${streamId}/index.m3u8`;
      console.log(`[WebRTCStreamManager] Attempting to use HLS fallback: ${hlsUrl}`);
      
      // Destroy any existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      
      // Create new HLS instance with optimized settings for lower latency
      const hls = new Hls({
        maxBufferLength: 10,  // Reduce buffer length for lower latency
        maxMaxBufferLength: 20,
        enableWorker: true,
        lowLatencyMode: true,
        fragLoadingTimeOut: 10000, // 10 seconds timeout for fragment loading
        manifestLoadingTimeOut: 10000, // 10 seconds timeout for manifest loading
        levelLoadingTimeOut: 10000, // 10 seconds timeout for level loading
      });
      
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('[WebRTCStreamManager] HLS media attached');
        hls.loadSource(hlsUrl);
      });
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[WebRTCStreamManager] HLS manifest parsed, playback should begin');
        videoRef.current?.play().catch(e => {
          console.error('[WebRTCStreamManager] Error playing HLS stream:', e);
          if (e.name === 'NotAllowedError') {
            videoRef.current!.muted = true;
            videoRef.current!.play().catch(e2 => {
              console.error('[WebRTCStreamManager] Still cannot play with muted:', e2);
            });
          }
        });
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[WebRTCStreamManager] HLS error:', data);
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[WebRTCStreamManager] Fatal network error encountered on HLS');
              hls.startLoad(); // Try to recover by reloading
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[WebRTCStreamManager] Media error encountered, attempting to recover');
              hls.recoverMediaError();
              break;
            default:
              console.error('[WebRTCStreamManager] Unrecoverable HLS error');
              setError('Stream playback failed');
              break;
          }
        }
      });
      
      // Store the reference
      hlsRef.current = hls;
      setUsingHlsFallback(true);
      setStreamReady(true);
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('[WebRTCStreamManager] Error initializing HLS fallback:', error);
      setError(`Failed to use alternative streaming method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [streamId, producerTransport, consumerTransport]);

  // Define connectToSignalingServer first, before it's used in any other function
  const connectToSignalingServer = useCallback(() => {
    // Don't connect if we're currently unmounting or if StrictMode is still initializing
    // Allow connection if initialMountRef is true (meaning component is mounted)
    if (!initialMountRef.current) {
      console.log('[WebRTCStreamManager] Skipping connection attempt, component not fully mounted');
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
    const socketUrl = env.SOCKET_URL;
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
    const fullWsUrl = `${wsUrl}?streamId=${streamIdRef.current}&userId=${userIdRef.current}&username=${usernameRef.current}${authParam}`;
    console.log(`[WebRTCStreamManager] Full WebSocket URL: ${fullWsUrl}`);

    // Parse URL to determine secure vs insecure WebSocket
    const socketUrlObj = new URL(socketUrl);
    const useSecureWebSocket = socketUrlObj.protocol === 'https:' || socketUrlObj.protocol === 'wss:';
    const wsProtocol = useSecureWebSocket ? 'wss:' : 'ws:';
    
    // Ensure URL is in the correct format
    const finalWsUrl = fullWsUrl.startsWith('ws') 
      ? fullWsUrl 
      : `${wsProtocol}//${fullWsUrl.replace(/^https?:\/\//, '')}`;
    
    console.log(`[WebRTCStreamManager] Final WebSocket URL (with protocol): ${finalWsUrl}`);

    try {
      // Create WebSocket with the full URL
      const ws = new WebSocket(finalWsUrl);
      wsRef.current = ws;
      
      // Helper function to log WebSocket readyState
      const logReadyState = () => {
        let state = 'UNKNOWN';
        switch (ws.readyState) {
          case WebSocket.CONNECTING: state = 'CONNECTING'; break;
          case WebSocket.OPEN: state = 'OPEN'; break;
          case WebSocket.CLOSING: state = 'CLOSING'; break;
          case WebSocket.CLOSED: state = 'CLOSED'; break;
        }
        return state;
      };
      
      console.log(`[WebRTCStreamManager] WebSocket created with readyState: ${logReadyState()}`);
      
      // Define reconnection with backoff logic
      const reconnectWithBackoff = (attempt: number) => {
        // Increment connection attempts counter
        setConnectionAttempts(prevAttempts => {
          const newAttempts = prevAttempts + 1;
          connectionAttemptsRef.current = newAttempts;
          return newAttempts;
        });
        
        // Check if we've reached the max attempts
        if (connectionAttemptsRef.current >= MAX_CONNECTION_ATTEMPTS) {
          console.log(`[WebRTCStreamManager] Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached, using HLS fallback`);
          setError(`Could not connect after ${MAX_CONNECTION_ATTEMPTS} attempts. Using fallback streaming method.`);
          
          // Initialize HLS fallback after max reconnection attempts
          initializeHlsFallback();
          return;
        }
        
        // Calculate delay for exponential backoff
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        console.log(`[WebRTCStreamManager] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
        
        // Set a timeout to reconnect
        const reconnectTimeout = setTimeout(() => {
          console.log(`[WebRTCStreamManager] Executing reconnect after backoff`);
          
          // Reset connection flag
          isConnectingRef.current = false;
          
          // Attempt to reconnect
          connectToSignalingServer();
        }, delay);
        
        // Store timeout for cleanup
        timeoutsRef.current.push(reconnectTimeout);
      };
      
      // Event handlers for the WebSocket
      ws.onopen = () => {
        console.log(`[WebRTCStreamManager] WebSocket connection opened successfully`);
        setConnectionStatus('connected');
        isConnectingRef.current = false;
        setConnectionAttempts(0);
        connectionAttemptsRef.current = 0;
        setError(null);
        
        // Request router-capabilities on connection for MediaSoup
        console.log(`[WebRTCStreamManager] Requesting router capabilities`);
        try {
          ws.send(JSON.stringify({
            type: 'getRouterRtpCapabilities'
          }));
        } catch (err) {
          console.error(`[WebRTCStreamManager] Error sending getRouterRtpCapabilities:`, err);
        }
      };
      
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`[WebRTCStreamManager] Received message:`, message.type);
          
          // Handle message based on its type
          await handleSignalingMessage(message);
        } catch (err) {
          console.error(`[WebRTCStreamManager] Error handling WebSocket message:`, err);
        }
      };
      
      ws.onerror = (error) => {
        console.error(`[WebRTCStreamManager] WebSocket error:`, error);
        setError('Connection error. Retrying...');
      };
      
      ws.onclose = (event) => {
        console.log(`[WebRTCStreamManager] WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`);
        
        // Update connection status
        setConnectionStatus('disconnected');
        isConnectingRef.current = false;
        
        // Clean up any transport
        if (producerTransport) {
          try {
            producerTransport.close();
            setProducerTransport(null);
          } catch (err) {
            console.error(`[WebRTCStreamManager] Error closing producer transport:`, err);
          }
        }
        
        if (consumerTransport) {
          try {
            consumerTransport.close();
            setConsumerTransport(null);
          } catch (err) {
            console.error(`[WebRTCStreamManager] Error closing consumer transport:`, err);
          }
        }
        
        // Don't attempt to reconnect if the component is unmounting
        if (!initialMountRef.current || ws !== wsRef.current) {
          console.log(`[WebRTCStreamManager] Not reconnecting because component is unmounting or WebSocket has changed`);
          return;
        }
        
        // Reconnect with backoff if not closing intentionally
        if (event.code !== 1000) {
          const currentAttempt = connectionAttemptsRef.current;
          reconnectWithBackoff(currentAttempt);
        }
      };
      
      console.log(`[WebRTCStreamManager] WebSocket connection attempt initiated`);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log(`[WebRTCStreamManager] Connection timed out`);
          ws.close();
        }
      }, 10000); // 10 second timeout
      
      timeoutsRef.current.push(connectionTimeout);
      
      return ws;
    } catch (err) {
      console.error(`[WebRTCStreamManager] Error creating WebSocket:`, err);
      setError(`Failed to create WebSocket connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
      isConnectingRef.current = false;
      
      // Try to reconnect on error
      const currentAttempt = connectionAttemptsRef.current;
      const reconnectTimeout = setTimeout(() => {
        const reconnectWithBackoff = (attempt: number) => {
          // Implementation re-defined to prevent reference error
          // Increment connection attempts counter
          setConnectionAttempts(prevAttempts => {
            const newAttempts = prevAttempts + 1;
            connectionAttemptsRef.current = newAttempts;
            return newAttempts;
          });
          
          // Check if we've reached the max attempts
          if (connectionAttemptsRef.current >= MAX_CONNECTION_ATTEMPTS) {
            console.log(`[WebRTCStreamManager] Max connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached, using HLS fallback`);
            setError(`Could not connect after ${MAX_CONNECTION_ATTEMPTS} attempts. Using fallback streaming method.`);
            
            // Initialize HLS fallback after max reconnection attempts
            initializeHlsFallback();
            return;
          }
          
          // Calculate delay for exponential backoff
          const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
          console.log(`[WebRTCStreamManager] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
          
          // Set a timeout to reconnect
          const reconnectTimeout = setTimeout(() => {
            console.log(`[WebRTCStreamManager] Executing reconnect after backoff`);
            
            // Reset connection flag
            isConnectingRef.current = false;
            
            // Attempt to reconnect
            connectToSignalingServer();
          }, delay);
          
          // Store timeout for cleanup
          timeoutsRef.current.push(reconnectTimeout);
        };
        
        reconnectWithBackoff(currentAttempt);
      }, 1000);
      
      timeoutsRef.current.push(reconnectTimeout);
      
      return null;
    }
  }, [
    producerTransport,
    consumerTransport,
    MAX_CONNECTION_ATTEMPTS,
    handleSignalingMessage,
    initializeHlsFallback
  ]);

  // Define startProducingWithSelectedDevices before it's used in setupProducerTransport
  const startProducingWithSelectedDevices = useCallback(async () => {
    try {
      // Configure constraints based on selected devices
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice 
          ? {
              deviceId: { exact: selectedVideoDevice },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 }
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user'
            },
        audio: selectedAudioDevice
          ? {
              deviceId: { exact: selectedAudioDevice },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
      };
      
      // Get media stream with selected devices
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('[WebRTCStreamManager] Local media stream obtained with selected devices');
      localStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamReady(true);
      }
      
      // If we already have a producer transport, produce with the new stream
      if (producerTransport) {
        // Close existing producers
        if (videoProducer) {
          videoProducer.close();
          setVideoProducer(null);
        }
        
        if (audioProducer) {
          audioProducer.close();
          setAudioProducer(null);
        }
        
        // Produce new tracks
        await produceWithTransport(producerTransport, stream);
      } else {
        // Otherwise, just connect to signaling to set up everything
        console.log('[WebRTCStreamManager] No producer transport yet, connecting to signaling server');
        connectToSignalingServer();
      }
      
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError(`Failed to access camera and microphone: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  }, [selectedVideoDevice, selectedAudioDevice, producerTransport, videoProducer, audioProducer, connectToSignalingServer, produceWithTransport]);

  // Now define setupProducerTransport which uses startProducingWithSelectedDevices
  const setupProducerTransport = useCallback((transportOptions: any) => {
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
        iceServers: ICE_SERVERS,
      });

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'connectProducerTransport',
              transportId: transport.id,
              dtlsParameters
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
              transportId: transport.id,
              kind,
              rtpParameters,
              appData: {
                ...appData,
                streamId: streamIdRef.current,
                userId: userIdRef.current
              }
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
      if (isStreamerRef.current) {
        startProducingWithSelectedDevices();
      }
    } catch (error) {
      console.error('Error setting up producer transport:', error);
      setError('Failed to establish media connection');
    }
  }, [startProducingWithSelectedDevices]);

  const setupConsumerTransport = useCallback((transportOptions: any) => {
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
        iceServers: ICE_SERVERS,
      });

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'connectConsumerTransport',
              transportId: transport.id,
              dtlsParameters
            }));
          }
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      transport.on('connectionstatechange', async (state) => {
        console.log(`[WebRTCStreamManager] Consumer transport connection state: ${state}`);
        
        if (state === 'connected' && 
            wsRef.current && 
            wsRef.current.readyState === WebSocket.OPEN && 
            deviceRef.current) {
          
          // Send consume request now that transport is connected
          try {
            wsRef.current.send(JSON.stringify({
              type: 'consume',
              streamId: streamIdRef.current,
              transportId: transport.id,
              rtpCapabilities: deviceRef.current.rtpCapabilities
            }));
          } catch (sendError) {
            console.error(`[WebRTCStreamManager] Error sending consume request:`, sendError);
          }
        }
      });

      setConsumerTransport(transport);
    } catch (error) {
      console.error('[WebRTCStreamManager] Error setting up consumer transport:', error);
      setError('Failed to establish media connection');
    }
  }, []);

  // Add the missing handleDeviceChange function
  const handleDeviceChange = useCallback((deviceId: string, kind: "videoinput" | "audioinput") => {
    console.log(`[WebRTCStreamManager] Device change: ${kind} = ${deviceId}`);
    
    if (kind === 'videoinput') {
      setSelectedVideoDevice(deviceId);
    } else if (kind === 'audioinput') {
      setSelectedAudioDevice(deviceId);
    }
    
    // If already streaming, restart with new device
    if (isStreamerRef.current && (producerTransport || connectionStatus === 'connected')) {
      // Schedule device change after state updates
      setTimeout(() => {
        startProducingWithSelectedDevices();
      }, 0);
    }
  }, [producerTransport, connectionStatus, startProducingWithSelectedDevices]);

  // Add a function to toggle audio mute state
  const toggleAudio = useCallback(() => {
    setMuteAudio(prev => !prev);
    
    // If we have a local stream (we're streaming), mute our outgoing audio
    if (isStreamerRef.current && localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = muteAudio; // We're toggling, so use the opposite of current state
        audioTracks.forEach(track => track.enabled = enabled);
      }
    }
    
    // If we're consuming a stream, we can mute the video element
    if (videoRef.current) {
      videoRef.current.muted = !muteAudio;
    }
  }, [muteAudio]);
  
  // Add a function to toggle video display
  const toggleVideo = useCallback(() => {
    setHideVideo(prev => !prev);
    
    // If we're streaming, disable the video track
    if (isStreamerRef.current && localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = hideVideo; // We're toggling, so use the opposite of current state
        videoTracks.forEach(track => track.enabled = enabled);
      }
    }
  }, [hideVideo]);

  // ... rest of the component

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isStreamerRef.current || muteAudio}
        className={`w-full h-full object-cover ${hideVideo ? 'invisible' : 'visible'}`}
      />
      
      {/* Media control buttons */}
      <div className="absolute bottom-4 left-4 flex space-x-2">
        {/* Audio toggle button */}
        <button
          onClick={toggleAudio}
          className="bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
          title={muteAudio ? "Unmute audio" : "Mute audio"}
        >
          {muteAudio ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        {/* Video toggle button (for streamers) */}
        {isStreamer && (
          <button
            onClick={toggleVideo}
            className="bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
            title={hideVideo ? "Enable video" : "Disable video"}
          >
            {hideVideo ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-8h1V5h-1v2zm-2 8h1v-2h-1v2zM9 13h1v-2H9v2zm-2 0h1v-2H7v2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            )}
          </button>
        )}
      </div>
      
      {/* Device selector (for streamers only) */}
      {isStreamer && (
        <div className="absolute top-16 right-4 z-10">
          <button
            onClick={() => setShowDeviceSelector(prev => !prev)}
            className="bg-gray-800 text-white p-2 rounded-full mb-2 hover:bg-gray-700 transition-colors"
            title={showDeviceSelector ? "Hide device settings" : "Show device settings"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          
          {showDeviceSelector && (
            <div className="absolute right-0 w-72 mt-2 bg-white rounded-lg shadow-lg overflow-hidden">
              <DeviceSelector
                onDeviceChange={handleDeviceChange}
                initialVideoDeviceId={selectedVideoDevice}
                initialAudioDeviceId={selectedAudioDevice}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Error message */}
      {error && !usingHlsFallback && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
          {error}
          <div className="mt-1 text-sm">
            Switching to HLS fallback after failed connection attempts
          </div>
        </div>
      )}
      
      {/* Participant count */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            connectionStatus === 'connected' && (usingHlsFallback ? 'bg-blue-500' : 'bg-green-500')
          } ${
            connectionStatus === 'connecting' ? 'bg-yellow-500' : ''
          } ${
            connectionStatus === 'disconnected' ? 'bg-red-500' : ''
          }`}
        ></div>
        <span className="text-xs font-medium">
          {connectionStatus === 'connected' 
            ? (usingHlsFallback ? 'HLS Mode' : `Live: ${participants} viewer${participants !== 1 ? 's' : ''}`) 
            : connectionStatus === 'connecting' 
              ? 'Connecting...' 
              : 'Disconnected'
          }
        </span>
      </div>
      
      {/* HLS mode indicator */}
      {usingHlsFallback && (
        <div className="absolute top-4 right-4 bg-blue-500/80 text-white px-2 py-1 rounded text-xs font-medium">
          HLS MODE
        </div>
      )}
      
      {/* Connecting indicator */}
      {!streamReady && !error && !usingHlsFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-white text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" role="status">
              <span className="sr-only">Loading...</span>
            </div>
            <div className="mt-2">
              Connecting to stream...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}