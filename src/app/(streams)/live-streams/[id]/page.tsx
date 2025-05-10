// src/app/(streams)/live-streams/[id]/page.tsx
"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  Suspense,
  useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/frontend-auth";
import { toast } from "sonner";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
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
  Tv,
  Globe,
  Cpu,
} from "lucide-react";
import { StreamDiagnostics } from "./components/StreamDiagnostics";
import WebRTCStreamManager from "./components/WebRTCStreamManager";
import { getCookie } from "cookies-next";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import StreamChat from "./components/StreamChat";
import BiddingInterface from "./components/BiddingInterface";
import ProductDisplay from "./components/ProductDisplay";
import CreateProductForm from "./components/CreateProductForm";
import Image from "next/image";
import StreamControls from "./components/StreamControls";

// Helper function to detect loopback addresses
const isLoopbackAddress = (address?: string): boolean => {
  if (!address) return false;

  // Remove IPv6 brackets if present
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.substring(1, address.length - 1);
  }

  return (
    address === "localhost" ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "0.0.0.0" ||
    address === "::" ||
    // Also check for full IPv6 localhost
    address === "0:0:0:0:0:0:0:1"
  );
};

// Check if current connection is likely a loopback
const isLikelyLoopbackConnection = (): boolean => {
  // Check hostname
  const hostname = window.location.hostname;
  if (isLoopbackAddress(hostname)) return true;

  // Check for localhost variations
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname === "[::1]" ||
    hostname.includes(".local")
  ) {
    return true;
  }

  return false;
};

