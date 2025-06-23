// src/app/(streams)/live-streams/[id]/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getToken, getUser, isAuthenticated } from "@/lib/frontend-auth";
import { toast } from "sonner";
import io from "socket.io-client";

import { Loader2, MessageCircle, Settings, X } from "lucide-react";
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  ControlBar,
  useLocalParticipant,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  MediaDeviceMenu,
  DisconnectButton,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, Room } from "livekit-client";

// Import components
import StreamChat from "./components/StreamChat";
import StreamHeader from "./components/StreamHeader";
import StreamActions from "./components/StreamActions";
import ProductSection from "./components/ProductSection";
import {
  StreamLoadingState,
  StreamErrorState,
  StreamNotFoundState,
} from "./components/StreamStates";

// Import custom hooks
import { useStreamDetails } from "./hooks/useStreamDetails";
import { useActiveBid } from "./hooks/useActiveBid";

// Import CSS
import "./styles/streamStyles.css";

// Import our WebRTC configuration utilities
import {
  livekitRoomOptions,
  livekitConnectOptions,
  getBrowserInfo,
  checkWebRTCSupport,
  initializeAudioContext,
} from "@/lib/webrtc-config";

// Debug component to help identify auth issues
function AuthDebugInfo() {
  const { user, isLoading, isAuthenticated: authProviderAuth } = useAuth();
  const token = getToken();
  const storedUser = getUser();
  const clientAuth = isAuthenticated();

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">Auth Debug Info</h3>
      <div className="space-y-1">
        <div>AuthProvider loading: {isLoading ? "true" : "false"}</div>
        <div>
          AuthProvider authenticated: {authProviderAuth ? "true" : "false"}
        </div>
        <div>Client authenticated: {clientAuth ? "true" : "false"}</div>
        <div>Has token: {token ? "true" : "false"}</div>
        <div>Token length: {token?.length || 0}</div>
        <div>Has user from AuthProvider: {user ? "true" : "false"}</div>
        <div>Username from AuthProvider: {user?.username || "none"}</div>
        <div>Has stored user: {storedUser ? "true" : "false"}</div>
        <div>Username from storage: {storedUser?.username || "none"}</div>
      </div>
    </div>
  );
}

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.id as string;
  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  // Local UI state
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);

  // Chat input state
  const [chatInput, setChatInput] = useState<string>("");

  // Stable logMessage function to prevent infinite re-renders
  const logMessage = useCallback(
    (msg: string, level: string = "info", data?: any) => {
      console.log(`[LiveStreamPage] ${msg}`, data);
    },
    []
  );

  // Memoize the auth token to prevent unnecessary re-renders
  const authToken = useMemo(() => getToken() || undefined, [user]);

  // Check sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      const sidebar = document.querySelector("aside");
      if (sidebar) {
        const width = window.getComputedStyle(sidebar).width;
        setIsSidebarExpanded(parseInt(width) > 70);
      }
    };

    const timer = setTimeout(checkSidebarState, 500);
    const interval = setInterval(checkSidebarState, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Initialize custom hooks with stabilized dependencies
  const {
    streamDetails,
    isLoading: isStreamDetailsLoading,
    error: streamDetailsError,
  } = useStreamDetails({
    streamId,
    token: authToken,
    logMessage,
  });

  // Handle like button
  const handleLike = useCallback(() => {
    setIsLiked((prevLiked) => {
      if (!prevLiked) {
        setLikeCount((prev) => prev + 1);
      } else {
        setLikeCount((prev) => Math.max(0, prev - 1));
      }

      console.log(`User ${!prevLiked ? "liked" : "unliked"} the stream`);
      return !prevLiked;
    });
  }, []);

  // Handle share button
  const handleShare = useCallback(() => {
    console.log("User attempted to share stream");
    toast.info("Share functionality coming soon!");
  }, []);

  // Handle navigation back to home
  const handleBackToHome = useCallback(() => {
    console.log("User navigating back to home");
    router.push("/live-streams");
  }, [router]);

  // Handle chat message send
  const handleChatSend = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      try {
        // Check if socket is available and user is authenticated
        const socket = (window as any).streamChatSocket;
        const connected = (window as any).streamChatConnected;
        const authenticated = (window as any).streamChatAuthenticated;

        if (!authenticated) {
          toast.error("You must be logged in to send messages");
          return;
        }

        if (!socket || !connected) {
          toast.error("Chat not connected. Please wait a moment.");
          return;
        }

        // Create message object
        const messageData = {
          streamId,
          userId: user?.id || "anonymous",
          username: user?.username || "Anonymous",
          message: message.trim(),
        };

        // Send message via socket.io
        socket.emit("stream-message", messageData);

        // Clear input on successful send
        setChatInput("");
        console.log("Message sent successfully:", message);
      } catch (error) {
        console.error("Error sending chat message:", error);
        toast.error("Failed to send message. Please try again.");
      }
    },
    [streamId, user]
  );

  // Fetch LiveKit token
  useEffect(() => {
    if (!streamId) {
      console.log("[LiveStreamPage] Missing streamId:", { streamId });
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const authToken = getToken();
        console.log("[LiveStreamPage] Token retrieval:", {
          hasToken: !!authToken,
          tokenLength: authToken?.length || 0,
          tokenStart: authToken ? authToken.substring(0, 20) + "..." : "none",
        });

        console.log("[LiveStreamPage] Fetching LiveKit token...");

        // Build headers - include auth token if available, but don't require it
        const headers: Record<string, string> = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        const resp = await fetch(`/api/live-streams/${streamId}/token`, {
          headers,
        });

        console.log("[LiveStreamPage] LiveKit token response:", {
          ok: resp.ok,
          status: resp.status,
          statusText: resp.statusText,
        });

        if (!resp.ok) {
          const errorData = await resp.json();
          console.error("[LiveStreamPage] LiveKit token error:", errorData);
          throw new Error(errorData.error || "Failed to fetch token");
        }

        const data = await resp.json();
        console.log("[LiveStreamPage] LiveKit token received successfully");
        setToken(data.token);
      } catch (e: any) {
        console.error("Error joining stream:", e);
        setError(e.message);
        toast.error(`Error joining stream: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [streamId]); // Only depend on streamId, not user

  // Determine if current user is the streamer based on stream ownership
  const isCurrentUserStreamer = Boolean(
    user && streamDetails && user.id === streamDetails.creatorId
  );

  // Initialize WebRTC and audio context on component mount
  useEffect(() => {
    const initializeWebRTC = async () => {
      // Check WebRTC support
      const webrtcSupport = checkWebRTCSupport();
      const browserInfo = getBrowserInfo();

      console.log("Browser info:", browserInfo);
      console.log("WebRTC support:", webrtcSupport);

      if (!webrtcSupport.supported) {
        setError(
          `WebRTC desteklenmiyor. ${browserInfo.name} tarayıcınızı güncelleyin veya farklı bir tarayıcı deneyin.`
        );
        return;
      }

      // Initialize audio context to handle autoplay restrictions
      try {
        await initializeAudioContext();
        console.log("AudioContext initialized successfully");
      } catch (error) {
        console.warn("AudioContext initialization failed:", error);
      }
    };

    initializeWebRTC();
  }, []);

  // Render appropriate states
  if (loading || isStreamDetailsLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin" />
          <p>Connecting to stream...</p>
        </div>
      </div>
    );
  }

  if (error || streamDetailsError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white relative">
        {/* Debug Info for Error State */}
        <AuthDebugInfo />

        <div className="text-center space-y-4">
          <p className="text-red-500">Error: {error || streamDetailsError}</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 transition-colors mr-2"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/live-streams")}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              Back to Streams
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!streamDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center space-y-4">
          <p>Stream not found</p>
          <button
            onClick={() => router.push("/live-streams")}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Back to Streams
          </button>
        </div>
      </div>
    );
  }

  const serverUrl =
    process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";

  return (
    <div className="relative w-full h-screen">
      {/* Debug Info */}
      {showDebug && <AuthDebugInfo />}

      <LiveKitRoom
        video={isCurrentUserStreamer} // Only enable video for streamers
        audio={isCurrentUserStreamer} // Only enable audio for streamers
        token={token}
        serverUrl={serverUrl}
        data-lk-theme="default"
        style={{ height: "100vh", background: "black" }}
        // Use our improved WebRTC configuration
        options={livekitRoomOptions}
        connectOptions={livekitConnectOptions}
        onConnected={() => {
          console.log("Connected to LiveKit room");
          setShowDebug(false); // Hide debug after successful connection
          setError(null); // Clear any previous errors
        }}
        onDisconnected={(reason) => {
          console.log("Disconnected from LiveKit room", { reason });
          // Only redirect on intentional disconnect (user leaving), not on connection errors
          if (reason && reason.toString() !== "UNKNOWN") {
            router.push("/live-streams");
          } else {
            // Connection error - don't redirect, let user handle it
            setError("Connection lost. Please try reconnecting.");
          }
        }}
        onError={(error) => {
          console.error("LiveKit room error:", error);
          const browserInfo = getBrowserInfo();

          // Handle specific WebRTC connection issues with browser-specific messages
          if (error.message?.includes("could not establish pc connection")) {
            if (browserInfo.isFirefox) {
              setError(
                "Firefox WebRTC bağlantı hatası: Tarayıcı ayarlarınızı kontrol edin veya Chrome/Edge deneyin."
              );
            } else {
              setError(
                "WebRTC bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin ve tekrar deneyin."
              );
            }
          } else if (error.message?.includes("AudioContext")) {
            setError(
              "Ses hatası: Sayfaya tıklayın ve ses iznini verin, sonra tekrar deneyin."
            );
          } else if (error.message?.includes("getUserMedia")) {
            setError(
              "Kamera/mikrofon erişim hatası: Tarayıcı izinlerini kontrol edin."
            );
          } else {
            setError(
              `Bağlantı başarısız (${browserInfo.name}): ${error.message}`
            );
          }
          // Don't redirect on error, let user choose what to do
        }}
      >
        <CustomLiveStreamUI
          streamDetails={streamDetails}
          onChatSend={handleChatSend}
          onLike={handleLike}
          onShare={handleShare}
          onBackToHome={handleBackToHome}
          likeCount={likeCount}
          isLiked={isLiked}
          logMessage={logMessage}
          isCurrentUserStreamer={isCurrentUserStreamer}
        />
        <RoomAudioRenderer volume={0.8} muted={false} />
      </LiveKitRoom>
    </div>
  );
}

interface CustomLiveStreamUIProps {
  streamDetails: any;
  onChatSend: (message: string) => void;
  onLike: () => void;
  onShare: () => void;
  onBackToHome: () => void;
  likeCount: number;
  isLiked: boolean;
  logMessage: (msg: string, level?: string, data?: any) => void;
  isCurrentUserStreamer: boolean;
}

function CustomLiveStreamUI({
  streamDetails,
  onChatSend,
  onLike,
  onShare,
  onBackToHome,
  likeCount,
  isLiked,
  logMessage,
  isCurrentUserStreamer,
}: CustomLiveStreamUIProps) {
  const { user } = useAuth();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [socket, setSocket] = useState<any>(null);

  // Determine if current user is the streamer - use the passed prop
  const isStreamer = isCurrentUserStreamer;

  // Check if user is authenticated (has valid user object)
  const isAuthenticated = !!user?.id;

  // Get video tracks for display
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  // Memoize the auth token to prevent unnecessary re-renders
  const authToken = useMemo(() => getToken() || undefined, [user]);

  // Initialize socket connection for chat
  useEffect(() => {
    if (!socket && user?.id) {
      const socketUrl = window.location.origin;
      const newSocket = io(socketUrl, {
        path: "/socket.io",
        query: {
          streamId: streamDetails.id,
          userId: user.id,
          username: user.username,
          token: authToken,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
      });

      newSocket.on("connect", () => {
        console.log("LiveStream: Socket connected for chat functionality");
        newSocket.emit("join-stream", streamDetails.id);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user?.id, streamDetails.id, authToken]);

  // Initialize active bid hook with stabilized dependencies
  const {
    activeProductBid,
    fetchActiveBid,
    startCountdown,
    pauseCountdown,
    endAuction,
  } = useActiveBid({
    streamId: streamDetails.id,
    token: authToken,
    isStreamer: isStreamer,
    logMessage: isStreamer ? logMessage : () => {}, // Only log for streamers
    socket,
  });

  // Stream status change handler
  const handleStatusChange = async (newStatus: string) => {
    if (!isStreamer || !authToken) return;

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/live-streams/${streamDetails.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        streamDetails.status = newStatus;
        logMessage(`Stream status updated to: ${newStatus}`);
      } else {
        logMessage(
          `Failed to update stream status: ${response.statusText}`,
          "error"
        );
      }
    } catch (error) {
      logMessage(`Error updating stream status: ${error}`, "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative text-white bg-black">
      {/* Header - Only show to streamers or as minimal info for viewers */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
        {isStreamer ? (
          <StreamHeader
            streamDetails={streamDetails}
            isStreamer={isStreamer}
            onBackClick={onBackToHome}
            onStatusChange={handleStatusChange}
            isUpdatingStatus={isUpdatingStatus}
          />
        ) : (
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={onBackToHome}
                className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div>
                <h1 className="text-white font-semibold text-sm">
                  {streamDetails.title}
                </h1>
                <p className="text-white/70 text-xs">
                  @{streamDetails.user?.username || "Kullanıcı"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-red-500 px-2 py-1 rounded-full text-xs font-medium">
                🔴 CANLI
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Video Area - Full screen for viewers */}
      <div className="flex-1 flex items-center justify-center">
        {tracks.length > 0 ? (
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="animate-pulse">
                <div className="w-12 h-12 bg-white/20 rounded-full mx-auto mb-3"></div>
              </div>
              <p className="text-lg opacity-70">Yayın başlatılıyor...</p>
              <p className="text-sm opacity-50">Lütfen bekleyin</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Side Actions - TikTok/Instagram style */}
      <div className="absolute right-4 bottom-32 z-10 flex flex-col space-y-4">
        <StreamActions
          onLike={onLike}
          onShare={onShare}
          likeCount={likeCount}
          isLiked={isLiked}
        />
      </div>

      {/* Bottom Content Area - Product and Chat */}
      <div className="absolute bottom-20 left-4 right-16 z-10 space-y-3">
        {/* Product Section */}
        <ProductSection
          streamId={streamDetails.id}
          isStreamer={isStreamer}
          activeProductBid={activeProductBid}
          fetchActiveBid={fetchActiveBid}
          user={user}
          socket={socket}
          startCountdown={startCountdown}
          pauseCountdown={pauseCountdown}
          endAuction={endAuction}
        />

        {/* Chat - Show for all users */}
        <div className="max-w-lg w-full">
          <StreamChat
            streamId={streamDetails.id}
            currentUserId={user?.id || "anonymous"}
            currentUsername={user?.username || "Anonymous"}
            onSendMessage={onChatSend}
            isMinimal={!isStreamer}
            className="min-h-[60px] w-full"
          />
        </div>
      </div>

      {/* Bottom Control Bar - Show appropriate controls based on user type */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex justify-center bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center space-x-4">
          {isStreamer ? (
            // Full controls for streamers
            <>
              <ControlBar
                controls={{
                  microphone: true,
                  camera: true,
                  screenShare: true,
                  chat: false,
                  leave: true,
                }}
              />
              <div className="flex items-center space-x-2">
                <MediaDeviceMenu kind="videoinput" />
                <MediaDeviceMenu kind="audioinput" />
              </div>
            </>
          ) : isAuthenticated ? (
            // Authenticated users - no leave button, can interact
            <div className="flex items-center space-x-4 text-white/70 text-sm">
              <span>👁️ Canlı izliyorsunuz</span>
            </div>
          ) : (
            // Anonymous users - minimal interface
            <div className="flex items-center space-x-4">
              <button
                onClick={onBackToHome}
                className="px-4 py-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
              >
                Çıkış
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
