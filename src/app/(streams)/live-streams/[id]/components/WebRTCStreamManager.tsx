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
// import WebSocket from 'ws';

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
const CURRENT_LOG_LEVEL = LOG_LEVELS.TRACE; // For detailed debugging

// Enable sending logs to server in production
const SEND_LOGS_TO_SERVER = process.env.NODE_ENV === 'production';
const DIAGNOSTIC_LOG_SIZE = 100; // Keep last 100 logs for diagnostics
const diagnosticLogs: string[] = [];

// Set up WebRTC native debug logging if available
const setupWebRTCDebugLogging = () => {
  try {
    // Enable WebRTC internal logs - available in Chrome
    if ((window as any).webrtcHacks === undefined) {
      (window as any).webrtcHacks = {};
    }
    
    // Store original console logging functions
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Tap into WebRTC specific log messages
    const isWebRTCLog = (args: any[]) => {
      if (args.length === 0) return false;
      const firstArg = String(args[0]);
      return (
        firstArg.includes('RTCPeerConnection') ||
        firstArg.includes('RTCIceCandidate') ||
        firstArg.includes('RTCSessionDescription') ||
        firstArg.includes('RTCRtpSender') ||
        firstArg.includes('RTCRtpReceiver') ||
        firstArg.includes('ICE') ||
        firstArg.includes('SDP') ||
        firstArg.includes('RTP') ||
        firstArg.includes('SRTP') ||
        firstArg.includes('DTLS') ||
        firstArg.includes('SCTP')
      );
    };

    // Override console.log to capture WebRTC logs
    console.log = function(...args: any[]) {
      // Call original function
      originalConsoleLog.apply(console, args);
      
      // Capture WebRTC logs
      if (isWebRTCLog(args)) {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        diagnosticLogs.push(`${new Date().toISOString()} [WebRTC-Native] ${message}`);
        
        // Trim logs if they get too large
        if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
          diagnosticLogs.shift();
        }
      }
    };

    // Similar for console.error
    console.error = function(...args: any[]) {
      originalConsoleError.apply(console, args);
      if (isWebRTCLog(args)) {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        diagnosticLogs.push(`${new Date().toISOString()} [WebRTC-Native-Error] ${message}`);
        if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
          diagnosticLogs.shift();
        }
      }
    };

    // Similar for console.warn
    console.warn = function(...args: any[]) {
      originalConsoleWarn.apply(console, args);
      if (isWebRTCLog(args)) {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        diagnosticLogs.push(`${new Date().toISOString()} [WebRTC-Native-Warn] ${message}`);
        if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
          diagnosticLogs.shift();
        }
      }
    };

    // Try to enable WebRTC logs in Chrome
    if ((window as any).webrtcLogs === undefined) {
      (window as any).webrtcLogs = true;
    }

    // Try to enable debug logging in Firefox
    if (navigator.userAgent.indexOf("Firefox") !== -1) {
      try {
        // Set Firefox WebRTC logging pref if possible
        (window as any).localStorage.setItem('debug', 'webrtc*');
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    return true;
  } catch (e) {
    // Ignore errors in debug setup
    return false;
  }
};

// Initialize WebRTC debug logging when the file loads
setupWebRTCDebugLogging();

// Log formatting helper functions
const formatTimestamp = () => new Date().toISOString();
const formatLogPrefix = () => '[WebRTC]';

// Helper to send logs to server for debugging
const sendLogsToServer = (userId: string, streamId: string, message: string) => {
  if (!SEND_LOGS_TO_SERVER) return;
  
  try {
    fetch('/api/logs/webrtc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        streamId,
        message,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        // Include info about client device/browser
        clientInfo: {
          platform: navigator.platform,
          vendor: navigator.vendor,
          language: navigator.language,
          deviceMemory: (navigator as any).deviceMemory,
          hardwareConcurrency: navigator.hardwareConcurrency,
          connectionType: (navigator as any).connection?.effectiveType || 'unknown'
        }
      })
    }).catch(e => console.error('Failed to send logs to server:', e));
  } catch (e) {
    // Silently fail if log sending fails
  }
};

// Main logging function
const log = (level: LogLevel, message: string, data: LogData = null, userId?: string, streamId?: string) => {
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

  // Store log in diagnostic logs array (with circular reference handling)
  const diagnosticLog = `${timestamp} [${Object.keys(LOG_LEVELS).find(key => 
    LOG_LEVELS[key as keyof typeof LOG_LEVELS] === level)}] ${message} ${formattedData || ''}`;
  
  diagnosticLogs.push(diagnosticLog);
  if (diagnosticLogs.length > DIAGNOSTIC_LOG_SIZE) {
    diagnosticLogs.shift(); // Remove oldest log if we exceed capacity
  }
  
  // For critical errors, send logs to server for diagnostics
  if (level === LOG_LEVELS.ERROR && userId && streamId) {
    sendLogsToServer(userId, streamId, `${message} ${formattedData || ''}`);
  }
  
  // Mark performance timeline for debugging
  try {
    performance.mark(`webrtc-${level}-${Date.now()}`);
  } catch (e) {
    // Ignore if performance API is not available
  }
};

// Convenience logging methods with userId/streamId forwarding
const logError = (message: string, data?: LogData, userId?: string, streamId?: string) => 
  log(LOG_LEVELS.ERROR, message, data, userId, streamId);
const logWarn = (message: string, data?: LogData) => log(LOG_LEVELS.WARN, message, data);
const logInfo = (message: string, data?: LogData) => log(LOG_LEVELS.INFO, message, data);
const logDebug = (message: string, data?: LogData) => log(LOG_LEVELS.DEBUG, message, data);
const logTrace = (message: string, data?: LogData) => log(LOG_LEVELS.TRACE, message, data);

// Helper to get diagnostic logs as a string
const getDiagnosticLogs = () => diagnosticLogs.join('\\n');

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
  // Default to empty array if no config is available
  if (!config) {
    logWarn('No runtime config available for ICE servers');
    return [];
  }

  const iceServers: RTCIceServer[] = [];
  
  // Add configured STUN server if available
  if (config.stunServerUrl) {
    iceServers.push({ urls: config.stunServerUrl });
    logInfo('Added configured STUN server to ICE configuration', { url: config.stunServerUrl });
  }
  
  // Add TURN server if credentials are configured
  if (config.turnServerUrl && config.turnUsername && config.turnPassword) {
    // Add UDP TURN server (default)
    iceServers.push({
      urls: config.turnServerUrl,
      username: config.turnUsername,
      credential: config.turnPassword,
    });
    
    // Add TCP TURN server option for firewall traversal
    // First check if the URL already specifies a transport
    if (!config.turnServerUrl.includes('?transport=')) {
      const turnUrlBase = config.turnServerUrl.split('?')[0]; // Get base URL without params
      iceServers.push({
        urls: `${turnUrlBase}?transport=tcp`,
        username: config.turnUsername,
        credential: config.turnPassword,
      });
      logInfo('Added TCP TURN server variant for firewall traversal', { 
        url: `${turnUrlBase}?transport=tcp`
      });
    }
    
    logInfo('Added TURN server to ICE configuration', { 
      url: config.turnServerUrl,
      username: config.turnUsername 
    });
  }
  
  // Warning if no TURN server configured
  if (!iceServers.some(server => String(server.urls).startsWith('turn:'))) {
    logWarn('No TURN server configured, NAT traversal may fail for some users');
  } else if (iceServers.some(server => String(server.urls).startsWith('turn:') && (!server.username || !server.credential))) {
    logWarn('TURN server configured but missing credentials, connection may fail');
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
  isCameraOn?: boolean;
  isMicrophoneOn?: boolean;
  onParticipantCount?: (count: number) => void;
  onConnectionError?: (error: { type: string; message: string; canReconnect: boolean }) => void;
  className?: string;
}

// Add sessionId to track unique sessions
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};

