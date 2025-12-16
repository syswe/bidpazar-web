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
import { analytics } from "@/components/GoogleTagManager";

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

  // Track live stream view when stream details are loaded
  useEffect(() => {
    if (streamDetails && !isStreamDetailsLoading) {
      analytics.trackLiveStreamView(
        streamDetails.id,
        streamDetails.title || 'Canlı Yayın'
      );
    }
  }, [streamDetails, isStreamDetailsLoading]);

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

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);

  // Handle share button
  const handleShare = useCallback(() => {
    console.log("User attempted to share stream");
    setShowShareModal(true);
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

        <div className="text-center space-y-4 max-w-lg mx-4">
          <div className="bg-red-900/50 border border-red-500/50 rounded-xl p-6 text-left">
            <pre className="text-red-200 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {error || streamDetailsError}
            </pre>
          </div>
          <div className="space-y-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Tekrar Dene
            </button>
            <button
              onClick={() => router.push("/live-streams")}
              className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Yayınlara Dön
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

  // Generate share URL and message
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live-streams/${streamId}`
    : '';
  const streamTitle = streamDetails?.title || 'Canlı Yayın';
  const shareMessage = `Bidpazar'da "${streamTitle}" isimli yayındayım! 🔴 Hadi sen de katıl!`;
  const fullShareText = `${shareMessage}\n${shareUrl}`;

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareText);
      toast.success("Link kopyalandı!");
      setShowShareModal(false);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Link kopyalanamadı");
    }
  };

  // Share on WhatsApp
  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullShareText)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  // Share on X (Twitter)
  const handleShareX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  // Share on Facebook
  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  // Share on Telegram
  const handleShareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`;
    window.open(url, '_blank');
    setShowShareModal(false);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Share Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-lg font-semibold">Yayını Paylaş</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Share Message Preview */}
            <div className="bg-black/50 rounded-xl p-4 mb-6 border border-white/5">
              <p className="text-white/80 text-sm leading-relaxed">{shareMessage}</p>
              <p className="text-blue-400 text-xs mt-2 truncate">{shareUrl}</p>
            </div>

            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl font-medium mb-4 flex items-center justify-center gap-2 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Linki Kopyala
            </button>

            {/* Social Media Buttons */}
            <div className="grid grid-cols-4 gap-3">
              {/* WhatsApp */}
              <button
                onClick={handleShareWhatsApp}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors group"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#25D366]">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <span className="text-xs text-white/70">WhatsApp</span>
              </button>

              {/* X (Twitter) */}
              <button
                onClick={handleShareX}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-black/30 hover:bg-black/50 transition-colors group"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-black border border-white/20">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-xs text-white/70">X</span>
              </button>

              {/* Facebook */}
              <button
                onClick={handleShareFacebook}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 transition-colors group"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2]">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <span className="text-xs text-white/70">Facebook</span>
              </button>

              {/* Telegram */}
              <button
                onClick={handleShareTelegram}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 transition-colors group"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0088cc]">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </div>
                <span className="text-xs text-white/70">Telegram</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
        onDisconnected={(reason: any) => {
          console.log("Disconnected from LiveKit room", { reason });
          // Only redirect on intentional disconnect (user leaving), not on connection errors
          if (reason && reason.toString() !== "UNKNOWN") {
            router.push("/live-streams");
          } else {
            // Connection error - don't redirect, let user handle it
            setError("Connection lost. Please try reconnecting.");
          }
        }}
        onError={(error: any) => {
          console.error("LiveKit room error:", error);
          const browserInfo = getBrowserInfo();
          const errorMessage = (error.message || error.toString()).toLowerCase();

          // Cihaz bulunamadı hatası
          if (errorMessage.includes('notfounderror') ||
            errorMessage.includes('device not found') ||
            errorMessage.includes('requested device not found')) {
            setError(
              `🎥 Kamera veya Mikrofon Bulunamadı\n\n` +
              `Bilgisayarınıza bağlı bir kamera veya mikrofon tespit edilemedi.\n\n` +
              `Çözüm:\n` +
              `• Kamera/mikrofonun bilgisayara bağlı olduğunu kontrol edin\n` +
              `• USB cihazları çıkarıp tekrar takın\n` +
              `• Başka bir uygulama kamerayı kullanıyorsa kapatın\n` +
              `• Cihaz yöneticisinden cihazların çalıştığını doğrulayın`
            );
            return;
          }

          // İzin reddedildi hatası  
          if (errorMessage.includes('notallowederror') ||
            errorMessage.includes('permission denied') ||
            errorMessage.includes('permission dismissed')) {
            setError(
              `🔒 Kamera/Mikrofon İzni Gerekli\n\n` +
              `Tarayıcınız kamera veya mikrofona erişim izni vermedi.\n\n` +
              `Çözüm:\n` +
              `• Adres çubuğundaki 🔒 veya kamera simgesine tıklayın\n` +
              `• "Kamera" ve "Mikrofon" için "İzin Ver" seçin\n` +
              `• Sayfayı yenileyin ve tekrar deneyin\n` +
              `• Chrome: Ayarlar > Gizlilik ve Güvenlik > Site Ayarları`
            );
            return;
          }

          // Cihaz kullanımda hatası
          if (errorMessage.includes('notreadableerror') ||
            errorMessage.includes('could not start video source') ||
            errorMessage.includes('device in use')) {
            setError(
              `⚠️ Kamera/Mikrofon Başka Uygulama Tarafından Kullanılıyor\n\n` +
              `Cihazlarınız başka bir program tarafından kullanılıyor olabilir.\n\n` +
              `Çözüm:\n` +
              `• Zoom, Skype, Discord gibi uygulamaları kapatın\n` +
              `• Aynı tarayıcıda açık diğer video/sesli görüşme sekmelerini kapatın\n` +
              `• Bilgisayarınızı yeniden başlatın`
            );
            return;
          }

          // Bağlantı koptu/kesildi hatası
          if (errorMessage.includes('disconnect') ||
            errorMessage.includes('connection closed') ||
            errorMessage.includes('initiated disconnect')) {
            setError(
              `🔌 Bağlantı Kesildi\n\n` +
              `Sunucu ile bağlantı koptu. Bu genellikle ağ problemlerinden kaynaklanır.\n\n` +
              `Çözüm:\n` +
              `• İnternet bağlantınızı kontrol edin\n` +
              `• Wi-Fi yerine kablolu bağlantı deneyin\n` +
              `• VPN kullanıyorsanız kapatmayı deneyin\n` +
              `• "Tekrar Dene" butonuna tıklayın`
            );
            return;
          }

          // WebSocket hatası
          if (errorMessage.includes('websocket') ||
            errorMessage.includes('ws://') ||
            errorMessage.includes('wss://')) {
            setError(
              `🌐 Sunucu Bağlantı Hatası\n\n` +
              `Yayın sunucusuna bağlanılamadı.\n\n` +
              `Çözüm:\n` +
              `• İnternet bağlantınızı kontrol edin\n` +
              `• Birkaç dakika bekleyip tekrar deneyin\n` +
              `• Güvenlik duvarı veya antivirüs yazılımını geçici olarak kapatın\n` +
              `• Farklı bir tarayıcı deneyin (Chrome veya Edge önerilir)`
            );
            return;
          }

          // ICE/WebRTC bağlantı hatası
          if (errorMessage.includes('ice') ||
            errorMessage.includes('could not establish pc connection') ||
            errorMessage.includes('peer connection')) {
            setError(
              `🔗 WebRTC Bağlantı Hatası\n\n` +
              `Video aktarımı için gerekli bağlantı kurulamadı.\n\n` +
              `Çözüm:\n` +
              `• VPN kullanıyorsanız kapatın\n` +
              `• Şirket ağındaysanız IT departmanına başvurun\n` +
              `• Kısıtlayıcı güvenlik duvarlarını kontrol edin\n` +
              `• ${browserInfo.isFirefox ? 'Chrome veya Edge tarayıcısını deneyin' : 'Sayfayı yenileyin'}`
            );
            return;
          }

          // Ses/Audio hatası
          if (errorMessage.includes('audio') ||
            errorMessage.includes('audiocontext')) {
            setError(
              `🔊 Ses Sistemi Hatası\n\n` +
              `Tarayıcınızın ses sistemi başlatılamadı.\n\n` +
              `Çözüm:\n` +
              `• Sayfaya bir kez tıklayın (ses izni için gerekli)\n` +
              `• Tarayıcınızın ses ayarlarını kontrol edin\n` +
              `• Sayfayı yenileyin ve tekrar deneyin`
            );
            return;
          }

          // Media/getUserMedia hatası
          if (errorMessage.includes('getusermedia') ||
            errorMessage.includes('media')) {
            setError(
              `📹 Medya Erişim Hatası\n\n` +
              `Kamera veya mikrofona erişilemedi.\n\n` +
              `Çözüm:\n` +
              `• Tarayıcı izinlerini kontrol edin\n` +
              `• Cihazların düzgün bağlı olduğundan emin olun\n` +
              `• Başka uygulamalar cihazları kullanıyorsa kapatın`
            );
            return;
          }

          // Genel/Bilinmeyen hata
          setError(
            `❌ Yayın Bağlantı Hatası (${browserInfo.name})\n\n` +
            `Beklenmeyen bir hata oluştu: ${error.message || 'Bilinmeyen hata'}\n\n` +
            `Çözüm:\n` +
            `• Sayfayı yenileyin\n` +
            `• İnternet bağlantınızı kontrol edin\n` +
            `• Kamera/mikrofon izinlerini kontrol edin\n` +
            `• Farklı bir tarayıcı deneyin`
          );
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
    cancelAuction,
  } = useActiveBid({
    streamId: streamDetails.id,
    token: authToken,
    isStreamer: isStreamer,
    logMessage: isStreamer ? logMessage : () => { }, // Only log for streamers
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
          cancelAuction={cancelAuction}
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
