"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/auth";
import ProductDisplay from "./components/ProductDisplay";
import StreamChat from "./components/StreamChat";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  Clock,
  Eye,
  PlayCircle,
  X,
  Heart,
  MessageCircle,
  Share2,
  Gift,
  DollarSign,
  Calendar
} from "lucide-react";
import { ServerBasedStreamManager } from './components/ServerBasedStreamManager';

interface StreamUser {
  id: string;
  username: string;
  name?: string | null;
}

interface StreamDetails {
  id: string;
  title: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  createdAt: string;
  updatedAt: string;
  viewerCount: number;
  userId: string;
  description?: string;
  startTime?: string | null;
  user?: StreamUser;
}

interface LogItem {
  timestamp: string;
  message: string;
  data?: unknown;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export default function LiveStreamPage() {
  const { id } = useParams();
  const router = useRouter();
  const streamId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [isStreamer, setIsStreamer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState<'SCHEDULED' | 'LIVE' | 'ENDED'>('SCHEDULED');
  const [streamDetails, setStreamDetails] = useState<StreamDetails | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [isPremiumLayout, setIsPremiumLayout] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const debugPanelRef = useRef<HTMLDivElement>(null);
  const [showChat, setShowChat] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 100));

  const { user } = useAuth();

  // Custom debug logging function
  const logMessage = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', data?: unknown) => {
    const timestamp = new Date().toISOString();
    const newLog = { timestamp, message, level, data };

    // Log to console with appropriate level
    switch (level) {
      case 'warn':
        console.warn(`[LiveStream] ${message}`, data);
        break;
      case 'error':
        console.error(`[LiveStream] ${message}`, data);
        break;
      case 'debug':
        console.debug(`[LiveStream] ${message}`, data);
        break;
      default:
        console.log(`[LiveStream] ${message}`, data);
    }