interface LiveStreamDetails {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  userId: string;
  status: "LIVE" | "ENDED" | "SCHEDULED";
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
  level: "info" | "warn" | "error" | "debug";
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
    max-height: 25%;
    overflow-y: auto;
    z-index: 15;
    padding: 0 1rem;
    pointer-events: auto;
  }

  .product-container {
    position: absolute;
    bottom: calc(25% + 5rem);
    left: 0;
    width: 75%;
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

// Add this CSS at the top of the file after the existing CSS section
const fixOverlapStyles = `
  /* Fix for device selector overlapping with LIVE indicator */
  .stream-header {
    z-index: 30 !important; /* Higher z-index to appear above device selector */
  }
  
  /* Override the device selector position in WebRTCStreamManager to place it below the LIVE indicator */
  .video-container .absolute.top-4.right-4.z-10 {
    top: 8rem !important; /* Increased from 6rem to position further below LIVE indicator */
    right: 1rem !important; /* Keep it aligned with the right edge */
    z-index: 25 !important; /* Ensure it's below the stream header but above other elements */
  }
  
  /* Make sure the dropdown appears correctly */
  .video-container .absolute.top-4.right-4.z-10 .absolute.right-0 {
    z-index: 26 !important; /* Higher z-index for the dropdown */
  }
  
  /* Hide the device selector for non-streamers */
  .hide-for-viewers {
    display: none !important;
  }
`;

// Modify the broadcastControlStyles to fix positioning issues
const broadcastControlStyles = `
  /* Create a container for product bid and controls in a row */
  .product-and-controls-row {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 0;
    right: 0;
    display: flex;
    flex-direction: row;
    width: 100%;
    z-index: 50; /* Increased z-index to ensure visibility */
    pointer-events: all !important; /* Force pointer events to be enabled */
  }

  /* Make product container fixed width on the left */
  .product-container {
    position: relative;
    width: 75%;
    padding: 0 0.5rem 0 1rem;
    pointer-events: auto;
  }

  /* Style the chat container to take up 100% width */
  .chat-container {
    position: absolute;
    bottom: 4rem;
    left: 0;
    width: 100%;
    max-height: 30%;
    overflow-y: auto;
    z-index: 15;
    padding: 0 1rem;
    pointer-events: auto;
  }

  /* Move the media settings panel to avoid overlap */
  .video-container .absolute.top-4.right-4.z-10 {
    top: 4rem !important;
    right: 1rem !important;
    z-index: 25 !important;
  }

  /* Broadcast controls positioning and styling */
  .broadcast-controls-container {
    position: relative !important; /* Force relative positioning */
    width: 25%;
    z-index: 100 !important;  /* Increased from 40 to 100 to make sure it's on top */
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    max-height: 100%;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    pointer-events: all !important; /* Force pointer events to be enabled */
  }

  /* Add glow effect to the broadcast buttons */
  .broadcast-button {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    transition: all 0.3s ease;
    backdrop-filter: blur(4px);
    min-width: 40px;
    min-height: 40px;
    z-index: 101 !important;  /* Increased from 41 to 101 */
    pointer-events: all !important;
    cursor: pointer !important;
    position: relative !important;
  }

  .broadcast-button:hover {
    transform: scale(1.05);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
  }

  .broadcast-button * {
    pointer-events: all !important;
  }

  /* Start broadcast button styling */
  .broadcast-button-start {
    background: linear-gradient(135deg, #22c55e, #16a34a);
  }
  
  /* End broadcast button styling */
  .broadcast-button-end {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }

  /* Make controls more visible on mobile */
  @media (max-width: 768px) {
    .product-container {
      width: 65%;
    }
    
    .broadcast-controls-container {
      width: 35%;
      padding: 0.5rem;
    }
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

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.id as string;
  const { user } = useAuth();
  const { token } = getAuth();
  const userId = user?.id;
  const username = user?.username;
  const { config: runtimeConfig, isLoading: isConfigLoading } =
    useRuntimeConfig();

  const [streamDetails, setStreamDetails] = useState<LiveStreamDetails | null>(
    null
  );
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
    isLoopback?: boolean;
    optimizedForLoopback?: boolean;
  }>({
    isConnected: true,
    isReconnecting: false,
    lastError: null,
    isLoopback: isLikelyLoopbackConnection(),
  });
  const [showBiddingInterface, setShowBiddingInterface] =
    useState<boolean>(false);
  const [activeProductBid, setActiveProductBid] = useState<ActiveBid | null>(
    null
  );
  const [showCreateProduct, setShowCreateProduct] = useState<boolean>(false);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState<boolean>(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Add a state to manage WebRTC key to force remount when needed
  const [webRtcKey, setWebRtcKey] = useState<string>(
    `webrtc-stream-${streamId}-${Date.now()}`
  );

  // Track if we've optimized for loopback
  const [optimizedForLoopback, setOptimizedForLoopback] =
    useState<boolean>(false);

  // Add this line near other useRef declarations
  const reconnectWebRTCRef = useRef<(() => void) | null>(null);

  // Helper function to generate random ID for anonymous users
  const generateRandomId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const logMessage = useCallback(
    (
      message: string,
      level: "info" | "warn" | "error" | "debug" = "info",
      data?: unknown
    ) => {
      const timestamp = new Date().toISOString();
      const pagePrefix = "[LiveStreamPage]";
      const formattedLevel = level.toUpperCase().padEnd(5, " ");

      // Format the message with timestamp and metadata
      let consoleMessage = `${timestamp} ${pagePrefix} [${formattedLevel}] ${message}`;

      // Format data for better readability
      let formattedData = "";
      if (data !== undefined && data !== null) {
        try {
          if (typeof data === "object") {
            formattedData = JSON.stringify(
              data,
              (key, value) => {
                // Handle circular references and functions
                if (typeof value === "function") return "[Function]";
                if (key === "password" || key === "token") return "[REDACTED]";
                if (typeof value === "object" && value !== null) {
                  // Handle DOM elements and special objects
                  if (value instanceof HTMLElement)
                    return `[HTMLElement:${value.tagName}]`;
                  if (value instanceof WebSocket) {
                    return `[WebSocket:${
                      ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][
                        value.readyState
                      ]
                    }]`;
                  }
                }
                return value;
              },
              2
            );
          } else {
            formattedData = String(data);
          }
        } catch (e) {
          formattedData = "[Unserializable data]";
        }
      }

      // Styled console logging with appropriate level
      switch (level) {
        case "error":
          console.error(
            `%c${consoleMessage}`,
            "color: #FF5555",
            formattedData ? formattedData : ""
          );
          break;
        case "warn":
          console.warn(
            `%c${consoleMessage}`,
            "color: #FFAA55",
            formattedData ? formattedData : ""
          );
          break;
        case "debug":
          console.log(
            `%c${consoleMessage}`,
            "color: #55AAFF",
            formattedData ? formattedData : ""
          );
          break;
        case "info":
        default:
          console.log(
            `%c${consoleMessage}`,
            "color: #AAAAAA",
            formattedData ? formattedData : ""
          );
      }

      // Add to logs state for UI display
      setLogs((prevLogs) => {
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
    },
    []
  );

  // Add a handler for loopback connection detection from WebRTCStreamManager
  const handleLoopbackDetected = useCallback(
    (isLoopback: boolean) => {
      logMessage(
        `Loopback connection ${isLoopback ? "detected" : "not detected"}`,
        isLoopback ? "warn" : "info"
      );

      setConnectionState((prev) => ({
        ...prev,
        isLoopback,
        optimizedForLoopback: prev.optimizedForLoopback || isLoopback,
      }));

      if (isLoopback && !optimizedForLoopback) {
        // Set a flag to avoid showing this message multiple times
        setOptimizedForLoopback(true);

        // Toast for loopback connections to inform users
        toast.info(
          "Local connection detected. WebRTC settings optimized for localhost.",
          { duration: 5000 }
        );

        logMessage("Optimized WebRTC settings for loopback connection", "info");
      }
    },
    [logMessage, optimizedForLoopback]
  );

  const handleParticipantCount = useCallback(
    (count: number) => {
      logMessage(`Stream participants: ${count}`, "info");
    },
    [logMessage]
  );

  // Add system information diagnostics
  const collectSystemDiagnostics = useCallback(() => {
    // Use runtime config values if available
    const runtimeEnv = runtimeConfig
      ? {
          appUrl: runtimeConfig.appUrl,
          apiUrl: runtimeConfig.apiUrl,
          socketUrl: runtimeConfig.socketUrl,
          wsUrl: runtimeConfig.wsUrl,
          webrtcServer: runtimeConfig.webrtcServer,
          turnServer: runtimeConfig.turnServerUrl,
          stunServer: runtimeConfig.stunServerUrl,
        }
      : { status: "loading or error" };

    // Check for loopback connections
    const isLoopback = isLikelyLoopbackConnection();
    const host = window.location.hostname;

    const diag = {
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory || "unknown",
        connection: (navigator as any).connection
          ? {
              effectiveType: (navigator as any).connection.effectiveType,
              downlink: (navigator as any).connection.downlink,
              rtt: (navigator as any).connection.rtt,
              saveData: (navigator as any).connection.saveData,
            }
          : "unknown",
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth,
      },
      webRTC: {
        RTCPeerConnection: !!window.RTCPeerConnection,
        RTCDataChannel: !!window.RTCDataChannel,
        RTCSessionDescription: !!window.RTCSessionDescription,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!(
          navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ),
      },
      environment: {
        protocol: window.location.protocol,
        host: window.location.host,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        isLoopbackConnection: isLoopback,
        connectionInfo: {
          isLoopback,
          host,
          optimizedForLoopback,
        },
        runtimeConfig: runtimeEnv,
      },
      timestamp: new Date().toISOString(),
    };

    logMessage("System diagnostic information collected", "debug", diag);
    return diag;
  }, [logMessage, runtimeConfig, optimizedForLoopback]);

  // Log if we're likely in a loopback connection on mount
  useEffect(() => {
    const isLoopback = isLikelyLoopbackConnection();
    if (isLoopback) {
      logMessage(
        "Detected potential loopback connection (localhost/127.0.0.1)",
        "warn",
        {
          hostname: window.location.hostname,
          host: window.location.host,
          href: window.location.href,
        }
      );

      // Set initial loopback status
      setConnectionState((prev) => ({
        ...prev,
        isLoopback: true,
      }));
    }
  }, [logMessage]);

  const fetchStreamDetails = useCallback(async () => {
    if (!streamId || isConfigLoading) return;

    try {
      // Get token explicitly from both sources
      const authToken = token ?? (getCookie("token") as string | undefined);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
        logMessage("Using auth token for stream details fetch", "debug");
      } else {
        logMessage("No auth token found for stream details fetch", "warn");
      }

      // Construct the correct API URL - ensure no duplication of /api/
      const apiEndpoint = `/api/live-streams/${streamId}`;

      logMessage("Making stream details API request", "debug", {
        url: apiEndpoint,
        headers: Object.keys(headers),
      });

      const response = await fetch(apiEndpoint, {
        headers,
        next: { revalidate: 10 },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError("Stream not found.");
          logMessage(`Fetch failed: Stream not found (404)`, "error", {
            status: response.status,
            streamId,
          });
          toast.error("Stream not found.");
          setStreamDetails(null);
          return;
        }
        throw new Error(`Failed to fetch stream details: ${response.status}`);
      }

      // Check if we're getting HTML instead of JSON (which suggests a server error)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Check if response is HTML
        const text = await response.text();
        if (text.includes("<!DOCTYPE html>") || text.includes("<html>")) {
          setError(
            "Received HTML instead of JSON. The server might be returning an error page."
          );
          logMessage("Received HTML instead of JSON response", "error", {
            previewLength: Math.min(text.length, 100),
            preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
          });
        } else {
          setError("Invalid response format from server.");
          logMessage("Invalid response format", "error", {
            previewLength: Math.min(text.length, 100),
            preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
          });
        }

        setStreamDetails(null);
        return;
      }

      // At this point we know it's a valid JSON response
      const data = await response.json();

      logMessage("Stream details fetched successfully", "info", {
        id: data.id,
        status: data.status,
        creatorId: data.creatorId,
        title: data.title,
      });

      setStreamDetails(data);

      // Check if the user is the streamer (compare user ID with creatorId)
      const currentIsStreamer = !!userId && data.creatorId === userId;
      logMessage(
        `User ${userId} ${
          currentIsStreamer ? "IS" : "IS NOT"
        } the streamer (Creator ID: ${data.creatorId})`,
        "info"
      );

      // Collect system diagnostics on successful fetch
      collectSystemDiagnostics();
    } catch (err: any) {
      console.error("Error fetching stream details:", err);

      const errorMsg = err.message || "Unknown fetch error";
      logMessage(`Fetch failed: ${errorMsg}`, "error", {
        err,
        streamId,
        stack: err.stack,
      });

      toast.error(
        "Could not load stream details. Please try refreshing the page."
      );
      setError("Failed to load stream information");
      setStreamDetails(null);
    } finally {
      setIsLoading(false);
      logMessage("Fetch stream details finished.", "debug");
    }
  }, [
    streamId,
    userId,
    token,
    getCookie,
    logMessage,
    collectSystemDiagnostics,
    isConfigLoading,
  ]);

  // Main stream view - determine if the current user is the streamer
  const isCurrentUserStreamer = userId === streamDetails?.creatorId;

  // Add this function to fetch active bids
  const fetchActiveBid = useCallback(async () => {
    if (!streamId || isConfigLoading) return;

    try {
      // Get token explicitly from both sources
      const authToken = token ?? (getCookie("token") as string | undefined);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      } else {
      }

      // Construct the correct API URL - ensure no duplication of /api/
      const apiEndpoint = `/api/live-streams/${streamId}/active-bid`;

      const response = await fetch(apiEndpoint, {
        headers,
        next: { revalidate: 10 }, // Check for new bids frequently
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch active bid: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Non-JSON response from active bid endpoint");
      }

      const data = await response.json();

      if (data && data.isActive) {
        setActiveProductBid({
          id: data.id,
          productId: data.productId,
          streamId: data.streamId,
          timeRemaining: data.timeRemaining,
          isActive: true,
        });
      } else {
        setActiveProductBid(null);
      }
    } catch (error) {}
  }, [streamId, token, getCookie, isConfigLoading]);

  // Add polling for active bids
  useEffect(() => {
    if (!isCurrentUserStreamer && streamDetails?.status === "LIVE") {
      fetchActiveBid();

      // Increased interval to 30 seconds to reduce API load
      const bidInterval = setInterval(() => {
        fetchActiveBid();
      }, 30000); // Changed from 15000 (15s) to 30000 (30s)

      return () => {
        clearInterval(bidInterval);
      };
    }
  }, [fetchActiveBid, isCurrentUserStreamer, streamDetails?.status]);

  // Handle creating a new product for bid
  const handleCreateProduct = () => {
    setShowCreateProduct(true);
  };

  // Enhanced component mount logging
  useEffect(() => {
    logMessage(
      "LiveStreamPage component mounted or user/auth state changed",
      "info",
      {
        streamId,
        userId: user?.id || "not authenticated",
        isAuthenticated: !!user,
        hasToken: !!token, // token from getAuth()
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }
    );

    // CHANGE: Always fetch stream details regardless of authentication status
    // This allows anonymous users to view streams
    fetchStreamDetails();

    // Performance mark for tracking mount/auth change
    try {
      performance.mark("livestream-page-auth-check");
    } catch (e) {
      /* Ignore */
    }

    return () => {
      logMessage("LiveStreamPage auth/mount effect cleanup", "info", {
        streamId,
        userId: user?.id || "not authenticated",
        durationSinceMark:
          performance.now() -
          (performance.getEntriesByName("livestream-page-auth-check")[0]
            ?.startTime || 0),
      });
    };
  }, [user, token, fetchStreamDetails, logMessage, streamId]); // Removed isLoading

  // Derive stream status and permissions
  const currentStreamStatus = streamDetails?.status ?? null;
  const isStreamer =
    !!userId && !!streamDetails && streamDetails.creatorId === userId;

  // CHANGE: Simplify the condition to render stream for anonymous users
  // Allow rendering if we have streamDetails and streamId, regardless of auth
  const canRenderStreamManager = !isLoading && !!streamDetails && !!streamId;

  // Create anonymous username for non-authenticated users
  const effectiveUsername = username || "Anonymous Viewer";
  // Create anonymous userId for non-authenticated users
  const effectiveUserId = userId || `anonymous-${generateRandomId()}`;

  useEffect(() => {
    // Use runtime config values if available for logging
    const runtimeEnv = runtimeConfig
      ? {
          SOCKET_URL: runtimeConfig.socketUrl,
          WS_URL: runtimeConfig.wsUrl,
          WEBRTC_SERVER: runtimeConfig.webrtcServer,
          API_URL: runtimeConfig.apiUrl,
          // Note: BACKEND_API_URL is usually same as API_URL in this setup
          BACKEND_API_URL: runtimeConfig.apiUrl,
        }
      : { status: "loading or error" };

    // Log whenever important state changes
    logMessage("[LiveStreamPage] Render check variables:", "debug", {
      isLoading,
      hasStreamDetails: !!streamDetails,
      userId,
      username,
      streamId,
      derivedStatus: currentStreamStatus,
      derivedIsStreamer: isStreamer,
      shouldRenderBase: canRenderStreamManager,
      canRenderFinal: canRenderStreamManager,
      env: runtimeEnv, // Log runtime config
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
      },
      performance: {
        memory: (performance as any).memory
          ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            }
          : "not available",
      },
    });
  }, [
    isLoading,
    streamDetails,
    userId,
    username,
    streamId,
    currentStreamStatus,
    isStreamer,
    canRenderStreamManager,
    logMessage,
    runtimeConfig,
  ]);

  const handleStartStream = async () => {
    const startTime = performance.now();
    logMessage("Streamer attempting to start the stream", "info", {
      streamId,
      isStreamer,
      currentStatus: currentStreamStatus,
    });

    // First check if this is actually a SCHEDULED stream
    if (currentStreamStatus !== "SCHEDULED") {
      logMessage(
        "Stream not in SCHEDULED state - current status: " +
          currentStreamStatus,
        "warn"
      );
      toast.error(
        `Cannot start stream. Current status: ${currentStreamStatus}`
      );
      return;
    }

    if (!streamId || !isStreamer) {
      logMessage(
        "Start stream cancelled: Invalid streamId or user is not streamer",
        "warn",
        {
          streamId,
          isStreamer,
          userId,
          creatorId: streamDetails?.creatorId,
        }
      );
      toast.error("Cannot start stream.");
      return;
    }

    setIsLoading(true);

    // If config is still loading, wait briefly
    if (isConfigLoading) {
      logMessage(
        "Runtime config loading, waiting briefly for start stream...",
        "debug"
      );
      // Wait for a short time to see if config loads
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Use config if available, or fall back to default
    const apiUrl = runtimeConfig?.apiUrl || "/api";

    if (!runtimeConfig) {
      logMessage("Using fallback API URL for start stream: " + apiUrl, "warn");
    }

    try {
      if (!token) {
        logMessage("Start stream failed: No auth token from context", "error", {
          isAuthenticated: !!user,
          hasToken: !!token,
        });

        toast.error("Authentication required. Please login and try again.");
        setIsLoading(false);
        return;
      }

      performance.mark("stream-start-api-call-begin");

      // Ensure correct API path construction
      const startEndpoint = `/api/live-streams/${streamId}/start`;

      logMessage("[LiveStreamPage] Calling start endpoint...", "debug", {
        url: startEndpoint,
        method: "POST",
        hasToken: !!token,
      });

      try {
        const response = await fetch(startEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        performance.mark("stream-start-api-call-end");
        performance.measure(
          "stream-start-api-call",
          "stream-start-api-call-begin",
          "stream-start-api-call-end"
        );

        const apiCallDuration =
          performance.getEntriesByName("stream-start-api-call")[0]?.duration ||
          0;

        logMessage(`API response status: ${response.status}`, "info");

        if (!response.ok) {
          let errorMsg = `Error starting stream: ${response.status}`;
          let errorBody = "";

          try {
            // First try to parse as JSON
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorJson = await response.json();
              errorBody =
                errorJson.error ||
                errorJson.message ||
                JSON.stringify(errorJson);
            } else {
              // Fall back to text
              errorBody = await response.text();
            }
            errorMsg += ` - ${errorBody}`;
          } catch (e) {
            /* Ignore parsing errors */
            errorBody = "Unknown error occurred";
          }

          console.error(errorMsg);
          logMessage(`Start stream failed: ${errorMsg}`, "error", {
            status: response.status,
            duration: `${apiCallDuration.toFixed(2)}ms`,
            streamId,
            responseType: response.headers.get("content-type"),
          });

          if (response.status === 401) {
            toast.error("Authentication required. Please login and try again.");
          } else {
            toast.error(
              `Failed to start stream: ${errorBody || "Unknown error"}`
            );
          }

          setIsLoading(false);
          return;
        }

        // Check the content type before trying to parse as JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          logMessage(
            "Received non-JSON response from start endpoint",
            "error",
            {
              contentType,
              status: response.status,
              preview:
                text.substring(0, 100) + (text.length > 100 ? "..." : ""),
            }
          );

          toast.error("Unexpected response format. Please try again.");
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        logMessage("Stream started successfully via API", "info", {
          ...data,
          apiDuration: `${apiCallDuration.toFixed(2)}ms`,
          totalDuration: `${(performance.now() - startTime).toFixed(2)}ms`,
        });

        toast.success("Stream started successfully!");

        // Refresh stream details to get updated status
        await fetchStreamDetails();
      } catch (fetchError: any) {
        // This is a network error with the fetch call itself
        logMessage(
          `Network error during API call: ${fetchError.message}`,
          "error",
          {
            error: fetchError,
          }
        );
        toast.error(
          `Network error: ${fetchError.message}. Please check your connection.`
        );
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Error in handleStartStream:", err);
      logMessage(`Start stream process failed: ${err.message}`, "error", {
        error: err,
        stack: err.stack,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });
      toast.error("Failed to start stream. Please try again.");
      setIsLoading(false);
    }
  };

  const handleEndStream = async () => {
    const startTime = performance.now();
    logMessage("Streamer attempting to end the stream", "info", {
      streamId,
      isStreamer,
      currentStatus: currentStreamStatus,
    });

    if (!streamId || !isStreamer) {
      logMessage(
        "End stream cancelled: Invalid streamId or user is not streamer",
        "warn",
        {
          streamId,
          isStreamer,
          userId,
          creatorId: streamDetails?.creatorId,
        }
      );
      toast.error("Cannot end stream.");
      return;
    }

    setIsLoading(true);

    try {
      if (!token) {
        logMessage("End stream failed: No auth token from context", "error", {
          isAuthenticated: !!user,
          hasToken: !!token,
        });
        toast.error("Authentication required. Please login and try again.");
        setIsLoading(false);
        return;
      }

      performance.mark("stream-end-api-call-begin");

      const endEndpoint = `/api/live-streams/${streamId}/end`;
      logMessage("[LiveStreamPage] Calling end endpoint...", "debug", {
        url: endEndpoint,
        method: "POST",
        hasToken: !!token,
      });

      const response = await fetch(endEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      performance.mark("stream-end-api-call-end");
      performance.measure(
        "stream-end-api-call",
        "stream-end-api-call-begin",
        "stream-end-api-call-end"
      );

      const apiCallDuration =
        performance.getEntriesByName("stream-end-api-call")[0]?.duration || 0;

      if (!response.ok) {
        let errorMsg = `Error ending stream: ${response.status}`;
        let errorBody = "";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json();
            errorBody =
              errorJson.error || errorJson.message || JSON.stringify(errorJson);
          } else {
            errorBody = await response.text();
          }
          errorMsg += ` - ${errorBody}`;
        } catch (e) {
          /* Ignore parsing errors */
        }

        console.error(errorMsg);
        logMessage(`End stream failed: ${errorMsg}`, "error", {
          status: response.status,
          duration: `${apiCallDuration.toFixed(2)}ms`,
          streamId,
          responseType: response.headers.get("content-type"),
        });

        toast.error(`Failed to end stream: ${errorBody || "Unknown error"}`);
        setIsLoading(false);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        logMessage("Received non-JSON response from end endpoint", "error", {
          contentType,
          status: response.status,
          preview: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        });
        toast.error("Unexpected response format. Please try again.");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      logMessage("Stream ended successfully via API", "info", {
        ...data,
        apiDuration: `${apiCallDuration.toFixed(2)}ms`,
        totalDuration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });

      toast.success("Stream ended successfully!");

      // Refresh stream details to get updated status
      await fetchStreamDetails();

      // Optionally navigate away or update UI further
    } catch (err: any) {
      console.error("Error in handleEndStream:", err);
      logMessage(`End stream process failed: ${err.message}`, "error", {
        error: err,
        stack: err.stack,
        duration: `${(performance.now() - startTime).toFixed(2)}ms`,
      });
      toast.error("Failed to end stream. Please try again.");
      setIsLoading(false);
    }
  };

  const handleBackToHome = () => {
    logMessage("User navigating back to home", "info");
    router.push("/live-streams");
  };

  // Add this handler to store the reconnection callback
  const handleReconnectRequest = useCallback((callback: () => void) => {
    reconnectWebRTCRef.current = callback;
  }, []);

  // Update the existing handleReconnect function
  const handleReconnect = () => {
    logMessage("Reconnecting to stream", "info");
    setError(null);

    // Use the callback if available, otherwise fallback to remounting
    if (reconnectWebRTCRef.current) {
      reconnectWebRTCRef.current();
      logMessage("Using WebRTC internal reconnection mechanism", "info");
    } else {
      // Force WebRTCStreamManager remount by changing its key
      setWebRtcKey(`webrtc-stream-${streamId}-${Date.now()}`);
      logMessage("Remounting WebRTC component for reconnection", "info");
    }

    fetchStreamDetails().catch((err) => {
      logMessage(
        `Error fetching stream details during reconnect: ${err.message}`,
        "error"
      );
    });
  };

  const handleLike = () => {
    if (!isLiked) {
      setLikeCount((prev) => prev + 1);
    } else {
      setLikeCount((prev) => prev - 1);
    }
    setIsLiked(!isLiked);
    logMessage(`User ${isLiked ? "unliked" : "liked"} the stream`, "info");
  };

  const handleConnectionError = (error: {
    type: string; // e.g., 'socket', 'device_load', 'transport_create', 'transport_connect'
    message: string;
    canReconnect?: boolean; // Optional: manager can suggest if reconnect is viable
    details?: any; // Optional: additional context
    isLoopback?: boolean; // Added to track if this is a loopback connection error
  }) => {
    logMessage(
      `[LiveStreamPage] WebRTC Connection Error: ${error.type} - ${error.message}`,
      "error",
      {
        errorDetails: error.details,
        canReconnect: error.canReconnect,
        isLoopback: error.isLoopback,
      }
    );

    // Special handling for loopback-specific errors
    const isLoopbackError =
      error.isLoopback ||
      connectionState.isLoopback ||
      error.message.includes("loopback") ||
      error.message.includes("localhost");

    let userFriendlyMessage = `Connection error (${error.type}): ${error.message}.`;

    // Customize message for loopback connections
    if (isLoopbackError) {
      if (error.type === "ice_connection_failure") {
        userFriendlyMessage =
          "Local connection issue: WebRTC can have problems with localhost. Try using a TURN server or a public IP.";
      } else if (error.type === "transport_connect") {
        userFriendlyMessage =
          "Connection failed on same device. This is common with localhost WebRTC. Will try to reconnect with optimized settings.";
      }
    }

    setError(userFriendlyMessage); // Update main error display
    toast.error(userFriendlyMessage, { duration: 7000 }); // Show a toast

    setConnectionState((prev) => ({
      ...prev,
      isConnected: false,
      isReconnecting: error.canReconnect ?? false, // Use suggestion from manager
      lastError: userFriendlyMessage,
      isLoopback: prev.isLoopback || isLoopbackError,
    }));

    // Auto-reconnect with different strategy for loopback errors
    if (error.canReconnect) {
      let reconnectDelay = 3000; // 3 seconds for normal reconnect

      if (isLoopbackError && !optimizedForLoopback) {
        // Force loopback optimization on next connect
        setOptimizedForLoopback(true);
        reconnectDelay = 1000; // faster reconnect for loopback

        logMessage(
          "[LiveStreamPage] Loopback error detected, reconnecting with optimized settings...",
          "warn"
        );
      } else {
        logMessage(
          "[LiveStreamPage] Attempting standard reconnect due to connection error...",
          "warn"
        );
      }

      setTimeout(() => {
        handleReconnect(); // Your existing reconnect logic
      }, reconnectDelay);
    } else {
      logMessage(
        "[LiveStreamPage] Auto-reconnect not suggested for this error.",
        "warn"
      );
      // Optionally, provide guidance to the user to manually reconnect or refresh.
    }
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

  // Add a function to handle media errors
  const handleMediaError = useCallback(
    (errorType: string, errorMessage: string, details?: any) => {
      logMessage(
        `[LiveStreamPage] Media Error: ${errorType} - ${errorMessage}`,
        "error",
        { errorDetails: details }
      );

      setMediaError(errorMessage); // Update media error state for UI
      toast.error(`Media issue (${errorType}): ${errorMessage}`, {
        duration: 7000,
      });

      if (errorType === "permission_denied") {
        // Specific guidance for permission issues
        toast.error(
          "Please ensure you have granted camera/microphone permissions in your browser settings.",
          { duration: 10000 }
        );
      } else if (errorType === "device_not_found") {
        toast.error("No camera/microphone found. Please check your devices.", {
          duration: 10000,
        });
      }

      // Update device on/off state if applicable (example)
      if (
        errorType === "camera_error" ||
        (errorType === "device_not_found" && isCameraOn)
      ) {
        // setIsCameraOn(false); // Potentially turn off camera toggle if it errors
      }
      if (
        errorType === "microphone_error" ||
        (errorType === "device_not_found" && isMicrophoneOn)
      ) {
        // setIsMicrophoneOn(false); // Potentially turn off mic toggle
      }
    },
    [logMessage, isCameraOn, isMicrophoneOn] // Add dependencies if they affect logic inside
  );

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
              <p className="text-[var(--muted-foreground)] mt-2">
                Canlı bağlantı kuruluyor...
              </p>
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

  // Add these handler functions
  const handleCameraToggle = () => {
    setIsCameraOn(!isCameraOn);
    logMessage(`User ${isCameraOn ? "disabled" : "enabled"} camera`, "info");
  };

  const handleMicrophoneToggle = () => {
    setIsMicrophoneOn(!isMicrophoneOn);
    logMessage(
      `User ${isMicrophoneOn ? "muted" : "unmuted"} microphone`,
      "info"
    );
  };

  return (
    <>
      <style jsx global>
        {verticalStreamStyles}
      </style>
      <style jsx global>
        {fixOverlapStyles}
      </style>
      <style jsx global>
        {broadcastControlStyles}
      </style>
      <div className="vertical-stream-container">
        <div className="stream-content-wrapper">
          {/* Main video container */}
          <div className="video-container">
            {canRenderStreamManager ? (
              <WebRTCStreamManager
                key={webRtcKey}
                streamId={streamId}
                userId={effectiveUserId}
                username={effectiveUsername}
                isStreamer={isCurrentUserStreamer}
                isCameraOn={isCameraOn}
                isMicrophoneOn={isMicrophoneOn}
                onParticipantCount={handleParticipantCount}
                onConnectionError={handleConnectionError}
                onMediaError={handleMediaError}
                isAnonymous={!user}
                onReconnectRequest={handleReconnectRequest}
                isLoopbackConnection={connectionState.isLoopback}
                optimizeForLoopback={optimizedForLoopback}
                onLoopbackDetected={handleLoopbackDetected}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}

            {/* Show loopback connection indicator if detected */}
            {connectionState.isLoopback && (
              <div className="absolute top-20 right-4 bg-amber-500/80 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-md z-50">
                <Cpu className="h-3 w-3 mr-1" />
                <span>Local Connection</span>
              </div>
            )}

            {/* Video overlay elements */}
            <div className="video-overlay">
              {/* Stream header */}
              <div className="stream-header">
                <div className="stream-info-wrapper">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white">
                      {streamDetails?.user?.username?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="stream-info">
                      <span className="text-white font-medium">
                        {streamDetails?.user?.username || "Unknown User"}
                      </span>
                      <span className="text-white/80 text-sm">
                        {streamDetails?.title}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={handleBackToHome} className="back-button">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>

              {/* Stream actions - only show for authenticated users */}
              {user && (
                <div className="stream-actions">
                  <button
                    onClick={handleLike}
                    className="action-button"
                    aria-label="Like stream"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        isLiked ? "fill-red-500 text-red-500" : ""
                      }`}
                    />
                  </button>
                  <button className="action-button" aria-label="Share stream">
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="action-button"
                    aria-label="Stream diagnostics"
                  >
                    <Terminal className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Product and controls - modify to show products to anonymous users */}
              <div className="product-and-controls-row">
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
                  ) : // Viewer view (authenticated or anonymous) - show product when there's an active bid
                  activeProductBid?.isActive ? (
                    <div className="relative">
                      <ProductDisplay
                        streamId={streamId}
                        className="pointer-events-auto"
                        onBidClick={() =>
                          user
                            ? setShowBiddingInterface(true)
                            : router.push("/login")
                        }
                      />
                      {activeProductBid.timeRemaining > 0 && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          {activeProductBid.timeRemaining}s
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {isCurrentUserStreamer && (
                  <StreamControls
                    streamId={streamId}
                    isStreamer={isCurrentUserStreamer}
                    streamStatus={currentStreamStatus}
                    onStartStream={handleStartStream}
                    onEndStream={handleEndStream}
                    isLoading={isLoading}
                    isCameraOn={isCameraOn}
                    isMicrophoneOn={isMicrophoneOn}
                    onCameraToggle={handleCameraToggle}
                    onMicrophoneToggle={handleMicrophoneToggle}
                  />
                )}
              </div>

              {/* Chat container - allow both authenticated and anonymous users to view */}
              <div className="chat-container">
                <StreamChat
                  streamId={streamId}
                  currentUserId={userId || "anonymous"}
                  currentUsername={username || "Anonymous Viewer"}
                  className="w-full h-full"
                />
              </div>

              {/* Show login prompt for anonymous users */}
              {!user && (
                <div className="absolute bottom-4 left-0 right-0 text-center z-50">
                  <div className="bg-black/70 mx-auto max-w-md px-4 py-2 rounded-lg text-white">
                    <p>Sign in to chat, bid, and interact with this stream</p>
                    <button
                      onClick={() => router.push("/login")}
                      className="mt-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm"
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              )}

              {/* Stream footer */}
              <div className="stream-footer">
                {isCurrentUserStreamer ? (
                  <div className="flex items-center justify-between mt-12">
                    <span className="text-white text-sm">
                      Streamer controls
                    </span>
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
                  <button
                    onClick={() => setShowDiagnostics(false)}
                    className="text-white"
                  >
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

          {/* Display a toast message for media errors but allow continuing */}
          {mediaError && isCurrentUserStreamer && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white py-2 px-4 rounded-lg text-sm max-w-xs text-center">
              <p>{mediaError}</p>
              <button
                onClick={() => setMediaError(null)}
                className="mt-2 text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
