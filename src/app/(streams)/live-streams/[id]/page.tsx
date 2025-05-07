"use client";

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/frontend-auth";
import { toast } from "sonner";
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import {
  Loader2,
  Users,
  Clock,
  Eye,
  PlayCircle,
  X,
  Heart,
  Share2,
  Calendar,
  ArrowLeft,
  Terminal,
  RotateCw,
  Settings,
  TriangleAlert,
  Timer,
  Play,
  Radio,
  MoveVertical,
  Volume2,
  VolumeX,
  ChevronUp,
  Tv
} from "lucide-react";
import { StreamDiagnostics } from './components/StreamDiagnostics';
import WebRTCStreamManager from './components/WebRTCStreamManager';
import { getCookie } from "cookies-next";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import StreamChat from './components/StreamChat';
import BiddingInterface from './components/BiddingInterface';
import ProductDisplay from './components/ProductDisplay';
import CreateProductForm from './components/CreateProductForm';
import Image from "next/image";
import StreamControls from './components/StreamControls';

interface LiveStreamDetails {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  userId: string;
  status: 'LIVE' | 'ENDED' | 'SCHEDULED';
  startTime?: string;
  updatedAt?: string;
  user?: {
    id: string;
    username: string;
    profileImage?: string;
  };
}

interface LogItem {
  timestamp: string;
  message: string;
  data?: unknown;
  level: 'info' | 'warn' | 'error' | 'debug';
}

// Add this CSS at the top of the file
const verticalStreamStyles = `
  .vertical-stream-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 0;
    background: var(--background);
    min-height: 100vh;
  }

  .stream-content-wrapper {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    height: calc(100vh - 2rem);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    background: var(--background);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    .stream-content-wrapper {
      max-width: 100%;
      height: 100vh;
      border-radius: 0;
    }
  }

  .video-container {
    flex: 1;
    width: 100%;
    position: relative;
    background: #000;
    overflow: hidden;
  }

  .video-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    pointer-events: none;
  }

  .stream-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    z-index: 20;
    background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
    pointer-events: auto;
  }

  .stream-info-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .stream-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    z-index: 20;
    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  }

  .stream-info {
    display: flex;
    flex-direction: column;
    margin-left: 0.5rem;
  }

  .stream-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: absolute;
    right: 1rem;
    bottom: 4rem;
    z-index: 30;
    gap: 0.75rem;
    pointer-events: auto;
  }

  .action-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    pointer-events: auto;
  }

  .action-button:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .chat-container {
    position: absolute;
    bottom: 4rem;
    left: 0;
    width: 75%;
    max-height: 35%;
    overflow-y: auto;
    z-index: 15;
    padding: 0 1rem;
    pointer-events: auto;
  }

  .product-container {
    position: absolute;
    bottom: calc(35% + 5rem);
    left: 0;
    width: 100%;
    z-index: 16;
    padding: 0 1rem;
    pointer-events: auto;
  }

  .back-button {
    margin-top: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    padding: 0.5rem;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    pointer-events: auto;
  }

  .back-button:hover {
    background: rgba(0, 0, 0, 0.8);
  }
`;

// Add a new interface for active product bids
interface ActiveBid {
  id: string;
  productId: string;
  streamId: string;
  timeRemaining: number; // in seconds
  isActive: boolean;
}