// ===================== MAIN COMPONENT =====================
export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
  isCameraOn: externalCameraOn,
  isMicrophoneOn: externalMicrophoneOn,
  onParticipantCount,
  onConnectionError,
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
  
  // Add a unique session ID to prevent duplicate connections
  const sessionId = useRef<string>(generateSessionId()).current;
  const isComponentMounted = useRef<boolean>(false);
  const hasActiveConnection = useRef<boolean>(false);
  
  // =========== COMPONENT STATE ===========
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number>(0);
  const [streamReady, setStreamReady] = useState(false);
  const [isMuted, setIsMuted] = useState(isStreamer ? !externalMicrophoneOn : true); // Streamers unmuted, viewers muted by default
  const [isVideoHidden, setIsVideoHidden] = useState(!externalCameraOn);
  const [showDeviceSelector, setShowDeviceSelector] = useState<boolean>(isStreamer);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | undefined>(undefined);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(undefined);
  
  // State for debug mode
  const [showDebugControls, setShowDebugControls] = useState<boolean>(false);
  
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
  const connectInProgressRef = useRef<boolean>(false);
  const mediaSetupAttemptRef = useRef<number>(0); // Moved mediaSetupAttempt here
  
  // Maximum connection attempts before giving up
  const MAX_CONNECTION_ATTEMPTS = 10;
  // Retry delays in milliseconds
  const RETRY_DELAYS = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 45000];
  
  // Add a new state to track autoplay restriction
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  
  // =========== SOCKET CONNECTION =====================
  // Connect to WebRTC signaling server
  const connectToSignalingServer = useCallback(async () => {
    if (!mountedRef.current) {
      logWarn('Connection attempt aborted: Component is unmounted');
      connectInProgressRef.current = false;
      return;
    }

    if (connectInProgressRef.current || (socketRef.current?.connected && connectionStatus === 'connected')) {
      logInfo('Connection attempt skipped: already in progress or connected.', {
        inProgress: connectInProgressRef.current,
        socketConnected: socketRef.current?.connected,
        status: connectionStatus,
      });
      return;
    }

    // Check if this component instance already has an active connection
    if (hasActiveConnection.current) {
      logWarn('Connection attempt aborted: This component instance already has an active connection');
      return;
    }

    logTrace('connectToSignalingServer called', { currentStatus: connectionStatus, sessionId });
    connectInProgressRef.current = true;
    setConnectionStatus('connecting');

    // Wait for runtime config to be ready
    if (isConfigLoading) {
      logWarn('Runtime config still loading, using fallback values if needed');
    }
    
    // Use fallback values if runtime config is not available
    const socketUrl = runtimeConfig?.socketUrl || process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
    
    // Fix: ensure wsUrl doesn't contain duplicate /api paths
    const baseWsUrl = window.location.origin.replace(/^http/, 'ws');
    const wsUrl = runtimeConfig?.wsUrl || baseWsUrl;
    
    // Log connection details for diagnostics
    logInfo('Signaling server connection details', {
      effectiveSocketUrl: socketUrl,
      configSocketUrl: runtimeConfig?.socketUrl,
      envSocketUrl: process.env.NEXT_PUBLIC_SOCKET_URL,
      locationOrigin: window.location.origin,
      wsUrl,
      sessionId
    });
    
    if (!socketUrl) {
      logError('Cannot connect to signaling server: No Socket URL available', { 
        isConfigLoading,
        hasConfig: !!runtimeConfig
      }, effectiveUserId, streamId);
      setError("Configuration Error: Socket URL not found."); // Set error state
      setConnectionStatus('disconnected');
      connectInProgressRef.current = false;
      return;
    }

    // Close any existing connection
    if (socketRef.current) {
      logInfo('Disconnecting existing socket before new connection attempt.');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Make sure we have valid URLs
    let finalSocketUrl = socketUrl;
    
    // Fix common issues with socket URL formatting
    if (finalSocketUrl.startsWith('https://')) {
      logWarn('Socket URL starts with HTTPS - this is usually correct for Socket.IO');
    } else if (finalSocketUrl.startsWith('http://')) {
      logWarn('Socket URL starts with HTTP - socket.io will automatically handle this');
    } else if (finalSocketUrl.startsWith('ws://') || finalSocketUrl.startsWith('wss://')) {
      // Convert explicit WebSocket URLs to HTTP(S) for Socket.IO which handles the protocol upgrade itself
      finalSocketUrl = finalSocketUrl.replace(/^ws(s?):\/\//i, 'http$1://');
      logWarn('Socket URL corrected from WS to HTTP for Socket.IO compatibility', { correctedUrl: finalSocketUrl });
    } else if (!finalSocketUrl.match(/^[a-z]+:\/\//i)) {
      // If URL has no protocol prefix at all, add http://
      finalSocketUrl = 'http://' + finalSocketUrl;
      logWarn('Socket URL had no protocol, added HTTP', { correctedUrl: finalSocketUrl });
    }
    
    // Ensure URL doesn't end with a slash before adding path
    const fullSocketUrl = finalSocketUrl.endsWith('/') ? finalSocketUrl.slice(0, -1) : finalSocketUrl;
    
    try {
      logInfo('Connecting to signaling server', { 
        url: fullSocketUrl,
        userId: effectiveUserId,
        streamId,
        sessionId
      });
      
      // Add direct WebSocket test to diagnose connectivity
      try {
        logInfo('Testing WebSocket connectivity before full socket.io connection');
        await testDirectWebSocketConnectivity(fullSocketUrl);
      } catch (wsTestError) {
        logWarn('WebSocket direct connection test failed, but continuing with socket.io which may still work', 
          formatError(wsTestError));
      }

      const socket = io(fullSocketUrl, {
        path: '/socket.io',
        query: {
          streamId,
          userId: effectiveUserId,
          username: effectiveUsername,
          isStreamer: isStreamer ? 1 : 0,
          sessionId // Add session ID to query to help server identify duplicate connections
        },
        transports: ['websocket', 'polling'], // Prefer websocket first
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5, // Reduced from 15 to prevent excessive reconnection attempts
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000, // Increase max delay
        timeout: 15000 // Increase timeout for slower connections
      });

      socketRef.current = socket;
      
      // Set up socket event handlers
      socket.on('connect', () => {
        if (!mountedRef.current) {
          logWarn('Socket connected but component unmounted, cleaning up');
          socket.disconnect();
          return;
        }
        
        logInfo('Socket connected', {
          socketId: socket.id,
          streamId,
          userId: effectiveUserId,
          sessionId
        });
        
        // Mark this component as having an active connection
        hasActiveConnection.current = true;
        connectInProgressRef.current = false;
        setConnectionStatus('connected');
        setError(null);
        connectionAttemptsRef.current = 0; // Reset attempts on successful connection
        
        // Request router capabilities after successful connection
        socket.emit('getRouterRtpCapabilities', { streamId, sessionId }, (response: any) => {
          if (!mountedRef.current) return;
          
          if (response.error) {
            logError('Failed to get router capabilities', { error: response.error });
            setError(`Failed to initialize media: ${response.error}`);
            return;
          }
          
          if (response.duplicateConnection) {
            logWarn('Server detected duplicate connection, this connection will be closed', { 
              existingSocketId: response.existingSocketId 
            });
            socket.disconnect();
            setError('Another active connection for this stream exists. Please reload the page if this is unexpected.');
            return;
          }
          
          logInfo('Received router capabilities', { capabilities: response.rtpCapabilities });
          initializeMediasoupDevice(response.rtpCapabilities);
        });
      });
      
      // Enhanced error handlers
      socket.on('connect_error', (err) => {
        if (!mountedRef.current) {
          connectInProgressRef.current = false;
          return;
        }
        
        logError('Socket connection attempt failed (connect_error)', {
          message: err.message,
          name: err.name,
          data: (err as any).data,
          url: fullSocketUrl
        }, effectiveUserId, streamId);
        
        connectInProgressRef.current = false;
        setError(`Signaling server connection failed: ${err.message}. Will retry.`);
        setConnectionStatus('disconnected');
      });
      
      socket.on('disconnect', (reason) => {
        if (!mountedRef.current) {
          connectInProgressRef.current = false;
          return;
        }
        
        logWarn('Socket disconnected', { reason, currentSocketId: socket.id, sessionId });
        connectInProgressRef.current = false;
        hasActiveConnection.current = false; // Reset active connection flag
        setConnectionStatus('disconnected');
        
        // Only attempt reconnection for certain disconnect reasons
        const shouldReconnect = 
          reason === 'io server disconnect' || 
          reason === 'transport close' || 
          reason === 'transport error' ||
          reason === 'ping timeout';
        
        if (mountedRef.current && shouldReconnect && connectionAttemptsRef.current < MAX_CONNECTION_ATTEMPTS) {
          connectionAttemptsRef.current += 1;
          const nextAttemptDelay = RETRY_DELAYS[Math.min(connectionAttemptsRef.current -1, RETRY_DELAYS.length - 1)];
          logInfo(`Scheduling reconnection attempt ${connectionAttemptsRef.current}/${MAX_CONNECTION_ATTEMPTS} in ${nextAttemptDelay}ms due to disconnect`, { reason });
          
          const timeout = setTimeout(() => {
            if (mountedRef.current) {
              connectToSignalingServer();
            }
          }, nextAttemptDelay);
          
          timeoutsRef.current.push(timeout);
        } else if (connectionAttemptsRef.current >= MAX_CONNECTION_ATTEMPTS) {
          logError('Maximum reconnection attempts reached after disconnect');
          setError('Failed to connect after multiple attempts. Please refresh the page.');
        } else if (!shouldReconnect) {
          // Intentional disconnection - no reconnect needed
          logInfo('Intentional client disconnection, not attempting to reconnect', { reason });
        }
      });
      
      // Handle duplicate connection detection from server
      socket.on('duplicateConnection', (data) => {
        logWarn('Server detected duplicate connection', { 
          socketId: socket.id,
          existingSocketId: data.existingSocketId
        });
        
        // Set error immediately to inform user
        setError('Connection issue detected: Another connection to this stream exists');
        
        // Force disconnect and reset state 
        socket.disconnect();
        
        // Reset connection flags to allow for retry
        connectionAttemptsRef.current = 0;
        hasActiveConnection.current = false;
        connectInProgressRef.current = false;
        
        // Notify user with clear instructions after a short delay
        setTimeout(() => {
          if (mountedRef.current) {
            setError('Connection closed due to duplicate session. Click the "Reconnect" button below to try again.');
            
            // Signal to parent component that reconnection UI should be shown
            if (onConnectionError) {
              onConnectionError({
                type: 'duplicate_session',
                message: 'Duplicate session detected',
                canReconnect: true
              });
            }
          }
        }, 1000);
      });
      
      // Add catch-all error handler
      socket.on('error', (err) => {
        if (!mountedRef.current) return;
        
        logError('Socket connection error', formatError(err), effectiveUserId, streamId);
        connectInProgressRef.current = false;
        setError('Connection error occurred. Please check your network and reload the page.');
      });
      
      // Add explicit handler for server errors
      socket.on('serverError', (message) => {
        if (!mountedRef.current) return;
        
        logError('Server error received', { message }, effectiveUserId, streamId);
        setError(`Server error: ${message}. Please reload the page.`);
      });
      
      // Add handler for forceDisconnect message from server
      socket.on('forceDisconnect', (data) => {
        if (!mountedRef.current) return;
        
        logWarn('Received force disconnect from server', { 
          message: data.message, 
          socketId: socket.id 
        });
        
        // Set a user-friendly error message
        setError(data.message || 'This connection was closed because you connected from another session.');
        
        // Set a flag to prevent excessive reconnection attempts for forced disconnections
        hasActiveConnection.current = false;
        connectInProgressRef.current = false;
        
        // Clean up any existing media tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Don't set immediate disconnect - let user see the message
        setTimeout(() => {
          if (socket && socket.connected && mountedRef.current) {
            socket.disconnect();
          }
        }, 3000);
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
              rtpCapabilities: device.rtpCapabilities,
              sessionId // Include session ID with all requests
            });
            
            // For streamers, capture local media
            await captureLocalMedia();
          } else {
            // Request to create a consumer transport for viewers
            socket.emit('createConsumerTransport', { 
              forceTcp: false,
              rtpCapabilities: device.rtpCapabilities,
              sessionId // Include session ID with all requests
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

      socket.on('newProducer', async (data) => {
        const { producerId, kind } = data;
        logInfo('New producer available', { producerId, kind });
        
        if (!transportRef.current.consumer || !deviceRef.current) {
          logWarn('Cannot consume: consumer transport or device not ready', {
            hasConsumerTransport: !!transportRef.current.consumer,
            hasDevice: !!deviceRef.current
          });
          return;
        }
        
        // Request to consume this producer
        try {
          if (!socketRef.current || !socketRef.current.connected) {
            logWarn('Cannot consume: socket not connected');
            return;
          }
          
          // Wait a short delay to ensure server-side is ready for the consume request
          setTimeout(() => {
            if (!socketRef.current?.connected || !transportRef.current.consumer) return;
            
            socketRef.current.emit('consume', {
              transportId: transportRef.current.consumer.id,
              producerId,
              rtpCapabilities: deviceRef.current?.rtpCapabilities
            }, (response: { error?: string; [key: string]: any }) => {
              if (response.error) {
                logError('Failed to consume producer', { error: response.error }, effectiveUserId, streamId);
                setError(`Failed to consume stream: ${response.error}`);
                return;
              }
              handleConsume(response);
            });
          }, 500);
        } catch (err) {
          logError('Error in newProducer handler', formatError(err), effectiveUserId, streamId);
        }
      });
      
      return socket;
    } catch (err) {
      if (!mountedRef.current) {
        connectInProgressRef.current = false;
        return;
      }
      
      logError('Error connecting to signaling server', formatError(err));
      connectInProgressRef.current = false;
      setError('Failed to connect to streaming server');
      setConnectionStatus('disconnected');
    }
  }, [
    streamId, 
    effectiveUserId, 
    effectiveUsername, 
    isStreamer, 
    runtimeConfig, 
    isConfigLoading, 
    onParticipantCount
  ]);
  
  /**
   * Test direct WebSocket connectivity (without Socket.IO)
   * This helps diagnose raw WebSocket issues vs Socket.IO specific issues
   */
  const testDirectWebSocketConnectivity = async (url: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      try {
        // Convert HTTP URLs to WebSocket URLs if needed
        let wsTestConnectUrl = url;
        
        // Handle different URL formats properly
        if (url.startsWith('http://')) {
          wsTestConnectUrl = url.replace(/^http:\/\//i, 'ws://') + '/socket.io/?EIO=4&transport=websocket';
        } else if (url.startsWith('https://')) {
          wsTestConnectUrl = url.replace(/^https:\/\//i, 'wss://') + '/socket.io/?EIO=4&transport=websocket';
        } else if (url.startsWith('ws://') || url.startsWith('wss://')) {
          wsTestConnectUrl = url + '/socket.io/?EIO=4&transport=websocket';
        } else if (!url.match(/^[a-z]+:\/\//i)) {
          // No protocol, assume ws://
          wsTestConnectUrl = 'ws://' + url + '/socket.io/?EIO=4&transport=websocket';
        }
        
        logInfo(`Testing direct WebSocket connectivity to ${wsTestConnectUrl}`);
        
        // Use browser's native WebSocket
        let ws: WebSocket; // Native WebSocket
        
        try {
          ws = new WebSocket(wsTestConnectUrl);
        } catch (wsError) {
          // This can happen if the URL scheme is invalid or malformed
          logError('Failed to create WebSocket with URL', { 
            wsUrl: wsTestConnectUrl, 
            error: formatError(wsError) 
          }, effectiveUserId, streamId);
          
          // Try an alternative approach - use the current origin with ws/wss
          const altWsUrl = window.location.origin.replace(/^http(s?):\/\//i, 'ws$1://') + '/socket.io/?EIO=4&transport=websocket';
          logInfo(`Trying alternative WebSocket URL: ${altWsUrl}`);
          
          ws = new WebSocket(altWsUrl);
        }
        
        const connectTimeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout after 5 seconds'));
        }, 5000);
        
        ws.onopen = () => {
          logInfo('Direct WebSocket connection successful');
          clearTimeout(connectTimeout);
          ws.close();
          resolve(true);
        };
        
        ws.onerror = (event) => {
          clearTimeout(connectTimeout);
          logError('Direct WebSocket connection failed', { 
            error: 'WebSocket error event',
            wsUrl: wsTestConnectUrl 
          }, effectiveUserId, streamId);
          reject(new Error('WebSocket connection failed'));
        };
      } catch (error) {
        logError('Exception during WebSocket connectivity test', formatError(error), effectiveUserId, streamId);
        reject(error);
      }
    });
  };
  
  // =========== MEDIASOUP UTILITIES ===========
  /**
   * Initialize MediaSoup device with router capabilities
   */
  const initializeMediasoupDevice = useCallback(async (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
    try {
      logger.debug('Initializing MediaSoup device');
      logInfo('Initializing MediaSoup device with router capabilities', {
        routerCapabilitiesCodecs: routerRtpCapabilities.codecs?.map(c => ({
          mimeType: c.mimeType,
          clockRate: c.clockRate,
          channels: c.channels,
        }))
      });
      
      // Create a new MediaSoup device
      const device = new mediasoupClient.Device();
      
      // Load router RTP capabilities
      await device.load({ routerRtpCapabilities });
      
      // Log device capabilities for diagnostics
      logInfo('MediaSoup device initialized successfully', {
        canProduceVideo: device.canProduce('video'),
        canProduceAudio: device.canProduce('audio'),
        loaded: device.loaded,
        rtpCapabilities: {
          codecs: device.rtpCapabilities?.codecs?.map(c => ({
            mimeType: c.mimeType,
            preferredPayloadType: c.preferredPayloadType,
            clockRate: c.clockRate,
            channels: c.channels,
          }))
        }
      });
      
      deviceRef.current = device;
      return device;
    } catch (err) {
      logger.error('Failed to initialize MediaSoup device', formatError(err));
      logError('Failed to initialize MediaSoup device', formatError(err), effectiveUserId, streamId);
      setError('Failed to initialize media device. Please reload and try again.');
      return null;
    }
  }, [effectiveUserId, streamId]);
  
  /**
   * Create and set up a producer transport for the streamer
   */
  const setupProducerTransport = useCallback(async (transportOptions: any) => {
    if (!deviceRef.current) {
      logger.error('Cannot set up producer transport: Device not initialized');
      logError('Cannot set up producer transport: Device not initialized', null, effectiveUserId, streamId);
      return null;
    }
    
    if (isConfigLoading || !runtimeConfig) { 
      logError('Cannot set up producer transport: Runtime config not ready', {
        isConfigLoading,
        hasConfig: !!runtimeConfig
      }, effectiveUserId, streamId);
      return null;
    }
    
    try {
      logger.debug('Creating producer transport', transportOptions);
      
      // Get ICE servers using runtime config
      const iceServers = getIceServers(runtimeConfig); 
      
      logInfo('Creating producer transport with ICE servers', {
        transportId: transportOptions.id,
        iceServerCount: iceServers.length
      });
      
      // Create the transport with enhanced ICE configuration
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
        
        logInfo('Producer transport connect event triggered', {
          transportId: transport.id,
          dtlsParameters
        });
        
        try {
          if (!socketRef.current?.connected) {
            const error = new Error('Socket not connected');
            logError('Producer transport connect failed: Socket not connected', null, effectiveUserId, streamId);
            throw error;
          }
          
          socketRef.current.emit('connectProducerTransport', {
            transportId: transport.id,
            dtlsParameters
          });
          
          logDebug('Producer transport connect request sent to server');
          callback();
        } catch (err) {
          logger.error('Producer transport connect failed', formatError(err));
          logError('Producer transport connect failed', formatError(err), effectiveUserId, streamId);
          errback(err as Error);
        }
      });
      
      // Monitor ICE connection state
      transport.on('connectionstatechange', (state) => {
        // Now we'll use the connectionstatechange to detect ICE issues
        logInfo('Producer transport connection state change', { transportId: transport.id, state });
        if (state === 'connecting') {
          logInfo('Producer transport ICE connecting', { 
            transportId: transport.id
          });
        } else if (state === 'failed') {
          logError('Producer transport ICE connection failed', { 
            transportId: transport.id 
          }, effectiveUserId, streamId);
          
          // Attempt ICE restart if connection fails
          if (mountedRef.current && socketRef.current?.connected) {
            logInfo('Attempting ICE restart for failed transport', {
              transportId: transport.id
            });
            
            // Emit restart request to server
            socketRef.current.emit('restartIce', { transportId: transport.id }, (response: any) => {
              if (response.error) {
                logError('ICE restart request failed', { 
                  error: response.error 
                }, effectiveUserId, streamId);
                return;
              }
              
              // Apply new ICE parameters
              if (response.iceParameters) {
                try {
                  transport.restartIce({ iceParameters: response.iceParameters });
                  logInfo('ICE restart initiated', { transportId: transport.id });
                } catch (err) {
                  logError('Failed to restart ICE', formatError(err), effectiveUserId, streamId);
                }
              }
            });
          }
        } else if (state === 'disconnected') {
          logWarn('Producer transport ICE disconnected', {
            transportId: transport.id
          });
        } else if (state === 'closed') {
          logWarn('Producer transport closed', { transportId: transport.id });
        }
      });
      
      // Handle produce events
      transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        logger.debug('Producer transport produce event', { 
          transportId: transport.id, 
          kind, 
          appData 
        });
        
        logInfo('Producer transport produce event triggered', {
          transportId: transport.id,
          kind,
          streamId,
          userId: effectiveUserId
        });
        
        try {
          if (!socketRef.current?.connected) {
            const error = new Error('Socket not connected');
            logError('Producer produce failed: Socket not connected', null, effectiveUserId, streamId);
            throw error;
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
          }, (response: { id: string; error?: string }) => {
            if (response.error) {
              logError('Server returned error for produce request', { 
                error: response.error 
              }, effectiveUserId, streamId);
              return errback(new Error(response.error));
            }
            
            // Server responds with the Producer's id
            logger.debug('Produce response from server', { producerId: response.id });
            logInfo('Producer created on server', { 
              producerId: response.id,
              kind
            });
            callback({ id: response.id });
          });
        } catch (err) {
          logger.error('Producer transport produce failed', formatError(err));
          logError('Producer transport produce failed', formatError(err), effectiveUserId, streamId);
          errback(err as Error);
        }
      });
      
      transportRef.current.producer = transport;
      return transport;
    } catch (err) {
      logger.error('Failed to set up producer transport', formatError(err));
      logError('Failed to set up producer transport', formatError(err), effectiveUserId, streamId);
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
      logError('Cannot set up consumer transport: Device not initialized', null, effectiveUserId, streamId);
      return null;
    }
    
    if (isConfigLoading || !runtimeConfig) {
      logError('Cannot set up consumer transport: Runtime config not ready', {
        isConfigLoading,
        hasConfig: !!runtimeConfig
      }, effectiveUserId, streamId);
      return null;
    }
    
    try {
      logger.debug('Creating consumer transport', transportOptions);
      
      // Get ICE servers using runtime config
      const iceServers = getIceServers(runtimeConfig);
      
      logInfo('Creating consumer transport with ICE servers', {
        transportId: transportOptions.id,
        iceServerCount: iceServers.length
      });
      
      // Create the transport with enhanced ICE configuration
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
        
        logInfo('Consumer transport connect event triggered', {
          transportId: transport.id,
          dtlsParameters
        });
        
        try {
          if (!socketRef.current?.connected) {
            const error = new Error('Socket not connected');
            logError('Consumer transport connect failed: Socket not connected', null, effectiveUserId, streamId);
            throw error;
          }
          
          socketRef.current.emit('connectConsumerTransport', {
            transportId: transport.id,
            dtlsParameters
          });
          
          logDebug('Consumer transport connect request sent to server');
          callback();
        } catch (err) {
          logger.error('Consumer transport connect failed', formatError(err));
          logError('Consumer transport connect failed', formatError(err), effectiveUserId, streamId);
          errback(err as Error);
        }
      });
      
      // Handle connection state changes
      transport.on('connectionstatechange', (state) => {
        logger.info('Consumer transport connection state changed', { 
          transportId: transport.id, 
          state 
        });
        
        logInfo('Consumer transport connection state changed', {
          transportId: transport.id,
          state,
          isViewer: !isStreamer
        });
        
        if (state === 'connecting') {
          logInfo('Consumer transport ICE connecting', {
            transportId: transport.id
          });
        } else if (state === 'connected') {
          // Transport successfully connected
          logger.info('Consumer transport successfully connected');
          logInfo('Consumer transport successfully connected', {
            transportId: transport.id
          });
          
          // Request to consume available producers
          if (socketRef.current?.connected && deviceRef.current) {
            logInfo('Requesting to consume available producers', {
              streamId,
              transportId: transport.id
            });
            
            // Define types for the producers response
            interface Producer {
              producerId: string;
              kind: string;
              peerId: string;
            }
            
            socketRef.current.emit('getProducers', { streamId }, (producers: Producer[]) => {
              if (Array.isArray(producers) && producers.length > 0) {
                logInfo(`Received ${producers.length} producers to consume`, {
                  producerIds: producers.map(p => p.producerId)
                });
                
                // Request to consume each producer
                producers.forEach((producer) => {
                  if (socketRef.current?.connected && transportRef.current.consumer && deviceRef.current) {
                    socketRef.current.emit('consume', {
                      transportId: transportRef.current.consumer.id,
                      producerId: producer.producerId,
                      rtpCapabilities: deviceRef.current.rtpCapabilities
                    }, (response: { error?: string; consumerId?: string; producerId?: string; kind?: string; rtpParameters?: any }) => {
                      if (response.error) {
                        logError('Failed to consume producer', {
                          error: response.error,
                          producerId: producer.producerId
                        });
                        return;
                      }
                      handleConsume(response);
                    });
                  }
                });
              } else {
                logInfo('No producers available to consume yet');
              }
            });
          }
        } else if (state === 'failed') {
          logger.error('Consumer transport connection failed', { state });
          logError('Consumer transport ICE connection failed', { 
            transportId: transport.id,
            isViewer: !isStreamer
          }, effectiveUserId, streamId);
          
          // Attempt ICE restart for viewer connection
          if (mountedRef.current && socketRef.current?.connected) {
            logInfo('Attempting ICE restart for failed consumer transport', {
              transportId: transport.id
            });
            
            socketRef.current.emit('restartIce', { transportId: transport.id }, (response: any) => {
              if (response.error) {
                logError('ICE restart request failed', { 
                  error: response.error 
                }, effectiveUserId, streamId);
                return;
              }
              
              // Apply new ICE parameters
              if (response.iceParameters) {
                try {
                  transport.restartIce({ iceParameters: response.iceParameters });
                  logInfo('ICE restart initiated for consumer', { transportId: transport.id });
                } catch (err) {
                  logError('Failed to restart ICE for consumer', formatError(err), effectiveUserId, streamId);
                  
                  if (mountedRef.current) {
                    setError(`Connection failed. Please refresh and try again.`);
                  }
                }
              }
            });
          } else {
            if (mountedRef.current) {
              setError(`Connection failed. Please refresh and try again.`);
            }
          }
        } else if (state === 'disconnected' || state === 'closed') {
          logger.error('Consumer transport connection closed or disconnected', { state });
          logError('Consumer transport connection closed or disconnected', { 
            state,
            transportId: transport.id,
            isViewer: !isStreamer
          }, effectiveUserId, streamId);
          
          if (mountedRef.current) {
            setError(`Connection ${state}. Please try again.`);
          }
        }
      });
      
      transportRef.current.consumer = transport;
      return transport;
    } catch (err) {
      logger.error('Failed to set up consumer transport', formatError(err));
      logError('Failed to set up consumer transport', formatError(err), effectiveUserId, streamId);
      setError('Failed to set up media connection. Please reload and try again.');
      return null;
    }
  }, [streamId, runtimeConfig, isConfigLoading, effectiveUserId, isStreamer]);
  
  /**
   * Publish local media tracks to server using the producer transport
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
        
        // Replace simulcast configuration with single stream
        const videoProducer = await transport.produce({
          track: videoTracks[0],
          encodings: [
            // Single quality stream with moderate bitrate
            { maxBitrate: 500000 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: 500
          },
          // Codec selection remains the same
          codec: deviceRef.current?.rtpCapabilities.codecs?.find(c => 
            c.mimeType.toLowerCase() === 'video/h264'
          ) || deviceRef.current?.rtpCapabilities.codecs?.find(c => 
            c.mimeType.toLowerCase() === 'video/vp8'
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
        
        // Enhanced audio options for better quality and reliability
        const audioProducer = await transport.produce({
          track: audioTracks[0],
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
            opusFec: true,
            opusMaxPlaybackRate: 48000,
            opusPtime: 20
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
  }, [setStreamReady, setError]); // Added setStreamReady and setError as they are used from component state
  
  /**
   * Handle consuming a remote producer
   */
  const handleConsume = useCallback(async (consumerData: any) => {
    if (!deviceRef.current || !transportRef.current.consumer) {
      logger.error('Cannot consume: Device or transport not ready');
      logError('Cannot consume: Device or transport not ready', {
        hasDevice: !!deviceRef.current,
        hasTransport: !!transportRef.current.consumer
      }, effectiveUserId, streamId);
      return false;
    }
    
    try {
      const { consumerId, producerId, kind, rtpParameters } = consumerData;
      
      logger.debug('Consuming remote producer', { 
        consumerId, 
        producerId, 
        kind 
      });
      
      logInfo('Attempting to consume remote producer', {
        consumerId,
        producerId,
        kind,
        rtpParametersMimeType: rtpParameters?.codecs?.[0]?.mimeType,
        rtpParametersClockRate: rtpParameters?.codecs?.[0]?.clockRate
      });
      
      // Log active transport state before consuming
      if (transportRef.current.consumer) {
        logInfo('Consumer transport state before consuming', {
          connectionState: (transportRef.current.consumer as any).connectionState,
          transportId: transportRef.current.consumer.id
        });
      }
      
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
      
      logInfo('Consumer successfully created', {
        consumerId: consumer.id,
        kind: consumer.kind,
        paused: consumer.paused,
        producerPaused: 'producerPaused' in consumer ? (consumer as any).producerPaused : 'unknown'
      });
      
      // Store the consumer reference
      if (kind === 'video') {
        consumersRef.current.video = consumer;
      } else if (kind === 'audio') {
        consumersRef.current.audio = consumer;
      }
      
      // Create a MediaStream from the consumer track
      const stream = new MediaStream([consumer.track]);
      
      // Track diagnostic info
      logInfo('Consumed media track details', {
        kind: consumer.track.kind,
        label: consumer.track.label,
        enabled: consumer.track.enabled,
        readyState: consumer.track.readyState,
        muted: consumer.track.muted
      });
      
      // Display the stream if we're a viewer
      if (videoRef.current) {
        if (kind === 'video') {
          // If we already have a stream with audio, add the video track to it
          if (videoRef.current.srcObject instanceof MediaStream) {
            const existingStream = videoRef.current.srcObject as MediaStream;
            existingStream.addTrack(consumer.track);
            logInfo('Added video track to existing stream', {
              existingTracks: existingStream.getTracks().length,
              trackKinds: existingStream.getTracks().map(t => t.kind).join(',')
            });
          } else {
            videoRef.current.srcObject = stream;
            logInfo('Set video element srcObject with new video stream');
          }
        } else if (kind === 'audio') {
          // If we already have a stream with video, add the audio track to it
          if (videoRef.current.srcObject instanceof MediaStream) {
            const existingStream = videoRef.current.srcObject as MediaStream;
            existingStream.addTrack(consumer.track);
            logInfo('Added audio track to existing stream', {
              existingTracks: existingStream.getTracks().length,
              trackKinds: existingStream.getTracks().map(t => t.kind).join(',')
            });
          } else {
            videoRef.current.srcObject = stream;
            logInfo('Set video element srcObject with new audio stream');
          }
          
          // Make sure audio is correctly muted based on user preference
          videoRef.current.muted = isMuted;
          logInfo('Set audio mute state on video element', { muted: isMuted });
        }
        
        // Log readiness of media stream
        setStreamReady(true);
        
        // Attempt to play the video and capture any autoplay issues
        try {
          logInfo('Attempting to play video element');
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              logInfo('Video playback started successfully');
              // Clear autoplay blocked status if play succeeded
              setAutoplayBlocked(false);
            }).catch(err => {
              logError('Error starting video playback - likely autoplay policy', 
                formatError(err), effectiveUserId, streamId);
              
              // Set autoplay blocked state instead of generic error
              setAutoplayBlocked(true);
              // Don't overwrite other errors with autoplay message
              if (!error) {
                setError('Autoplay blocked. Please click to play.');
              }
            });
          }
        } catch (playErr) {
          logError('Exception while trying to play video', 
            formatError(playErr), effectiveUserId, streamId);
          setAutoplayBlocked(true);
        }
      } else {
        logError('Cannot display stream: video element ref is null', null, effectiveUserId, streamId);
      }
      
      return true;
    } catch (err) {
      logger.error('Error consuming media', formatError(err));
      logError('Error consuming media', formatError(err), effectiveUserId, streamId);
      setError('Failed to receive media stream. Please reload and try again.');
      return false;
    }
  }, [isMuted, effectiveUserId, streamId]);
  
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
  }, [isStreamer, selectedVideoDevice, selectedAudioDevice, produceLocalMedia]); // Added dependencies
  
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

      // Track local media setup attempts to prevent excessive retries
      // const mediaSetupAttempt = useRef(0); // Removed from here
      if (mediaSetupAttemptRef.current > 3) { // Use the ref from component scope
        throw new Error("Failed to set up media devices after multiple attempts");
      }
      mediaSetupAttemptRef.current++; // Increment the ref from component scope
      
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
        
        // Provide specific error messages based on the error type
        if ((err as any)?.name === 'NotAllowedError') {
          logWarn('Camera/microphone access denied by user or system', formatError(err));
          
          // Try video-only as a fallback if audio might be the issue
          try {
            logInfo('Attempting video-only as fallback');
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
              audio: false
            });
            setError('Microphone access denied. Streaming without audio.');
          } catch (videoOnlyErr) {
            // Try audio-only as a last resort
            try {
              logInfo('Attempting audio-only as last resort fallback');
              stream = await navigator.mediaDevices.getUserMedia({ 
                video: false,
                audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true 
              });
              setError('Camera access denied. Streaming with audio only.');
            } catch (audioOnlyErr) {
              throw new Error('Both camera and microphone access denied. Cannot stream without media.');
            }
          }
        } else if ((err as any)?.name === 'NotFoundError') {
          throw new Error('Camera or microphone not found. Please check your device connections.');
        } else if ((err as any)?.name === 'NotReadableError' || (err as any)?.name === 'AbortError') {
          throw new Error('Could not access your camera/microphone. They may be in use by another application.');
        } else if ((err as any)?.name === 'OverconstrainedError') {
          // Fallback to basic constraints without specific requirements
          logWarn('Device constraints not satisfied, falling back to basic constraints');
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          });
        } else {
          // Fall back to more basic constraints for other errors
          const fallbackConstraints: MediaStreamConstraints = {
            video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
            audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
          };
          
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }
      }
      
      if (!stream) {
        throw new Error('Failed to obtain media stream after fallbacks');
      }
      
      logger.info('Local media stream obtained', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackSettings: stream.getVideoTracks()[0]?.getSettings(),
        audioTrackSettings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      localStreamRef.current = stream;
      
      // Apply initial settings based on props
      if (typeof externalCameraOn !== 'undefined' && !externalCameraOn) {
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = false;
        });
        setIsVideoHidden(true);
      }
      
      if (typeof externalMicrophoneOn !== 'undefined' && !externalMicrophoneOn) {
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = false;
        });
        setIsMuted(true);
      }
      
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
        setError('Camera/microphone access denied. Please check your browser permissions and click the camera icon in the address bar.');
      } else if ((err as any)?.name === 'NotFoundError') {
        setError('Camera or microphone not found. Please check your device connections.');
      } else if ((err as any)?.name === 'NotReadableError') {
        setError('Could not access your camera/microphone. They may be in use by another application.');
      } else if ((err as Error)?.message) {
        setError((err as Error).message);
      } else {
        setError('Failed to access camera or microphone. Please check your permissions.');
      }
      
      return null;
    }
  }, [
    isStreamer, 
    selectedVideoDevice, 
    selectedAudioDevice, 
    produceLocalMedia, 
    externalCameraOn, 
    externalMicrophoneOn,
    effectiveUserId, // Added
    streamId,        // Added
    setError,        // Added
    setStreamReady,  // Added
    setIsVideoHidden,// Added
    setIsMuted       // Added
    // Assuming logError, formatError, logger, logInfo, logWarn are stable and defined outside or memoized
    // Refs (localStreamRef, videoRef, transportRef) are stable by nature
  ]);
  
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
    isComponentMounted.current = true;
    
    logInfo('Component mounted or crucial props changed', { 
      streamId, 
      userId, 
      isStreamer,
      sessionId // Log session ID for troubleshooting
    });
    
    getBrowserDiagnostics();

    // Use a debounce mechanism to prevent multiple connection attempts in rapid succession
    let connectionDebounceTimer: NodeJS.Timeout | null = null;
    const mountTimestamp = Date.now();

    const attemptConnection = () => {
        // Reset connection state on fresh mount
        connectionAttemptsRef.current = 0;
        
        // Don't establish a new connection if one was active recently (within last 3 seconds)
        // This prevents connection thrashing when component remounts frequently
        if (hasActiveConnection.current) {
            logWarn('Connection attempt debounced: This component instance recently had an active connection', {
                mountTimestamp,
                streamId,
                userId
            });
            return;
        }
        
        // Check if we should connect based on component state
        if (isComponentMounted.current && mountedRef.current && !connectInProgressRef.current) {
            // Add a small delay before connecting to avoid rapid connection attempts
            connectionDebounceTimer = setTimeout(() => {
                if (mountedRef.current) {
                    logInfo('Initiating connection after debounce delay', {
                        streamId,
                        userId,
                        isStreamer,
                        sessionId
                    });
                    connectToSignalingServer();
                    didInitialSetupRef.current = true;
                }
            }, 500); // 500ms debounce
        }
    };

    if (isStreamer) {
        preConnectionTest().then(testResult => {
            if (testResult.success) {
                logInfo('Pre-connection test successful, preparing to connect to signaling server');
                if (!isConfigLoading && runtimeConfig) {
                    attemptConnection();
                }
            } else {
                logError('Pre-connection test failed', { 
                    reason: testResult.error 
                }, effectiveUserId, streamId);
                setError(`Connection test failed: ${testResult.error}. Please check your network settings.`);
            }
        });
    } else {
        if (!isConfigLoading && runtimeConfig) {
            logInfo('Viewer: preparing to connect to signaling server');
            attemptConnection();
        }
    }
    
    // Add network status event listeners for troubleshooting
    const handleOnline = () => {
      logInfo('Network connection restored', {
        wasInErrorState: !!error
      });
      
      // If we were in an error state, try reconnecting
      if (error && connectionStatus === 'disconnected' && mountedRef.current) {
        setError(null);
        logInfo('Network back online, attempting fresh connection.');
        connectionAttemptsRef.current = 0; // Reset for fresh attempt
        connectToSignalingServer();
      }
    };
    
    const handleOffline = () => {
      logWarn('Network connection lost');
      setError('Network connection lost. Waiting for reconnection...');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Cleanup function with enhanced connection state handling
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      mountedRef.current = false;
      isComponentMounted.current = false;
      
      logInfo('Component unmounting, cleaning up resources');
      
      // Clear debounce timer if exists
      if (connectionDebounceTimer) {
        clearTimeout(connectionDebounceTimer);
      }
      
      // Clear all pending timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      
      // Close socket connection
      if (socketRef.current) {
        logInfo('Disconnecting socket on unmount', { socketId: socketRef.current.id });
        socketRef.current.disconnect();
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
      
      // Reset all refs to ensure a fresh start if remounted
      connectInProgressRef.current = false;
      connectionAttemptsRef.current = 0;
      didInitialSetupRef.current = false;
      // Keep hasActiveConnection true for a brief period to prevent immediate reconnect if remounted quickly
      // It will be reset by the next component instance after the debounce period
      producersRef.current = { video: null, audio: null };
      consumersRef.current = { video: null, audio: null };
    };
  }, [streamId, userId, isStreamer, runtimeConfig, isConfigLoading, connectToSignalingServer]);
  
  /**
   * Run a pre-connection test to verify network connectivity before starting a stream
   * This helps identify issues early, particularly for streamers
   */
  const preConnectionTest = async (): Promise<{success: boolean, error?: string}> => {
    logInfo('Running pre-connection test');
    
    try {
      // 1. Check basic connectivity
      if (!navigator.onLine) {
        return { success: false, error: 'No internet connection' };
      }
      
      // 2. Check Socket.IO server connectivity
      try {
        // Get the socket URL and convert WebSocket URL to HTTP(S) for fetch testing
        const socketUrl = runtimeConfig?.socketUrl || process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
        const testUrl = socketUrl.replace(/^ws(s)?:\/\//i, 'http$1://');
        
        logInfo(`Testing signaling server connectivity to ${testUrl}`);
        
        const response = await fetch(testUrl, { 
          method: 'HEAD', 
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        
        logInfo('Signaling server connectivity test successful');
      } catch (error) {
        return { 
          success: false, 
          error: 'Cannot connect to streaming server. Check your network connection or try again later.' 
        };
      }
      
      // 3. For streamers, check media device permissions
      if (isStreamer) {
        try {
          logInfo('Testing camera and microphone access');
          
          // Request minimal permissions to avoid excessive prompts
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          
          // Check if we got both video and audio tracks
          const hasVideo = stream.getVideoTracks().length > 0;
          const hasAudio = stream.getAudioTracks().length > 0;
          
          // Stop the test stream
          stream.getTracks().forEach(track => track.stop());
          
          if (!hasVideo && !hasAudio) {
            return { 
              success: false, 
              error: 'No camera or microphone detected. Please check your device settings.' 
            };
          } else if (!hasVideo) {
            return { 
              success: false, 
              error: 'Camera not available. You need a camera to stream.' 
            };
          } else if (!hasAudio) {
            return { 
              success: false, 
              error: 'Microphone not available. You need a microphone to stream.' 
            };
          }
          
          logInfo('Camera and microphone access test successful', { hasVideo, hasAudio });
        } catch (error) {
          return { 
            success: false, 
            error: 'Could not access camera or microphone. Please check permissions and try again.' 
          };
        }
      }
      
      // 4. Test STUN connectivity (simplified version of the full test)
      try {
        logInfo('Testing STUN server connectivity');
        const iceServers = getIceServers(runtimeConfig);
        
        if (iceServers.length === 0) {
          return { 
            success: false, 
            error: 'No ICE servers configured. Cannot establish peer connections.' 
          };
        }
        
        // Just verify the configuration is valid, no need for a full test
        logInfo('ICE servers configured correctly', { count: iceServers.length });
      } catch (error) {
        logWarn('ICE server configuration test warning', formatError(error));
        // Continue anyway, this is just a warning
      }
      
      // All tests passed
      return { success: true };
    } catch (error) {
      logError('Pre-connection test failed with exception', formatError(error), effectiveUserId, streamId);
      return { 
        success: false, 
        error: 'Connection setup error. Please try refreshing the page.' 
      };
    }
  };
  
  // Watch for runtime config availability and connect when it's ready
  useEffect(() => {
    if (!didInitialSetupRef.current && !isConfigLoading && runtimeConfig) {
      logInfo('Runtime config now available, initializing connection');
      connectionAttemptsRef.current = 0; // Reset attempts
      connectToSignalingServer();
      didInitialSetupRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigLoading, runtimeConfig, connectToSignalingServer]); // Added connectToSignalingServer to deps
  
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
            // Restore the call to the main captureLocalMedia function
            captureLocalMedia();
          }
        }, 100);
        
        return () => clearTimeout(timeoutId);
      } else {
        // This else block was part of the original code but seems to always set didInitialSetupRef to true
        // after the first render pass of this effect, regardless of the condition above.
        // It might be redundant if the main useEffect and config-ready useEffect handle didInitialSetupRef.
        // For now, keeping it to maintain original behavior outside the direct connection logic.
        didInitialSetupRef.current = true;
      }
    }
  // Add captureLocalMedia back to the dependency array
  }, [selectedAudioDevice, selectedVideoDevice, connectionStatus, isStreamer, captureLocalMedia]);
  
  // Add comprehensive system diagnostics
  const getBrowserDiagnostics = useCallback(() => {
    try {
      const diagnostics = {
        browser: {
          userAgent: navigator.userAgent,
          vendor: navigator.vendor,
          language: navigator.language,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
          deviceMemory: (navigator as any).deviceMemory || 'unknown',
          webRTC: {
            supportsGetDisplayMedia: !!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices),
            supportsMediaRecorder: typeof MediaRecorder !== 'undefined',
            supportsWebAudio: typeof AudioContext !== 'undefined',
            supportsPeerConnection: typeof RTCPeerConnection !== 'undefined',
            supportsInsertableStreams: !!((window as any).RTCRtpSender && 'createEncodedStreams' in (window as any).RTCRtpSender.prototype),
          },
          mediaDevices: navigator.mediaDevices ? 'available' : 'unavailable',
        },
        network: {
          onLine: navigator.onLine,
          connectionType: (navigator as any).connection?.type || 'unknown',
          effectiveType: (navigator as any).connection?.effectiveType || 'unknown',
          downlink: (navigator as any).connection?.downlink || 'unknown', 
          rtt: (navigator as any).connection?.rtt || 'unknown',
        },
        display: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          colorDepth: window.screen.colorDepth,
        }
      };
      
      logInfo('Browser diagnostics', diagnostics);
      return diagnostics;
    } catch (error) {
      logError('Error collecting browser diagnostics', formatError(error), effectiveUserId, streamId);
      return { error: 'Failed to collect diagnostics' };
    }
  }, [effectiveUserId, streamId]);
  
  /**
   * Helper function to test network connectivity to critical services
   * This can help diagnose firewall or blocking issues
   */
  const testNetworkConnectivity = useCallback(async () => {
    const results = {
      stunServer: { success: false, error: null as string | null },
      turnServer: { success: false, error: null as string | null },
      socketServer: { success: false, error: null as string | null },
      timestamp: new Date().toISOString()
    };
    
    try {
      logInfo('Starting network connectivity tests...');
      
      // Test connection to socket server
      try {
        // Get the socket URL and convert WebSocket URL to HTTP(S) for fetch testing
        const socketUrl = runtimeConfig?.socketUrl || process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
        
        // Convert ws:// to http:// and wss:// to https:// for fetch testing
        const testUrl = socketUrl.replace(/^ws(s)?:\/\//i, 'http$1://');
        
        logInfo(`Testing socket server connectivity to ${testUrl} (converted from ${socketUrl} for HTTP testing)`);
        
        // For socket server, we'll just do a simple fetch to see if the server is reachable
        // This doesn't test WebSocket connectivity directly, but helps diagnose network issues
        const response = await fetch(testUrl, { 
          method: 'HEAD', 
          mode: 'no-cors',
          // Short timeout to avoid long waits
          signal: AbortSignal.timeout(5000)
        });
        
        results.socketServer.success = true;
        logInfo('Socket server connectivity test successful');
      } catch (error) {
        results.socketServer.error = (error as Error).message;
        logError('Socket server connectivity test failed', formatError(error), effectiveUserId, streamId);
      }
      
      // Test STUN/TURN servers with RTCPeerConnection
      try {
        logInfo('Testing STUN/TURN server connectivity');
        const iceServers = getIceServers(runtimeConfig);
        
        // Create test peer connections
        const pc1 = new RTCPeerConnection({ iceServers });
        const pc2 = new RTCPeerConnection({ iceServers });
        
        // Create a data channel to force ICE candidate generation
        const dc = pc1.createDataChannel('connectivity-test');
        
        // Track ICE connectivity
        let stunSuccess = false;
        let turnSuccess = false;
        
        // Listen for ICE candidates
        pc1.onicecandidate = (e) => {
          if (e.candidate) {
            // Check if this is a STUN or TURN candidate
            const candidate = e.candidate.candidate.toLowerCase();
            logInfo('ICE candidate received', { candidate });
            
            if (candidate.includes('typ srflx')) {
              stunSuccess = true;
              logInfo('STUN connectivity successful - received server reflexive candidate');
            } else if (candidate.includes('typ relay')) {
              turnSuccess = true;
              logInfo('TURN connectivity successful - received relay candidate');
            }
            
            // Forward candidate to pc2
            pc2.addIceCandidate(e.candidate);
          }
        };
        
        // Create offer/answer
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);
        
        // Wait a short time for candidates
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Update results
        results.stunServer.success = stunSuccess;
        if (!stunSuccess) {
          results.stunServer.error = 'No STUN candidates received. Possible firewall blocking.';
          logWarn('STUN connectivity test failed - no server reflexive candidates received');
        }
        
        results.turnServer.success = turnSuccess;
        if (!turnSuccess) {
          results.turnServer.error = 'No TURN candidates received. Check TURN credentials or firewall.';
          logWarn('TURN connectivity test failed - no relay candidates received');
        }
        
        // Clean up
        pc1.close();
        pc2.close();
      } catch (error) {
        logError('Error during STUN/TURN connectivity test', formatError(error), effectiveUserId, streamId);
        results.stunServer.error = results.turnServer.error = (error as Error).message;
      }
      
      logInfo('Network connectivity test results', results);
      return results;
    } catch (error) {
      logError('Network diagnostics failed', formatError(error), effectiveUserId, streamId);
      return { ...results, error: (error as Error).message };
    }
  }, [runtimeConfig, effectiveUserId, streamId]);
  
  // Add connectivity tests to diagnostic report
  const saveDiagnosticLogs = useCallback(async () => {
    try {
      // Run connectivity tests
      const connectivityResults = await testNetworkConnectivity();
      
      // Get browser diagnostics
      const browserDiagnostics = getBrowserDiagnostics();
      
      // Create a comprehensive diagnostic report
      const report = {
        timestamp: new Date().toISOString(),
        userId: effectiveUserId,
        streamId,
        isStreamer,
        browserInfo: browserDiagnostics,
        connectionStatus,
        error,
        streamReady,
        connectivityTests: connectivityResults,
        deviceInfo: {
          selectedVideoDevice,
          selectedAudioDevice,
          hasLocalStream: !!localStreamRef.current,
          hasVideo: localStreamRef.current ? localStreamRef.current.getVideoTracks().length > 0 : false,
          hasAudio: localStreamRef.current ? localStreamRef.current.getAudioTracks().length > 0 : false,
        },
        transports: {
          hasProducerTransport: !!transportRef.current.producer,
          hasConsumerTransport: !!transportRef.current.consumer,
          producerConnectionState: transportRef.current.producer ? 
            (transportRef.current.producer as any).connectionState : 'none',
          consumerConnectionState: transportRef.current.consumer ? 
            (transportRef.current.consumer as any).connectionState : 'none',
        },
        logs: diagnosticLogs
      };
      
      // Convert to JSON string
      const jsonReport = JSON.stringify(report, null, 2);
      
      // 1. Save local copy
      // Create a blob and download link
      const blob = new Blob([jsonReport], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and click it
      const a = document.createElement('a');
      a.href = url;
      a.download = `webrtc-diagnostic-${streamId}-${new Date().toISOString().replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      // 2. Send to server for analysis if permitted
      try {
        // Prepare a condensed version to reduce payload size for server
        const serverReport = {
          timestamp: report.timestamp,
          userId: report.userId,
          streamId: report.streamId,
          isStreamer: report.isStreamer,
          userAgent: navigator.userAgent,
          connectionStatus: report.connectionStatus,
          errorMessage: report.error,
          streamReady: report.streamReady,
          connectivityTests: report.connectivityTests,
          clientInfo: browserDiagnostics,
          // Include last 20 logs only to limit size
          recentLogs: diagnosticLogs.slice(-20)
        };
        
        // Send to server
        fetch('/api/logs/webrtc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serverReport)
        })
        .then(response => {
          if (response.ok) {
            logInfo('Diagnostics successfully sent to server');
          } else {
            logWarn('Failed to send diagnostics to server', { status: response.status });
          }
        })
        .catch(error => {
          logError('Error sending diagnostics to server', formatError(error));
        });
      } catch (serverError) {
        // Don't fail the diagnostic save if server upload fails
        logError('Failed to prepare/send diagnostics to server', formatError(serverError));
      }
      
      return true;
    } catch (error) {
      logError('Failed to save diagnostic logs', formatError(error), effectiveUserId, streamId);
      return false;
    }
  }, [effectiveUserId, streamId, isStreamer, connectionStatus, error, streamReady, 
      selectedVideoDevice, selectedAudioDevice, getBrowserDiagnostics, testNetworkConnectivity]);
  
  // Function to diagnose common issues and provide targeted advice
  const diagnoseStreamingIssue = useCallback(async () => {
    let diagnosis = 'Unknown issue. Please save diagnostic logs and contact support.';
    let possibleSolutions: string[] = [];
    
    try {
      // Run connectivity tests
      const connectivityResults = await testNetworkConnectivity();
      
      // Get additional diagnostics
      const browserInfo = getBrowserDiagnostics();
      let mediasoupDeviceSupport = 'unknown';
      
      // Test MediaSoup device support
      try {
        logInfo('Testing MediaSoup device support');
        const device = new mediasoupClient.Device();
        mediasoupDeviceSupport = 'supported';
        
        // Check if browser supports WebRTC features needed by MediaSoup
        // Safely check browserInfo structure
        if (browserInfo && 'browser' in browserInfo && 'webRTC' in browserInfo.browser) {
          if (!browserInfo.browser.webRTC.supportsPeerConnection) {
            mediasoupDeviceSupport = 'no-rtcpeerconnection';
          } else if (!browserInfo.browser.webRTC.supportsMediaRecorder) {
            mediasoupDeviceSupport = 'no-mediarecorder';
          }
        }
      } catch (err) {
        mediasoupDeviceSupport = 'error';
        logError('MediaSoup device support test failed', formatError(err), effectiveUserId, streamId);
      }
      
      // Add session information to diagnosis
      const sessionInfo = {
        sessionId,
        hasActiveConnection: hasActiveConnection.current,
        connectionAttempts: connectionAttemptsRef.current,
        isStreamer,
        isComponentMounted: isComponentMounted.current
      };
      
      // Check for issues in order of likelihood
      
      // 1. Check for duplicate connections
      if (error && error.includes('Another connection for this stream already exists')) {
        diagnosis = `Duplicate connection detected. Session ID: ${sessionId}`;
        possibleSolutions = [
          'Close other tabs or windows with this stream open',
          'Reload this page',
          'Try in a private/incognito window'
        ];
      }
      // 2. MediaSoup device support
      else if (mediasoupDeviceSupport !== 'supported') {
        diagnosis = `WebRTC not fully supported by your browser (${mediasoupDeviceSupport}).`;
        possibleSolutions = [
          'Update your browser to the latest version',
          'Try a different browser like Chrome, Firefox, or Safari',
          'Disable browser extensions that might block WebRTC'
        ];
      }
      // 3. Check network connectivity
      else if (!navigator.onLine) {
        diagnosis = 'Network connection is offline.';
        possibleSolutions = [
          'Check your internet connection',
          'Connect to a different network if available'
        ];
      }
      // 4. Check server connectivity
      else if (!connectivityResults.socketServer.success) {
        diagnosis = 'Cannot connect to streaming server.';
        possibleSolutions = [
          'Check your internet connection',
          'Server may be down or blocked by your network',
          'Try a different network connection if possible'
        ];
      }
      // 5. Check STUN/TURN connectivity (NAT traversal issues)
      else if (!connectivityResults.stunServer.success && !connectivityResults.turnServer.success) {
        diagnosis = 'NAT traversal failure: Cannot establish media connection through firewalls.';
        possibleSolutions = [
          'Your network firewall is likely blocking WebRTC connections',
          'Try a different network connection (e.g., mobile data instead of corporate WiFi)',
          'Contact your network administrator to allow WebRTC traffic'
        ];
      }
      // 6. Check browser compatibility
      else if (!window.RTCPeerConnection || !navigator.mediaDevices) {
        diagnosis = 'Your browser does not fully support WebRTC technology.';
        possibleSolutions = [
          'Update your browser to the latest version',
          'Try a different browser (Chrome, Firefox, or Safari)',
          'If using private browsing mode, try regular browsing mode'
        ];
      }
      // 7. Check if the stream is ready
      else if (!streamReady && connectionStatus === 'connected') {
        diagnosis = 'Connected to signaling server but no media stream received.';
        possibleSolutions = [
          'The streamer may have ended the broadcast',
          'The streamer might be having technical difficulties',
          'Try refreshing the page'
        ];
      }
      // 8. Check for media autoplay issues
      else if (streamReady && videoRef.current && videoRef.current.paused) {
        diagnosis = 'Media stream received but playback is paused (likely autoplay policy).';
        possibleSolutions = [
          'Click the video to start playback',
          'Check browser autoplay settings',
          'Try unmuting the stream'
        ];
      }
      // 9. Check for component mounting issues
      else if (!isComponentMounted.current) {
        diagnosis = 'Component mounting issue detected.';
        possibleSolutions = [
          'Try refreshing the page',
          'Clear browser cache and reload',
          'Check for errors in browser console'
        ];
      }
      // 10. General connection issues
      else if (connectionStatus !== 'connected') {
        diagnosis = `Connection status: ${connectionStatus}. Session ID: ${sessionId}`;
        possibleSolutions = [
          'Try refreshing the page',
          'Check your internet connection stability',
          'The streaming server may be overloaded'
        ];
      }
      
      logInfo('Streaming issue diagnosis', { 
        diagnosis, 
        possibleSolutions, 
        mediasoupDeviceSupport,
        connectivityResults,
        sessionInfo
      });
      
      return { 
        diagnosis, 
        possibleSolutions, 
        connectivityResults,
        mediasoupDeviceSupport,
        browserInfo,
        sessionInfo
      };
    } catch (error) {
      logError('Error diagnosing streaming issue', formatError(error), effectiveUserId, streamId);
      return { 
        diagnosis: 'Error during diagnosis process.', 
        possibleSolutions: ['Try refreshing the page', 'Check browser console for errors'],
        error: (error as Error).message,
        sessionId
      };
    }
  }, [connectionStatus, streamReady, testNetworkConnectivity, effectiveUserId, streamId, getBrowserDiagnostics, error, isStreamer, sessionId]);
  
  // Function to show diagnostics to the user
  const showStreamingDiagnostics = useCallback(async () => {
    setShowDebugControls(true);
    
    // Diagnose the issue
    const diagnosis = await diagnoseStreamingIssue();
    
    // Update the error message with more helpful information
    if (diagnosis.diagnosis && diagnosis.possibleSolutions.length > 0) {
      setError(`${diagnosis.diagnosis}\\n\\nTry these solutions:\\n• ${diagnosis.possibleSolutions.join('\\n• ')}`);
    }
    
    // Return the diagnosis for reference
    return diagnosis;
  }, [diagnoseStreamingIssue]);
  
  // Effect to respond to camera and microphone state changes from parent
  useEffect(() => {
    if (typeof externalCameraOn !== 'undefined' && isStreamer && localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = externalCameraOn;
      });
      setIsVideoHidden(!externalCameraOn);
      logInfo(`Camera state updated from parent: ${externalCameraOn ? 'enabled' : 'disabled'}`);
    }
  }, [externalCameraOn, isStreamer]);

  useEffect(() => {
    if (typeof externalMicrophoneOn !== 'undefined' && isStreamer && localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = externalMicrophoneOn;
      });
      setIsMuted(!externalMicrophoneOn);
      logInfo(`Microphone state updated from parent: ${externalMicrophoneOn ? 'enabled' : 'disabled'}`);
    }
  }, [externalMicrophoneOn, isStreamer]);
  
  // Add a diagnostic state saving function
  const saveComponentState = useCallback(() => {
    try {
      const state = {
        timestamp: new Date().toISOString(),
        component: 'WebRTCStreamManager',
        props: {
          streamId,
          userId: effectiveUserId,
          username: effectiveUsername,
          isStreamer
        },
        state: {
          connectionStatus,
          error,
          streamReady,
          isMuted,
          isVideoHidden,
          participants,
          selectedVideoDevice,
          selectedAudioDevice,
          showDeviceSelector,
          showDebugControls
        },
        refs: {
          mounted: mountedRef.current,
          connectionAttempts: connectionAttemptsRef.current,
          connectInProgress: connectInProgressRef.current,
          didInitialSetup: didInitialSetupRef.current,
          hasSocket: !!socketRef.current,
          socketConnected: socketRef.current?.connected,
          socketId: socketRef.current?.id,
          hasDevice: !!deviceRef.current,
          hasLocalStream: !!localStreamRef.current,
          hasProducerTransport: !!transportRef.current.producer,
          hasConsumerTransport: !!transportRef.current.consumer,
          hasVideoProducer: !!producersRef.current.video,
          hasAudioProducer: !!producersRef.current.audio,
          hasVideoConsumer: !!consumersRef.current.video,
          hasAudioConsumer: !!consumersRef.current.audio
        },
        mediaState: localStreamRef.current ? {
          videoTracks: localStreamRef.current.getVideoTracks().map(t => ({
            id: t.id,
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          })),
          audioTracks: localStreamRef.current.getAudioTracks().map(t => ({
            id: t.id,
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          }))
        } : 'No local stream',
        videoElement: videoRef.current ? {
          srcObject: !!videoRef.current.srcObject,
          paused: videoRef.current.paused,
          muted: videoRef.current.muted,
          currentTime: videoRef.current.currentTime,
          readyState: videoRef.current.readyState
        } : 'No video element',
        recentLogs: diagnosticLogs.slice(-20)
      };
      
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `webrtc-state-${streamId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      return true;
    } catch (error) {
      logError('Failed to save component state', formatError(error));
      return false;
    }
  }, [
    streamId, effectiveUserId, effectiveUsername, isStreamer,
    connectionStatus, error, streamReady, isMuted, isVideoHidden,
    participants, selectedVideoDevice, selectedAudioDevice, 
    showDeviceSelector, showDebugControls
  ]);
  
  // Add a function to handle manual play
  const handleManualPlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => {
          setAutoplayBlocked(false);
          setError(null);
          logInfo('Manual play successful');
        })
        .catch(err => {
          logError('Manual play failed', formatError(err), effectiveUserId, streamId);
        });
    }
  }, [effectiveUserId, streamId]);
  
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
      
      {/* Autoplay blocked overlay */}
      {autoplayBlocked && streamReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 cursor-pointer"
             onClick={handleManualPlay}>
          <div className="text-center bg-black/70 p-5 rounded-lg shadow-lg flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            <div className="text-white font-medium text-lg mb-1">Click to Play</div>
            <div className="text-gray-300 text-sm">Autoplay was blocked by your browser</div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && !autoplayBlocked && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/80 text-white p-2 text-sm text-center flex items-center justify-center z-20">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error.split('\\n').map((line, i) => (
            <span key={i} className="block">{line}</span>
          ))}
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
      
      {/* Debug controls */}
      {(process.env.NODE_ENV !== 'production' || showDebugControls) && (
        <div className="absolute bottom-16 left-4 flex flex-col space-y-2 z-20">   
          <button
            onClick={saveComponentState}
            className="bg-blue-500/70 text-white p-2 rounded hover:bg-blue-600/70 transition-colors flex items-center space-x-1"
            title="Save component state for debugging"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span className="text-xs">Save Debug State</span>
          </button>
          
          {!isStreamer && (
            <button
              onClick={showStreamingDiagnostics}
              className="bg-blue-500/70 text-white p-2 rounded hover:bg-blue-600/70 transition-colors flex items-center space-x-1"
              title="Diagnose streaming issues"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="8"></line>
              </svg>
              <span className="text-xs">Diagnose Issues</span>
            </button>
          )}
          
          <button
            onClick={testNetworkConnectivity}
            className="bg-blue-500/70 text-white p-2 rounded hover:bg-blue-600/70 transition-colors flex items-center space-x-1"
            title="Test network connectivity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12s2-8 7-8 7 8 7 8-2 8-7 8-7-8-7-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span className="text-xs">Test Network</span>
          </button>
        </div>
      )}

      {/* Debug button to show controls */}
      {!showDebugControls && (
        <button
          onClick={() => setShowDebugControls(true)}
          className="absolute bottom-4 left-20 bg-black/30 text-white p-1 rounded text-xs opacity-50 hover:opacity-100 transition-opacity z-10"
          title="Show debug controls"
        >
          Debug
        </button>
      )}
      
      {/* Device selector (for streamers only) */}
      <div className={`absolute top-4 right-4 z-20 ${!isStreamer ? 'hide-for-viewers' : ''}`}>
        <button
          onClick={() => setShowDeviceSelector(prev => !prev)}
          className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors relative"
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
      