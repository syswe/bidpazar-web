"use client";

// src/app/(streams)/live-streams/[id]/components/WebRTCStreamManager.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { useAuth } from '@/components/AuthProvider';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import DeviceSelector from './DeviceSelector';
import { getAuth } from "@/lib/frontend-auth";
import { v4 as uuidv4 } from 'uuid';
import { io, Socket } from 'socket.io-client';
import { Loader2, Volume2, VolumeX, Video, VideoOff, Settings, AlertTriangle } from 'lucide-react';
import { Device } from 'mediasoup-client';
import { logger } from '@/lib/logger';

// ===================== LOGGING SYSTEM =====================
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
} as const;

type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];
type LogData = Record<string, any> | null | undefined;

// Set to desired log level (can be controlled via environment variable in production)
const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

// Log formatting helper functions
const formatTimestamp = () => new Date().toISOString();
const formatLogPrefix = () => '[WebRTC]';

// Main logging function
const log = (level: LogLevel, message: string, data: LogData = null) => {
  if (level > CURRENT_LOG_LEVEL) return;
  
  const timestamp = formatTimestamp();
  const prefix = formatLogPrefix();
  let formattedData = '';
  
  if (data) {
    try {
      formattedData = JSON.stringify(data, (key, value) => {
        // Handle circular references
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object' && value !== null) {
          // Handle special objects
          if (value instanceof RTCPeerConnection) return `[RTCPeerConnection:${value.connectionState}]`;
          if (value instanceof MediaStream) return '[MediaStream]';
          if (value instanceof MediaStreamTrack) return `[${value.kind}Track:${value.label}]`;
        }
        return value;
      }, 2);
    } catch (e) {
      formattedData = '[Unserializable data]';
    }
  }
  
  const logMessage = `${timestamp} ${prefix} ${message}`;
  
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(`%c${logMessage}`, 'color: #FF5555; font-weight: bold', formattedData || '');
      break;
    case LOG_LEVELS.WARN:
      console.warn(`%c${logMessage}`, 'color: #FFAA00', formattedData || '');
      break;
    case LOG_LEVELS.INFO:
      console.info(`%c${logMessage}`, 'color: #55AAFF', formattedData || '');
      break;
    case LOG_LEVELS.DEBUG:
      console.log(`%c${logMessage}`, 'color: #AAAAAA', formattedData || '');
      break;
    case LOG_LEVELS.TRACE:
      console.log(`%c${logMessage}`, 'color: #666666', formattedData || '');
      break;
  }
  
  // Mark performance timeline for debugging
  try {
    performance.mark(`webrtc-${level}-${Date.now()}`);
  } catch (e) {
    // Ignore if performance API is not available
  }
};

// Convenience logging methods
const logError = (message: string, data?: LogData) => log(LOG_LEVELS.ERROR, message, data);
const logWarn = (message: string, data?: LogData) => log(LOG_LEVELS.WARN, message, data);
const logInfo = (message: string, data?: LogData) => log(LOG_LEVELS.INFO, message, data);
const logDebug = (message: string, data?: LogData) => log(LOG_LEVELS.DEBUG, message, data);
const logTrace = (message: string, data?: LogData) => log(LOG_LEVELS.TRACE, message, data);

// Format unknown errors for consistent logging
const formatError = (err: unknown): Record<string, any> => {
  if (err instanceof Error) {
    return { 
      message: err.message,
      name: err.name,
      stack: err.stack 
    };
  } else if (typeof err === 'string') {
    return { message: err };
  } else if (typeof err === 'object' && err !== null) {
    return { ...err };
  }
  return { unknownError: String(err) };
};