// Add this CSS at the top of the file after the existing CSS section
const fixOverlapStyles = `
  /* Fix for device selector overlapping with LIVE indicator */
  .stream-header {
    z-index: 30 !important; /* Higher z-index to appear above device selector */
  }
  
  /* Position the device selector button properly */
  .device-selector-container {
    position: absolute;
    top: 3.5rem; /* Push it down below the LIVE text */
    right: 1rem;
    z-index: 25;
  }
`;

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.id as string;
  const { user } = useAuth();
  const { token } = getAuth();
  const userId = user?.id;
  const username = user?.username;
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();

  const [streamDetails, setStreamDetails] = useState<LiveStreamDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<{
    isConnected: boolean;
    isReconnecting: boolean;
    lastError: string | null;
  }>({ isConnected: true, isReconnecting: false, lastError: null });
  const [showBiddingInterface, setShowBiddingInterface] = useState<boolean>(false);
  const [activeProductBid, setActiveProductBid] = useState<ActiveBid | null>(null);
  const [showCreateProduct, setShowCreateProduct] = useState<boolean>(false);

  const logMessage = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', data?: unknown) => {
    const timestamp = new Date().toISOString();
    const pagePrefix = '[LiveStreamPage]';
    const formattedLevel = level.toUpperCase().padEnd(5, ' ');
    
    // Format the message with timestamp and metadata
    let consoleMessage = `${timestamp} ${pagePrefix} [${formattedLevel}] ${message}`;
    
    // Format data for better readability
    let formattedData = '';
    if (data !== undefined && data !== null) {
      try {
        if (typeof data === 'object') {
          formattedData = JSON.stringify(data, (key, value) => {
            // Handle circular references and functions
            if (typeof value === 'function') return '[Function]';
            if (key === 'password' || key === 'token') return '[REDACTED]';
            if (typeof value === 'object' && value !== null) {
              // Handle DOM elements and special objects
              if (value instanceof HTMLElement) return `[HTMLElement:${value.tagName}]`;
              if (value instanceof WebSocket) {
                return `[WebSocket:${['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][value.readyState]}]`;
              }
            }
            return value;
          }, 2);
        } else {
          formattedData = String(data);
        }
      } catch (e) {
        formattedData = '[Unserializable data]';
      }
    }
    
    // Styled console logging with appropriate level
    switch (level) {
      case 'error':
        console.error(`%c${consoleMessage}`, 'color: #FF5555', formattedData ? formattedData : '');
        break;
      case 'warn':
        console.warn(`%c${consoleMessage}`, 'color: #FFAA55', formattedData ? formattedData : '');
        break;
      case 'debug':
        console.log(`%c${consoleMessage}`, 'color: #55AAFF', formattedData ? formattedData : '');
        break;
      case 'info':
      default:
        console.log(`%c${consoleMessage}`, 'color: #AAAAAA', formattedData ? formattedData : '');
    }
    
    // Add to logs state for UI display
    setLogs(prevLogs => {
      const newLog = { timestamp, message, data, level };
      // Keep max 200 most recent logs
      return [newLog, ...prevLogs.slice(0, 199)];
    });
    
    // Mark performance timeline for tracing
    try {
      performance.mark(`livestreampage-${level}-${Date.now()}`);
    } catch (e) {
      // Ignore if performance API not available
    }
  }, []);

  // Add system information diagnostics
  const collectSystemDiagnostics = useCallback(() => {
    // Use runtime config values if available
    const runtimeEnv = runtimeConfig ? {
      appUrl: runtimeConfig.appUrl,
      apiUrl: runtimeConfig.apiUrl,
      socketUrl: runtimeConfig.socketUrl,
      wsUrl: runtimeConfig.wsUrl,
      webrtcServer: runtimeConfig.webrtcServer,
      turnServer: runtimeConfig.turnServerUrl,
      stunServer: runtimeConfig.stunServerUrl
    } : { status: 'loading or error' };

    const diag = {
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
        connection: (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt,
          saveData: (navigator as any).connection.saveData
        } : 'unknown'
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth
      },
      webRTC: {
        RTCPeerConnection: !!window.RTCPeerConnection,
        RTCDataChannel: !!window.RTCDataChannel,
        RTCSessionDescription: !!window.RTCSessionDescription,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      },
      environment: {
        protocol: window.location.protocol,
        host: window.location.host,
        pathname: window.location.pathname,
        runtimeConfig: runtimeEnv
      },
      timestamp: new Date().toISOString()
    };
    
    logMessage('System diagnostic information collected', 'debug', diag);
    return diag;
  }, [logMessage, runtimeConfig]);

  const fetchStreamDetails = useCallback(async () => {
    if (!streamId || isConfigLoading) return;
    
    try {
      // Get token explicitly from both sources
      const authToken = token ?? getCookie('token') as string | undefined;
      const headers: HeadersInit = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        logMessage("Using auth token for stream details fetch", 'debug');
      } else {
        logMessage("No auth token found for stream details fetch", 'warn');
      }
      
      // Construct the correct API URL - ensure no duplication of /api/
      const apiEndpoint = `/api/live-streams/${streamId}`;
      
      logMessage("Making stream details API request", 'debug', {
        url: apiEndpoint,
        headers: Object.keys(headers)
      });
      
      const response = await fetch(apiEndpoint, {
        headers,
        next: { revalidate: 10 }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Stream not found.");
          logMessage(`Fetch failed: Stream not found (404)`, 'error', {
            status: response.status, 
            streamId
          });
          toast.error("Stream not found.");
          setStreamDetails(null);
          return;
        }
        throw new Error(`Failed to fetch stream details: ${response.status}`);
      }
      
      // Check if we're getting HTML instead of JSON (which suggests a server error)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Check if response is HTML
        const text = await response.text();
        if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
          setError("Received HTML instead of JSON. The server might be returning an error page.");
          logMessage('Received HTML instead of JSON response', 'error', {
            previewLength: Math.min(text.length, 100),
            preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
          });
        } else {
          setError("Invalid response format from server.");
          logMessage('Invalid response format', 'error', {
            previewLength: Math.min(text.length, 100),
            preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
          });
        }
        
        setStreamDetails(null);
        return;
      }
      
      // At this point we know it's a valid JSON response
      const data = await response.json();
      
      logMessage('Stream details fetched successfully', 'info', { 
        id: data.id, 
        status: data.status, 
        creatorId: data.creatorId, 
        title: data.title
      });
      
      setStreamDetails(data);

      // Check if the user is the streamer (compare user ID with creatorId)
      const currentIsStreamer = !!userId && data.creatorId === userId;
      logMessage(`User ${userId} ${currentIsStreamer ? 'IS' : 'IS NOT'} the streamer (Creator ID: ${data.creatorId})`, 'info');

      // Collect system diagnostics on successful fetch
      collectSystemDiagnostics();

    } catch (err: any) {
      console.error('Error fetching stream details:', err);
      
      const errorMsg = err.message || 'Unknown fetch error';
      logMessage(`Fetch failed: ${errorMsg}`, 'error', {
        err,
        streamId,
        stack: err.stack
      });
      
      toast.error("Could not load stream details. Please try refreshing the page.");
      setError("Failed to load stream information");
      setStreamDetails(null);
    } finally {
      setIsLoading(false);
      logMessage("Fetch stream details finished.", 'debug');
    }
  }, [streamId, userId, token, getCookie, logMessage, collectSystemDiagnostics, isConfigLoading]);

  // Main stream view - determine if the current user is the streamer
  const isCurrentUserStreamer = userId === streamDetails?.creatorId;
  
  // Add this function to fetch active bids
  const fetchActiveBid = useCallback(async () => {
    if (!streamId || isConfigLoading) return;
    
    try {
      // Get token explicitly from both sources
      const authToken = token ?? getCookie('token') as string | undefined;
      const headers: HeadersInit = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        logMessage("Using auth token for active bid fetch", 'debug');
      } else {
        logMessage("No auth token found for active bid fetch", 'warn');
      }
      
      // Construct the correct API URL - ensure no duplication of /api/
      const apiEndpoint = `/api/live-streams/${streamId}/active-bid`;
      
      logMessage("Making active bid API request", 'debug', {
        url: apiEndpoint,
        headers: Object.keys(headers)
      });
      
      const response = await fetch(apiEndpoint, {
        headers,
        next: { revalidate: 10 } // Check for new bids frequently
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch active bid: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Non-JSON response from active bid endpoint');
      }
      
      const data = await response.json();
      logMessage("Active bid data received", 'debug', data);
      
      if (data && data.isActive) {
        setActiveProductBid({
          id: data.id,
          productId: data.productId,
          streamId: data.streamId,
          timeRemaining: data.timeRemaining,
          isActive: true
        });
      } else {
        setActiveProductBid(null);
      }
    } catch (error) {
      console.error("Error fetching active bid:", error);
      logMessage(`Error fetching active bid: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [streamId, token, getCookie, logMessage, isConfigLoading]);

  // Add polling for active bids
  useEffect(() => {
    if (!isCurrentUserStreamer && streamDetails?.status === 'LIVE') {
      fetchActiveBid();
      
      const bidInterval = setInterval(() => {
        fetchActiveBid();
      }, 5000); // Check every 5 seconds for new bids
      
      return () => clearInterval(bidInterval);
    }
  }, [fetchActiveBid, isCurrentUserStreamer, streamDetails?.status]);

  // Handle creating a new product for bid
  const handleCreateProduct = () => {
    setShowCreateProduct(true);
  };

  useEffect(() => {
    // Log component mount
    logMessage('LiveStreamPage component mounted', 'info', {
      streamId,
      userId: userId || 'not authenticated',
      url: window.location.href
    });
    
    fetchStreamDetails();
    
    // Return cleanup function
    return () => {
      logMessage('LiveStreamPage component unmounting', 'debug');
    };
  }, [fetchStreamDetails, logMessage, streamId, userId]);

  // Derive stream status and permissions
  const currentStreamStatus = streamDetails?.status ?? null;
  const isStreamer = !!userId && !!streamDetails && streamDetails.creatorId === userId;
  // Remove user authentication requirement for viewers
  const shouldRenderWebRTC = !isLoading && !!streamDetails && !!streamId;
  const canRenderWebRTC = shouldRenderWebRTC && (currentStreamStatus === 'LIVE' || (isStreamer && currentStreamStatus === 'SCHEDULED'));

  useEffect(() => {
    // Use runtime config values if available for logging
    const runtimeEnv = runtimeConfig ? {
      SOCKET_URL: runtimeConfig.socketUrl,
      WS_URL: runtimeConfig.wsUrl,
      WEBRTC_SERVER: runtimeConfig.webrtcServer,
      API_URL: runtimeConfig.apiUrl,
      // Note: BACKEND_API_URL is usually same as API_URL in this setup
      BACKEND_API_URL: runtimeConfig.apiUrl 
    } : { status: 'loading or error' };

    // Log whenever important state changes
    logMessage('[LiveStreamPage] Render check variables:', 'debug', {
      isLoading,
      hasStreamDetails: !!streamDetails,
      userId,
      username,
      streamId,
      derivedStatus: currentStreamStatus,
      derivedIsStreamer: isStreamer,
      shouldRenderBase: shouldRenderWebRTC,
      canRenderFinal: canRenderWebRTC,
      env: runtimeEnv, // Log runtime config
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language
      },
      performance: {
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        } : 'not available'
      }
    });
  }, [isLoading, streamDetails, userId, username, streamId, currentStreamStatus, isStreamer, shouldRenderWebRTC, canRenderWebRTC, logMessage, runtimeConfig]);

  const handleStartStream = async () => {
    const startTime = performance.now();
    logMessage('Streamer attempting to start the stream', 'info', {
      streamId, 
      isStreamer, 
      currentStatus: currentStreamStatus
    });
    
    if (!streamId || !isStreamer) {
      logMessage('Start stream cancelled: Invalid streamId or user is not streamer', 'warn', { 
        streamId, 
        isStreamer, 
        userId, 
        creatorId: streamDetails?.creatorId 
      });
      toast.error("Cannot start stream.");
      return;
    }
    
    setIsLoading(true);
    
    // If config is still loading, wait briefly
    if (isConfigLoading) {
      logMessage("Runtime config loading, waiting briefly for start stream...", 'debug');
      // Wait for a short time to see if config loads
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Use config if available, or fall back to default
    const apiUrl = runtimeConfig?.apiUrl || '/api';
    
    if (!runtimeConfig) {
      logMessage("Using fallback API URL for start stream: " + apiUrl, 'warn');
    }

    try {
      if (!token) {
        logMessage("Start stream failed: No auth token from context", "error", {
          isAuthenticated: !!user,
          hasToken: !!token
        });
        
        toast.error("Authentication required. Please login and try again.");
        setIsLoading(false);
        return;
      }

      performance.mark('stream-start-api-call-begin');
      
      // Ensure correct API path construction
      const startEndpoint = `/api/live-streams/${streamId}/start`;
      
      logMessage('[LiveStreamPage] Calling start endpoint...', 'debug', {
        url: startEndpoint,
        method: 'POST',
        hasToken: !!token
      });
      
      const response = await fetch(startEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      performance.mark('stream-start-api-call-end');
      performance.measure('stream-start-api-call', 
                         'stream-start-api-call-begin', 
                         'stream-start-api-call-end');
      
      const apiCallDuration = performance.getEntriesByName('stream-start-api-call')[0]?.duration || 0;

      if (!response.ok) {
        let errorMsg = `Error starting stream: ${response.status}`;
        let errorBody = '';
        
        try {
          // First try to parse as JSON
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorJson = await response.json();
            errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
          } else {
            // Fall back to text
            errorBody = await response.text();
          }
          errorMsg += ` - ${errorBody}`;
        } catch (e) { /* Ignore parsing errors */ }
        
        console.error(errorMsg);
        logMessage(`Start stream failed: ${errorMsg}`, 'error', {
          status: response.status,
          duration: `${apiCallDuration.toFixed(2)}ms`,
          streamId,
          responseType: response.headers.get('content-type')
        });
        
        if (response.status === 401) {
          toast.error('Authentication required. Please login and try again.');
          
          // Optionally redirect to login page
          // router.push('/login');
        } else {
          toast.error(`Failed to start stream: ${errorBody || 'Unknown error'}`);
        }
        
        setIsLoading(false);
        return;
      }

      // Check the content type before trying to parse as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        logMessage('Received non-JSON response from start endpoint', 'error', {
          contentType,
          status: response.status,
          preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        });
        
        toast.error('Unexpected response format. Please try again.');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      logMessage('Stream started successfully via API', 'info', {
        ...data,
        apiDuration: `${apiCallDuration.toFixed(2)}ms`,
        totalDuration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      
      toast.success('Stream started successfully!');

      // Refresh stream details to get updated status
      await fetchStreamDetails();

    } catch (err: any) {
      console.error('Error in handleStartStream:', err);
      logMessage(`Start stream process failed: ${err.message}`, 'error', {
        error: err,
        stack: err.stack,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`
      });
      toast.error('Failed to start stream. Please try again.');
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    logMessage('User navigating back to home', 'info');
    router.push('/live-streams');
  };

  const handleLike = () => {
    if (!isLiked) {
      setLikeCount(prev => prev + 1);
    } else {
      setLikeCount(prev => prev - 1);
    }
    setIsLiked(!isLiked);
    logMessage(`User ${isLiked ? 'unliked' : 'liked'} the stream`, 'info');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Actual muting logic would be implemented in the WebRTCStreamManager
  };

  const handleConnectionReset = () => {
    logMessage("User initiated connection reset (page reload)", "warn");
    window.location.reload();
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "Belirtilmedi";
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return "Geçersiz Tarih";
        }
        return new Intl.DateTimeFormat("tr-TR", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    } catch (e) {
        logMessage("Error formatting date", "error", { dateString, error: e });
        return "Hata";
    }
};

  // Early return for loading state
  if (isLoading) {
    return (
      <div className="vertical-stream-container">
        <style jsx>{verticalStreamStyles}</style>
        <div className="stream-content-wrapper">
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[var(--primary)]" />
              <h2 className="text-lg font-medium">Yayın Yükleniyor</h2>
              <p className="text-[var(--muted-foreground)] mt-2">Canlı bağlantı kuruluyor...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="vertical-stream-container">
        <style jsx>{verticalStreamStyles}</style>
        <div className="stream-content-wrapper">
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
              <TriangleAlert className="h-12 w-12 mx-auto mb-4 text-[var(--destructive)]" />
              <h2 className="text-lg font-medium">Yayın Yüklenemedi</h2>
              <p className="text-[var(--muted-foreground)] mt-2">{error}</p>
              <button 
                onClick={handleBackToHome}
                className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Stream not found or not live
  if (!streamDetails) {
    return (
      <div className="vertical-stream-container">
        <style jsx>{verticalStreamStyles}</style>
        <div className="stream-content-wrapper">
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--muted)] flex items-center justify-center">
                <Tv className="h-8 w-8 text-[var(--muted-foreground)]" />
              </div>
              <h2 className="text-lg font-medium">Yayın Bulunamadı</h2>
              <p className="text-[var(--muted-foreground)] mt-2">
                Bu yayın artık mevcut değil veya henüz başlamamış olabilir.
              </p>
              <button 
                onClick={handleBackToHome}
                className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{verticalStreamStyles}</style>
      <style jsx global>{fixOverlapStyles}</style>
      <div className="vertical-stream-container">
        <div className="stream-content-wrapper">
          {/* Main video container */}
          <div className="video-container">
            <WebRTCStreamManager
              streamId={streamId}
              userId={userId || ''}
              username={username || ''}
              isStreamer={isCurrentUserStreamer}
            />
            
            {/* Video overlay elements */}
            <div className="video-overlay">
              {/* Stream header */}
              <div className="stream-header">
                <div className="stream-info-wrapper">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white">
                      {streamDetails.user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="stream-info">
                      <span className="text-white font-medium">{streamDetails.user?.username || 'Unknown User'}</span>
                      <span className="text-white/80 text-sm">{streamDetails.title}</span>
                    </div>
                  </div>
                  {/* Status badge */}
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 rounded-full bg-red-500 text-white text-xs flex items-center">
                      <Radio className="h-3 w-3 mr-1 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                </div>
                <button onClick={handleBackToHome} className="back-button">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>
              
              {/* Stream actions - moved to right side vertical */}
              <div className="stream-actions">
                <button onClick={handleLike} className="action-button" aria-label="Like stream">
                  <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
                <button className="action-button" aria-label="Share stream">
                  <Share2 className="h-5 w-5" />
                </button>
                <button onClick={() => setShowDiagnostics(!showDiagnostics)} className="action-button" aria-label="Stream diagnostics">
                  <Terminal className="h-5 w-5" />
                </button>
              </div>
              
              {/* Product display for bidding - moved above chat */}
              <div className="product-container">
                {isCurrentUserStreamer ? (
                  // Streamer view - always show product controls
                  showCreateProduct ? (
                    <CreateProductForm 
                      streamId={streamId}
                      onCancel={() => setShowCreateProduct(false)}
                      onSuccess={() => {
                        setShowCreateProduct(false);
                        // Refresh active bids after creating a new product
                        fetchActiveBid();
                      }}
                    />
                  ) : (
                    <div className="flex flex-col space-y-2">
                      <ProductDisplay 
                        streamId={streamId} 
                        className="pointer-events-auto"
                        onBidClick={() => setShowBiddingInterface(true)}
                      />
                      <button 
                        onClick={handleCreateProduct}
                        className="bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Create New Product Bid
                      </button>
                    </div>
                  )
                ) : (
                  // Viewer view - only show product when there's an active bid
                  activeProductBid?.isActive ? (
                    <div className="relative">
                      <ProductDisplay 
                        streamId={streamId} 
                        className="pointer-events-auto"
                        onBidClick={() => setShowBiddingInterface(true)}
                      />
                      {activeProductBid.timeRemaining > 0 && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          {activeProductBid.timeRemaining}s
                        </div>
                      )}
                    </div>
                  ) : null
                )}
              </div>
              
              {/* Chat container - allocated more space */}
              <div className="chat-container">
                <StreamChat 
                  streamId={streamId} 
                  currentUserId={userId || ''} 
                  currentUsername={username || ''}
                  className="w-full h-full"
                />
              </div>
              
              {/* Stream footer - countdown timer etc. */}
              <div className="stream-footer">
                {isCurrentUserStreamer ? (
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Streamer controls</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">Viewer controls</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Diagnostics panel */}
          {showDiagnostics && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white z-50 h-1/2 overflow-auto">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Stream Diagnostics</h3>
                  <button onClick={() => setShowDiagnostics(false)} className="text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <StreamDiagnostics 
                  streamId={streamId} 
                  streamInfo={streamDetails}
                  connectionState={connectionState}
                  logs={logs}
                  onReset={handleConnectionReset}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}