    // Add to state
    setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 200)); // Keep only last 200 logs
  };

  // Calculate elapsed time if stream is live
  useEffect(() => {
    if (streamStatus !== 'LIVE' || !streamDetails?.updatedAt) return;

    const startTime = new Date(streamDetails.updatedAt).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const diff = now - startTime;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [streamStatus, streamDetails]);

  // Log important information
  useEffect(() => {
    logMessage(`Page mounted with stream ID: ${streamId}`, 'debug', { streamId, user });

    // Add debug keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D - Toggle debug mode
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
        logMessage(`Debug mode toggled to ${!debugMode}`, 'debug');
      }

      // Ctrl+Shift+L - Toggle layout
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        setIsPremiumLayout(prev => !prev);
        logMessage(`Premium layout toggled to ${!isPremiumLayout}`, 'debug');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      logMessage('Component unmounting', 'debug');
    };
  }, [streamId, user, debugMode, isPremiumLayout]);

  // Simulate viewer count updates
  useEffect(() => {
    if (streamStatus !== 'LIVE') return;

    const interval = setInterval(() => {
      // Random fluctuation in viewer count for demo purposes
      const randomChange = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      setViewerCount(prev => Math.max(1, prev + randomChange));
    }, 5000);

    return () => clearInterval(interval);
  }, [streamStatus]);

  // Auto-scroll debug panel to bottom
  useEffect(() => {
    if (debugMode && debugPanelRef.current) {
      const panel = debugPanelRef.current;
      panel.scrollTop = panel.scrollHeight;
    }
  }, [logs, debugMode]);

  // Check if current user is the streamer and get stream details
  useEffect(() => {
    async function fetchStreamInfo() {
      if (!streamId) {
        setIsLoading(false);
        return;
      }

      try {
        logMessage(`Fetching stream details for: ${streamId}`, 'debug');

        // Get token from auth module
        const token = getAuth().token;
        logMessage(`Auth token available: ${!!token}`, 'debug');
        logMessage(`Current user: ${user?.username} (${user?.id})`, 'debug');

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

        if (!response.ok) {
          throw new Error(`Error fetching stream: ${response.status}`);
        }

        const data = await response.json();
        logMessage(`Stream details received`, 'debug', data);

        setStreamDetails(data);
        setStreamStatus(data.status);
        setViewerCount(data.viewerCount || Math.floor(Math.random() * 10) + 1);

        // Check if current user is the streamer with improved logging
        const isCurrentUserStreamer = user?.id && data.userId === user.id;
        logMessage(`Stream creator ID: ${data.userId}`, 'debug');
        logMessage(`Current user ID: ${user?.id}`, 'debug');
        logMessage(`User is streamer: ${isCurrentUserStreamer}`, 'debug');

        setIsStreamer(!!isCurrentUserStreamer);

        // Double-check with backend for streamer status if user is logged in
        if (user?.id && token) {
          try {
            const streamerCheckResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/check-streamer`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            );

            if (streamerCheckResponse.ok) {
              const checkData = await streamerCheckResponse.json();
              logMessage(`Backend streamer check result: ${checkData.isStreamer}`, 'debug');

              // Override isStreamer with the backend result if different
              if (checkData.isStreamer !== isCurrentUserStreamer) {
                logMessage(`Updating streamer status based on backend check`, 'debug');
                setIsStreamer(checkData.isStreamer);
              }
            }
          } catch (error) {
            logMessage(`Error checking streamer status with backend`, 'warn', error);
          }
        }

      } catch (error) {
        logMessage(`Error fetching stream details`, 'error', error);
        toast.error("Could not load stream details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchStreamInfo();
  }, [streamId, user]);

  // Handle leaving page
  const handleBackToHome = () => {
    logMessage('User navigating back to home', 'info');
    router.push('/live-streams');
  };

  // Handle like action
  const handleLike = () => {
    if (!isLiked) {
      setLikeCount(prev => prev + 1);
    } else {
      setLikeCount(prev => prev - 1);
    }
    setIsLiked(!isLiked);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-[var(--accent)] to-[#071739]">
        <div className="text-center px-4">
          <Loader2 className="w-16 h-16 animate-spin text-white mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-2">Yayın Yükleniyor</h2>
          <p className="text-white/80">Canlı bağlantı kuruluyor...</p>
        </div>
      </div>
    );
  }

  if (streamStatus === 'SCHEDULED' && !isStreamer) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-4xl mx-auto p-8">
          <button
            onClick={handleBackToHome}
            className="text-[var(--accent)] hover:underline flex items-center mb-8 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Yayınlara Geri Dön
          </button>

          <div className="bg-gradient-to-r from-[var(--accent)]/5 to-[#071739]/5 border border-[var(--border)] rounded-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-[var(--accent)]/10 rounded-full flex items-center justify-center mb-6">
              <PlayCircle className="w-10 h-10 text-[var(--accent)]" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-3">
              {streamDetails?.title || 'Yayın Başlığı'}
            </h1>

            <p className="text-[var(--foreground)]/60 mb-6 max-w-xl mx-auto">
              {streamDetails?.description || 'Bu yayın henüz başlamadı. Daha sonra tekrar kontrol edin.'}
            </p>

            <div className="inline-flex items-center bg-[var(--accent)]/10 px-4 py-2 rounded-full text-[var(--accent)] font-medium mb-8">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {streamDetails?.startTime
                  ? new Date(streamDetails.startTime).toLocaleString('tr-TR')
                  : 'Başlangıç zamanı belirtilmedi'}
              </span>
            </div>

            <button
              onClick={handleBackToHome}
              className="px-6 py-3 bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white rounded-lg hover:shadow-lg transition-all"
            >
              Yayınlara Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isStreamer) {
    // Streamer view - Horizontal layout with controls
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="bg-gradient-to-r from-[var(--accent)] to-[#071739] text-white py-4 px-6">
          <div className="container mx-auto">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">Yayın Kontrol Paneli</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{viewerCount} İzleyici</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{elapsedTime}</span>
                </div>
                <button
                  onClick={handleBackToHome}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-sm transition-colors"
                >
                  Yayınları Göster
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-black rounded-xl overflow-hidden aspect-video mb-4 relative">
                <ServerBasedStreamManager
                  streamId={streamId}
                  isStreamer={isStreamer}
                />

                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-white flex items-center">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                  <span className="text-sm font-medium">CANLI</span>
                </div>
              </div>

              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4">
                <h2 className="font-bold text-lg text-[var(--foreground)] mb-4">
                  <span className="border-b-2 border-[var(--accent)] pb-1">
                    Yayın Bilgileri
                  </span>
                </h2>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-[var(--foreground)]">
                    {streamDetails?.title || 'Yayın Başlığı'}
                  </h3>
                  <p className="text-[var(--foreground)]/70 mt-2">
                    {streamDetails?.description || 'Yayın açıklaması.'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[var(--foreground)]/70 text-sm border-t border-[var(--border)] pt-4">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    <span>{viewerCount} izleyici</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>Süre: {elapsedTime}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-4">
              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 h-[400px] flex flex-col">
                <h2 className="font-bold text-lg text-[var(--foreground)] mb-4">
                  <span className="border-b-2 border-[var(--accent)] pb-1">
                    Sohbet
                  </span>
                </h2>
                <div className="flex-1 overflow-hidden">
                  <StreamChat streamId={streamId} />
                </div>
              </div>

              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4">
                <h2 className="font-bold text-lg text-[var(--foreground)] mb-4">
                  <span className="border-b-2 border-[var(--accent)] pb-1">
                    Ürünler
                  </span>
                </h2>
                <div>
                  <ProductDisplay streamId={streamId} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Viewer view - Vertical layout with TikTok-style interface
  return (
    <div className="relative w-full h-full">
      {/* Add info banner about server-based streaming */}
      <div className="absolute top-14 left-0 right-0 z-30 flex justify-center">
        <div className="bg-blue-600 text-white px-3 py-1 rounded text-sm shadow-lg">
          Sunucu tabanlı yayın kullanılıyor (daha güvenilir bağlantı)
        </div>
      </div>

      {/* Stream content - always use ServerBasedStreamManager */}
      <ServerBasedStreamManager
        streamId={streamId}
        isStreamer={isStreamer}
      />

      {/* Top gradient overlay for streamer info */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none"></div>

      {/* Bottom gradient overlay for chat */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none"></div>

      {/* Streamer info at top */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBackToHome}
            className="text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center">
            <div className="flex items-center bg-black/50 text-white text-sm rounded-full px-3 py-1.5">
              <Eye className="w-4 h-4 mr-1.5" />
              <span>{viewerCount}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center">
          <div className="w-10 h-10 bg-[var(--accent)] rounded-full flex items-center justify-center text-white font-bold">
            {streamDetails?.user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="ml-3">
            <h3 className="text-white font-semibold">
              {streamDetails?.user?.username || 'Username'}
            </h3>
            <p className="text-white/80 text-sm">{streamDetails?.title}</p>
          </div>

          <button className="ml-auto bg-[var(--accent)] text-white px-4 py-1.5 rounded-full text-sm font-medium">
            Takip Et
          </button>
        </div>
      </div>

      {/* Right side buttons */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-6 z-20">
        <button
          onClick={handleLike}
          className="flex flex-col items-center"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isLiked ? 'bg-red-500' : 'bg-black/50'}`}>
            <Heart className={`w-6 h-6 ${isLiked ? 'text-white fill-current' : 'text-white'}`} />
          </div>
          <span className="text-white text-xs mt-1">{likeCount}</span>
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className="flex flex-col items-center"
        >
          <div className={`w-12 h-12 rounded-full bg-black/50 flex items-center justify-center ${showChat ? 'bg-[var(--accent)]' : 'bg-black/50'}`}>
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Sohbet</span>
        </button>

        <button className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Paylaş</span>
        </button>

        <button className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Hediye</span>
        </button>

        <button className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs mt-1">Teklif</span>
        </button>
      </div>

      {/* Bottom chat (TikTok style) */}
      {showChat && (
        <div className="absolute bottom-0 left-0 right-16 max-h-96 p-4 z-20">
          <div className="h-60 mb-2">
            <StreamChat streamId={streamId} />
          </div>
        </div>
      )}
    </div>
  );
} 