// ===================== WEBRTC CONFIG =====================
const getIceServers = (config: any | null): RTCIceServer[] => {
  // Default to public STUN servers if no config is available
  if (!config) {
    logWarn('No runtime config available for ICE servers, using public fallbacks');
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  const iceServers: RTCIceServer[] = [];
  
  // Add multiple STUN servers for better connectivity
  // Google's public STUN servers are well maintained and broadly accessible
  iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
  iceServers.push({ urls: 'stun:stun1.l.google.com:19302' });
  
  // Add configured STUN server if available
  if (config.stunServerUrl && !iceServers.some(server => server.urls === config.stunServerUrl)) {
    iceServers.push({ urls: config.stunServerUrl });
    logInfo('Added configured STUN server to ICE configuration', { url: config.stunServerUrl });
  }
  
  // Add TURN server if credentials are configured
  if (config.turnServerUrl && config.turnUsername && config.turnPassword) {
    iceServers.push({
      urls: config.turnServerUrl,
      username: config.turnUsername,
      credential: config.turnPassword,
    });
    logInfo('Added TURN server to ICE configuration', { 
      url: config.turnServerUrl,
      username: config.turnUsername 
    });
  }
  
  // Ensure we have at least one TURN server for NAT traversal
  // This is critical for users behind symmetric NATs
  if (!iceServers.some(server => String(server.urls).startsWith('turn:'))) {
    logWarn('No TURN server configured, NAT traversal may fail for some users');
  }
  
  logDebug('Using ICE servers', { serverCount: iceServers.length, servers: iceServers });
  return iceServers;
};

// ===================== COMPONENT TYPES =====================
interface WebRTCStreamManagerProps {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
  onParticipantCount?: (count: number) => void;
  className?: string;
}

// ===================== MAIN COMPONENT =====================
export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
  onParticipantCount,
  className,
}: WebRTCStreamManagerProps) {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  logInfo('Component initialized', { streamId, userId, username, isStreamer });
  
  // =========== AUTH STATE ===========
  const { user } = useAuth();
  const { token } = getAuth();
  
  // For anonymous viewers
  const anonymousId = useRef<string>(uuidv4()).current;
  const effectiveUserId = userId || `anon-${anonymousId}`;
  const effectiveUsername = username || `viewer-${anonymousId.slice(0, 8)}`;
  
  // =========== COMPONENT STATE ===========
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number>(0);
  const [streamReady, setStreamReady] = useState(false);
  const [isMuted, setIsMuted] = useState(isStreamer ? false : true); // Streamers unmuted, viewers muted by default
  const [isVideoHidden, setIsVideoHidden] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState<boolean>(isStreamer);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | undefined>(undefined);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(undefined);
  
  // =========== REFS ===========
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const transportRef = useRef<{
    producer?: mediasoupClient.types.Transport | null,
    consumer?: mediasoupClient.types.Transport | null
  }>({ producer: null, consumer: null });
  const producersRef = useRef<{
    video?: mediasoupClient.types.Producer | null,
    audio?: mediasoupClient.types.Producer | null
  }>({ video: null, audio: null });
  const consumersRef = useRef<{
    video?: mediasoupClient.types.Consumer | null,
    audio?: mediasoupClient.types.Consumer | null
  }>({ video: null, audio: null });
  const connectionAttemptsRef = useRef<number>(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const mountedRef = useRef<boolean>(false);
  const didInitialSetupRef = useRef<boolean>(false);
  
  // Maximum connection attempts before giving up
  const MAX_CONNECTION_ATTEMPTS = 5;
  // Retry delays in milliseconds
  const RETRY_DELAYS = [1000, 2000, 3000, 5000, 8000];
  
  // =========== SOCKET CONNECTION =====================
  // Connect to WebRTC signaling server
  const connectToSignalingServer = async () => {
    // Wait for runtime config to be ready
    if (isConfigLoading) {
      logWarn('Runtime config still loading, using fallback values if needed');
    }
    
    // Use fallback values if runtime config is not available
    const socketUrl = runtimeConfig?.socketUrl || window.location.origin;
    
    // Fix: ensure wsUrl doesn't contain duplicate /api paths
    const baseWsUrl = window.location.origin.replace(/^http/, 'ws');
    const wsUrl = runtimeConfig?.wsUrl || baseWsUrl;
    
    if (!socketUrl) {
      logError('Cannot connect to signaling server: No Socket URL available', { 
        isConfigLoading,
        hasConfig: !!runtimeConfig
      });
      setError("Configuration Error: Socket URL not found."); // Set error state
      setConnectionStatus('disconnected');
      return;
    }

    // Close any existing connection
    if (socketRef.current) {
      logInfo('Closing existing socket connection before reconnecting');
      socketRef.current.close();
      socketRef.current = null;
    }

    // Make sure we have valid URLs
    let finalSocketUrl = socketUrl;
    
    // Fix common issues with socket URL formatting
    if (finalSocketUrl.startsWith('https://')) {
      finalSocketUrl = finalSocketUrl.replace('https://', 'wss://');
      logWarn('Socket URL corrected from HTTPS to WSS', { correctedUrl: finalSocketUrl });
    } else if (finalSocketUrl.startsWith('http://')) {
      finalSocketUrl = finalSocketUrl.replace('http://', 'ws://');
      logWarn('Socket URL corrected from HTTP to WS', { correctedUrl: finalSocketUrl });
    }
    
    // Ensure URL doesn't end with a slash before adding path
    const fullSocketUrl = finalSocketUrl.endsWith('/') ? finalSocketUrl.slice(0, -1) : finalSocketUrl;
    
    try {
      logInfo('Connecting to signaling server', { 
        url: wsUrl,
        userId: effectiveUserId,
        streamId
      });
      
      const socket = io(fullSocketUrl, {
        path: '/socket.io',
        query: {
          streamId,
          userId: effectiveUserId,
          username: effectiveUsername,
          isStreamer: isStreamer ? 1 : 0
        },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      socketRef.current = socket;
      
      // Set up socket event handlers
      socket.on('connect', () => {
        logInfo('Socket connected', {
          socketId: socket.id,
        });
        
        setConnectionStatus('connected');
        setError(null);
        connectionAttemptsRef.current = 0;
        
        // Request router capabilities after successful connection
        socket.emit('getRouterRtpCapabilities', { streamId }, (response: any) => {
          if (response.error) {
            logError('Failed to get router capabilities', { error: response.error });
            setError(`Failed to initialize media: ${response.error}`);
            return;
          }
          
          logInfo('Received router capabilities', { capabilities: response.rtpCapabilities });
          initializeMediasoupDevice(response.rtpCapabilities);
        });
      });
      
      socket.on('connect_error', (err) => {
        logError('Socket connection attempt failed (connect_error)', {
          message: err.message,
          name: err.name,
          data: (err as any).data, // err.data might contain more context
          url: fullSocketUrl, // Log the URL attempted
          path: '/socket.io',
          query: { streamId, userId: effectiveUserId, username: effectiveUsername, isStreamer: isStreamer ? 1 : 0 }
        });
        setError(`Signaling server connection failed: ${err.message}. Will retry.`);
        setConnectionStatus('disconnected'); // Ensure status reflects this
        // Reconnection is typically handled by socket.io's built-in mechanism or the 'disconnect' event handler
      });
      
      socket.on('disconnect', (reason) => {
        logger.warn('Socket disconnected', { reason });
        
        setConnectionStatus('disconnected');
        
        // Attempt to reconnect if component is still mounted
        if (mountedRef.current && connectionAttemptsRef.current < MAX_CONNECTION_ATTEMPTS) {
          const nextAttempt = connectionAttemptsRef.current + 1;
          logger.info('Scheduling reconnection attempt', { 
            attempt: nextAttempt, 
            maxAttempts: MAX_CONNECTION_ATTEMPTS 
          });
          
          connectionAttemptsRef.current = nextAttempt;
          
          const timeout = setTimeout(() => {
            if (mountedRef.current) {
              connectToSignalingServer();
            }
          }, RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)]);
          
          timeoutsRef.current.push(timeout);
        } else if (connectionAttemptsRef.current >= MAX_CONNECTION_ATTEMPTS) {
          logger.error('Maximum reconnection attempts reached');
          setError('Failed to connect after multiple attempts. Please refresh the page.');
        }
      });
      
      socket.on('error', (err) => {
        logger.error('Socket connection error', formatError(err));
        setError('Connection error occurred. Please check your network.');
      });
      
      // Set up MediaSoup message handlers
      socket.on('routerCapabilities', async (routerRtpCapabilities) => {
        logger.info('Received router capabilities');
        
        // Initialize the MediaSoup device with router capabilities
        const device = await initializeMediasoupDevice(routerRtpCapabilities);
        
        if (device) {
          if (isStreamer) {
            // Request to create a producer transport
            socket.emit('createProducerTransport', { 
              forceTcp: false,
              rtpCapabilities: device.rtpCapabilities
            });
            
            // For streamers, capture local media
            await captureLocalMedia();
          } else {
            // Request to create a consumer transport for viewers
            socket.emit('createConsumerTransport', { 
              forceTcp: false,
              rtpCapabilities: device.rtpCapabilities
            });
          }
        }
      });
      
      socket.on('producerTransportCreated', async (transportOptions) => {
        logger.info('Producer transport created by server');
        
        if (isStreamer) {
          const transport = await setupProducerTransport(transportOptions);
          
          if (transport && localStreamRef.current) {
            await produceLocalMedia(transport, localStreamRef.current);
          }
        }
      });
      
      socket.on('consumerTransportCreated', async (transportOptions) => {
        logger.info('Consumer transport created by server');
        
        if (!isStreamer) {
          await setupConsumerTransport(transportOptions);
        }
      });
      
      socket.on('consumerCreated', async (consumerData) => {
        logger.info('Consumer created by server', { kind: consumerData.kind });
        await handleConsume(consumerData);
      });
      
      socket.on('connectionStats', (stats) => {
        logger.debug('Connection stats received', stats);
        
        if (stats && typeof stats.participants === 'number') {
          setParticipants(stats.participants);
          onParticipantCount?.(stats.participants);
        }
      });
      
      return socket;
    } catch (err) {
      logError('Error connecting to signaling server', formatError(err));
      setError('Failed to connect to streaming server');
      setConnectionStatus('disconnected');
      
      // Try to reconnect if not at max attempts
      if (connectionAttemptsRef.current < MAX_CONNECTION_ATTEMPTS) {
        connectionAttemptsRef.current++;
        const delay = RETRY_DELAYS[Math.min(connectionAttemptsRef.current - 1, RETRY_DELAYS.length - 1)];
        
        logInfo(`Scheduling reconnection attempt ${connectionAttemptsRef.current}/${MAX_CONNECTION_ATTEMPTS} in ${delay}ms`);
        
        const timeoutId = setTimeout(() => {
          if (mountedRef.current) {
            connectToSignalingServer();
          }
        }, delay);
        
        timeoutsRef.current.push(timeoutId);
      } else {
        logError('Max reconnection attempts reached, giving up', { attempts: connectionAttemptsRef.current });
      }
    }
  };
  
  // =========== MEDIASOUP UTILITIES ===========
  /**
   * Initialize MediaSoup device with router capabilities
   */
  const initializeMediasoupDevice = useCallback(async (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
    try {
      logger.debug('Initializing MediaSoup device');
      
      // Create a new MediaSoup device
      const device = new mediasoupClient.Device();
      
      // Load router RTP capabilities
      await device.load({ routerRtpCapabilities });
      
      logger.info('MediaSoup device initialized successfully', {
        canSend: device.canProduce('video') && device.canProduce('audio'),
        canReceive: device.loaded
      });
      
      deviceRef.current = device;
      return device;
    } catch (err) {
      logger.error('Failed to initialize MediaSoup device', formatError(err));
      setError('Failed to initialize media device. Please reload and try again.');
      return null;
    }
  }, []);
  
  /**
   * Create and set up a producer transport for the streamer
   */
  const setupProducerTransport = useCallback(async (transportOptions: any) => {
    if (!deviceRef.current) {
      logger.error('Cannot set up producer transport: Device not initialized');
      return null;
    }
    
    if (isConfigLoading || !runtimeConfig) { 
      logError('Cannot set up producer transport: Runtime config not ready');
      return null;
    }
    
    try {
      logger.debug('Creating producer transport', transportOptions);
      
      // Get ICE servers using runtime config
      const iceServers = getIceServers(runtimeConfig); 
      
      // Create the transport
      const transport = deviceRef.current.createSendTransport({
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
        iceServers: iceServers, // Use runtime ICE servers
      });
      
      logger.info('Producer transport created', { transportId: transport.id });
      
      // Set up transport connection events
      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        logger.debug('Producer transport connect event', { transportId: transport.id });
        
        try {
          if (!socketRef.current?.connected) {
            throw new Error('Socket not connected');
          }
          
          socketRef.current.emit('connectProducerTransport', {
            transportId: transport.id,
            dtlsParameters
          });
          
          callback();
        } catch (err) {
          logger.error('Producer transport connect failed', formatError(err));
          errback(err as Error);
        }
      });
      
      // Handle produce events
      transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        logger.debug('Producer transport produce event', { 
          transportId: transport.id, 
          kind, 
          appData 
        });
        
        try {
          if (!socketRef.current?.connected) {
            throw new Error('Socket not connected');
          }
          
          // Tell the server to create a Producer with the given RTP parameters
          socketRef.current.emit('produce', {
            transportId: transport.id,
            kind,
            rtpParameters,
            appData: {
              ...appData,
              streamId,
              userId: effectiveUserId
            }
          }, (response: { id: string }) => {
            // Server responds with the Producer's id
            logger.debug('Produce response from server', { producerId: response.id });
            callback({ id: response.id });
          });
        } catch (err) {
          logger.error('Producer transport produce failed', formatError(err));
          errback(err as Error);
        }
      });
      
      // Handle connection state changes
      transport.on('connectionstatechange', (state) => {
        logger.info('Producer transport connection state changed', { 
          transportId: transport.id, 
          state 
        });
        
        if (state === 'connected') {
          // Transport successfully connected
          logger.info('Producer transport successfully connected');
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          logger.error('Producer transport connection failed or closed', { state });
          
          if (mountedRef.current) {
            setError(`Connection ${state}. Please try again.`);
          }
        }
      });
      
      transportRef.current.producer = transport;
      return transport;
    } catch (err) {
      logger.error('Failed to set up producer transport', formatError(err));
      setError('Failed to set up media connection. Please reload and try again.');
      return null;
    }
  }, [streamId, effectiveUserId, runtimeConfig, isConfigLoading]);
  
  /**
   * Create and set up a consumer transport for the viewer
   */
  const setupConsumerTransport = useCallback(async (transportOptions: any) => {
    if (!deviceRef.current) {
      logger.error('Cannot set up consumer transport: Device not initialized');
      return null;
    }
    
    if (isConfigLoading || !runtimeConfig) {
      logError('Cannot set up consumer transport: Runtime config not ready');
      return null;
    }
    
    try {
      logger.debug('Creating consumer transport', transportOptions);
      
      // Get ICE servers using runtime config
      const iceServers = getIceServers(runtimeConfig);
      
      // Create the transport
      const transport = deviceRef.current.createRecvTransport({
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
        iceServers: iceServers, // Use runtime ICE servers
      });
      
      logger.info('Consumer transport created', { transportId: transport.id });
      
      // Set up transport connection events
      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        logger.debug('Consumer transport connect event', { transportId: transport.id });
        
        try {
          if (!socketRef.current?.connected) {
            throw new Error('Socket not connected');
          }
          
          socketRef.current.emit('connectConsumerTransport', {
            transportId: transport.id,
            dtlsParameters
          });
          
          callback();
        } catch (err) {
          logger.error('Consumer transport connect failed', formatError(err));
          errback(err as Error);
        }
      });
      
      // Handle connection state changes
      transport.on('connectionstatechange', (state) => {
        logger.info('Consumer transport connection state changed', { 
          transportId: transport.id, 
          state 
        });
        
        if (state === 'connected') {
          // Transport successfully connected
          logger.info('Consumer transport successfully connected');
          
          // Request to consume available producers
          if (socketRef.current?.connected && deviceRef.current) {
            socketRef.current.emit('consume', {
              streamId,
              transportId: transport.id,
              rtpCapabilities: deviceRef.current.rtpCapabilities
            });
          }
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          logger.error('Consumer transport connection failed or closed', { state });
          
          if (mountedRef.current) {
            setError(`Connection ${state}. Please try again.`);
          }
        }
      });
      
      transportRef.current.consumer = transport;
      return transport;
    } catch (err) {
      logger.error('Failed to set up consumer transport', formatError(err));
      setError('Failed to set up media connection. Please reload and try again.');
      return null;
    }
  }, [streamId, runtimeConfig, isConfigLoading]);
  
  /**
   * Create media producers with the local stream
   */
  const produceLocalMedia = useCallback(async (transport: mediasoupClient.types.Transport, stream: MediaStream) => {
    try {
      // Close existing producers
      if (producersRef.current.video) {
        producersRef.current.video.close();
        producersRef.current.video = null;
      }
      
      if (producersRef.current.audio) {
        producersRef.current.audio.close();
        producersRef.current.audio = null;
      }
      
      // Create video producer if we have video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        logger.debug('Creating video producer', { 
          track: videoTracks[0].label,
          enabled: videoTracks[0].enabled
        });
        
        const videoProducer = await transport.produce({
          track: videoTracks[0],
          encodings: [
            { maxBitrate: 500000, scaleResolutionDownBy: 1 },
            { maxBitrate: 1000000, scaleResolutionDownBy: 1 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000
          },
          codec: deviceRef.current?.rtpCapabilities.codecs?.find(c => 
            c.mimeType.toLowerCase() === 'video/h264'
          )
        });
        
        logger.info('Video producer created', { producerId: videoProducer.id });
        producersRef.current.video = videoProducer;
        
        // Handle producer events
        videoProducer.on('transportclose', () => {
          logger.info('Video producer transport closed');
          producersRef.current.video = null;
        });
        
        videoProducer.on('trackended', () => {
          logger.info('Video track ended');
          videoProducer.close();
          producersRef.current.video = null;
        });
      }
      
      // Create audio producer if we have audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        logger.debug('Creating audio producer', { 
          track: audioTracks[0].label,
          enabled: audioTracks[0].enabled
        });
        
        const audioProducer = await transport.produce({
          track: audioTracks[0],
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
            opusFec: true,
            opusMaxPlaybackRate: 48000
          }
        });
        
        logger.info('Audio producer created', { producerId: audioProducer.id });
        producersRef.current.audio = audioProducer;
        
        // Handle producer events
        audioProducer.on('transportclose', () => {
          logger.info('Audio producer transport closed');
          producersRef.current.audio = null;
        });
        
        audioProducer.on('trackended', () => {
          logger.info('Audio track ended');
          audioProducer.close();
          producersRef.current.audio = null;
        });
      }
      
      setStreamReady(true);
      return true;
    } catch (err) {
      logger.error('Failed to produce media', formatError(err));
      setError('Failed to publish media stream. Please check your device permissions.');
      return false;
    }
  }, []);
  
  /**
   * Handle consuming a remote producer
   */
  const handleConsume = useCallback(async (consumerData: any) => {
    if (!deviceRef.current || !transportRef.current.consumer) {
      logger.error('Cannot consume: Device or transport not ready');
      return false;
    }
    
    try {
      const { consumerId, producerId, kind, rtpParameters } = consumerData;
      
      logger.debug('Consuming remote producer', { 
        consumerId, 
        producerId, 
        kind 
      });
      
      // Create the consumer
      const consumer = await transportRef.current.consumer.consume({
        id: consumerId,
        producerId,
        kind,
        rtpParameters,
      });
      
      logger.info('Consumer created', { 
        consumerId: consumer.id, 
        kind: consumer.kind 
      });
      
      // Store the consumer reference
      if (kind === 'video') {
        consumersRef.current.video = consumer;
      } else if (kind === 'audio') {
        consumersRef.current.audio = consumer;
      }
      
      // Create a MediaStream from the consumer track
      const stream = new MediaStream([consumer.track]);
      
      // Display the stream if we're a viewer
      if (videoRef.current) {
        if (kind === 'video') {
          // If we already have a stream with audio, add the video track to it
          if (videoRef.current.srcObject instanceof MediaStream) {
            const existingStream = videoRef.current.srcObject as MediaStream;
            existingStream.addTrack(consumer.track);
          } else {
            videoRef.current.srcObject = stream;
          }
        } else if (kind === 'audio') {
          // If we already have a stream with video, add the audio track to it
          if (videoRef.current.srcObject instanceof MediaStream) {
            const existingStream = videoRef.current.srcObject as MediaStream;
            existingStream.addTrack(consumer.track);
          } else {
            videoRef.current.srcObject = stream;
          }
          
          // Make sure audio is correctly muted based on user preference
          videoRef.current.muted = isMuted;
        }
        
        setStreamReady(true);
      }
      
      return true;
    } catch (err) {
      logger.error('Error consuming media', formatError(err));
      setError('Failed to receive media stream. Please reload and try again.');
      return false;
    }
  }, [isMuted]);
  
  /**
   * Handle streamer's device selection change
   */
  const handleDeviceChange = useCallback((type: 'audio' | 'video', deviceId: string) => {
    if (type === 'audio') {
      setSelectedAudioDevice(deviceId);
      logger.info('Audio device changed', { deviceId });
    } else if (type === 'video') {
      setSelectedVideoDevice(deviceId);
      logger.info('Video device changed', { deviceId });
    }

    // If already streaming, apply the change
    if (connectionStatus === 'connected' && isStreamer) {
      // We'll recapture media with the new device selection
      // This will be handled in the useEffect that depends on selectedAudioDevice/selectedVideoDevice
    }
  }, [connectionStatus, isStreamer]);
  
  /**
   * Capture local media with selected devices (for streamers)
   */
  const captureLocalMedia = useCallback(async () => {
    if (!isStreamer) return null;
    
    try {
      logger.info('Capturing local media');
      
      // Stop any existing streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Detect platform for optimal constraints
      const isFirefox = navigator.userAgent.includes('Firefox');
      const isChrome = navigator.userAgent.includes('Chrome');
      const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Configure constraints based on selected devices and platform
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice 
          ? {
              deviceId: { exact: selectedVideoDevice },
              width: isMobile ? { ideal: 720 } : { ideal: 1280 },
              height: isMobile ? { ideal: 480 } : { ideal: 720 },
              frameRate: { ideal: 30, max: 30 }
            }
          : {
              width: isMobile ? { ideal: 720 } : { ideal: 1280 },
              height: isMobile ? { ideal: 480 } : { ideal: 720 },
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
      
      logger.debug('getUserMedia constraints', {
        ...constraints,
        browserInfo: { isFirefox, isChrome, isSafari, isMobile }
      });
      
      // Get media stream with selected devices
      let stream: MediaStream;
      
      try {
        // First try with the full constraints
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        logger.warn('Failed to get media with full constraints, falling back to basic constraints', formatError(err));
        
        // Fall back to more basic constraints
        const fallbackConstraints: MediaStreamConstraints = {
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
        };
        
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }
      
      logger.info('Local media stream obtained', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackSettings: stream.getVideoTracks()[0]?.getSettings(),
        audioTrackSettings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      localStreamRef.current = stream;
      
      // Display the local stream in the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Always mute local preview to prevent feedback
        
        // Try to play the video immediately
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // This often happens due to autoplay policies
          logger.warn('Could not autoplay video preview, user may need to interact', formatError(playErr));
        }
      }
      
      // If we already have a producer transport, produce with the new stream
      if (transportRef.current.producer) {
        logger.info('Producing with new media stream');
        await produceLocalMedia(transportRef.current.producer, stream);
      }
      
      setStreamReady(true);
      return stream;
    } catch (err) {
      logger.error('Error accessing media devices', formatError(err));
      
      // Provide more specific error message
      if ((err as any)?.name === 'NotAllowedError') {
        setError('Camera/microphone access denied. Please check your browser permissions.');
      } else if ((err as any)?.name === 'NotFoundError') {
        setError('Camera or microphone not found. Please check your device connections.');
      } else if ((err as any)?.name === 'NotReadableError') {
        setError('Could not access your camera/microphone. They may be in use by another application.');
      } else {
        setError('Failed to access camera or microphone. Please check your permissions.');
      }
      
      return null;
    }
  }, [isStreamer, selectedVideoDevice, selectedAudioDevice, produceLocalMedia]);
  
  // =========== MEDIA CONTROLS ===========
  /**
   * Toggle audio mute state
   */
  const toggleMute = useCallback(() => {
    logger.info('Toggling audio mute state');
    
    setIsMuted(prev => !prev);
    
    if (isStreamer && localStreamRef.current) {
      // Mute/unmute outgoing audio for streamers
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted; // Toggle to opposite of current state
      });
    }
    
    // Mute/unmute the video element for viewers
    if (videoRef.current) {
      videoRef.current.muted = !isMuted; // Toggle to opposite of current state
    }
  }, [isStreamer, isMuted]);
  
  /**
   * Toggle video visibility
   */
  const toggleVideo = useCallback(() => {
    logger.info('Toggling video visibility');
    
    setIsVideoHidden(prev => !prev);
    
    if (isStreamer && localStreamRef.current) {
      // Enable/disable outgoing video
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoHidden; // Toggle to opposite of current state
      });
    }
  }, [isStreamer, isVideoHidden]);
  
  // =========== EFFECTS ===========
  // Initialize component
  useEffect(() => {
    mountedRef.current = true;
    logInfo('Component mounted', { streamId, isStreamer });
    
    // Only connect when we have a valid runtime config
    if (!isConfigLoading && runtimeConfig) {
      logInfo('Runtime config ready, connecting to signaling server');
      connectToSignalingServer();
      didInitialSetupRef.current = true;
    }
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      logInfo('Component unmounting, cleaning up resources');
      
      // Clear all pending timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      
      // Close socket connection
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      // Close peer connection
      if (transportRef.current.producer) {
        transportRef.current.producer.close();
        transportRef.current.producer = null;
      }
      
      if (transportRef.current.consumer) {
        transportRef.current.consumer.close();
        transportRef.current.consumer = null;
      }
      
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [streamId, userId, isStreamer, runtimeConfig, isConfigLoading]);
  
  // Watch for runtime config availability and connect when it's ready
  useEffect(() => {
    if (!didInitialSetupRef.current && !isConfigLoading && runtimeConfig) {
      logInfo('Runtime config now available, initializing connection');
      connectToSignalingServer();
      didInitialSetupRef.current = true;
    }
  }, [isConfigLoading, runtimeConfig]);
  
  // Effect to handle device changes after initial setup
  useEffect(() => {
    if (connectionStatus === 'connected' && isStreamer && mountedRef.current) {
      // Skip the first render
      if (didInitialSetupRef.current) {
        logger.info('Device selection changed, recapturing media');
        
        // Schedule device change after state updates
        const timeoutId = setTimeout(() => {
          if (mountedRef.current) {
            logger.info('Recapturing media with new device selection');
            captureLocalMedia();
          }
        }, 100);
        
        return () => clearTimeout(timeoutId);
      } else {
        didInitialSetupRef.current = true;
      }
    }
  }, [selectedAudioDevice, selectedVideoDevice, connectionStatus, isStreamer]);
  
  // =========== RENDER ===========
  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isStreamer || isMuted}
        className={`w-full h-full object-cover ${isVideoHidden ? 'invisible' : 'visible'}`}
      />
      
      {/* Loading indicator */}
      {connectionStatus !== 'connected' && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-white mx-auto mb-2" />
            <div className="text-white font-medium">
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/80 text-white p-2 text-sm text-center flex items-center justify-center z-20">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
      
      {/* Stream info overlay */}
      {connectionStatus === 'connected' && (
        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2 z-10">
          <div className={`h-2 w-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-xs font-medium">
            {participants > 0 ? `${participants} viewer${participants !== 1 ? 's' : ''}` : 'Live'}
          </span>
        </div>
      )}

      {/* Media controls */}
      <div className="absolute bottom-4 left-4 flex space-x-2 z-10">
        {/* Audio toggle button */}
        <button
          onClick={toggleMute}
          className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
        
        {/* Video toggle button (for streamers only) */}
        {isStreamer && (
          <button
            onClick={toggleVideo}
            className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            aria-label={isVideoHidden ? "Show video" : "Hide video"}
            title={isVideoHidden ? "Show video" : "Hide video"}
          >
            {isVideoHidden ? (
              <VideoOff className="w-5 h-5" />
            ) : (
              <Video className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
      
      {/* Device selector (for streamers only) */}
      <div className={`absolute top-4 right-4 z-10 ${!isStreamer ? 'hide-for-viewers' : ''}`}>
        <button
          onClick={() => setShowDeviceSelector(prev => !prev)}
          className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          aria-label={showDeviceSelector ? "Hide device settings" : "Show device settings"}
          title={showDeviceSelector ? "Hide device settings" : "Show device settings"}
        >
          <Settings className="w-5 h-5" />
        </button>
        
        {showDeviceSelector && (
          <div className="absolute right-0 w-72 mt-2 bg-background/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden border border-border">
            <DeviceSelector
              onDeviceChange={handleDeviceChange}
              initialVideoDeviceId={selectedVideoDevice}
              initialAudioDeviceId={selectedAudioDevice}
            />
          </div>
        )}
      </div>
      
      {/* Not ready overlay */}
      {!streamReady && !error && connectionStatus === 'connected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <div className="font-medium">
              {isStreamer ? 'Setting up camera...' : 'Waiting for stream...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
      