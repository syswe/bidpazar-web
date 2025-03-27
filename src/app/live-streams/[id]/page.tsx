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
  Calendar
} from "lucide-react";
import { StreamDiagnostics } from './components/StreamDiagnostics';
import WebRTCStreamManager from './components/WebRTCStreamManager';

interface LiveStreamDetails {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  status: 'active' | 'ended' | 'scheduled';
  startTime?: string;
  updatedAt?: string;
  user?: {
    id: string;
    username: string;
  };
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
  const [streamDetails, setStreamDetails] = useState<LiveStreamDetails | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [isPremiumLayout, setIsPremiumLayout] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const debugPanelRef = useRef<HTMLDivElement>(null);
  const [showChat, setShowChat] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 100));
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    isReconnecting: false,
    lastError: null
  });
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
    const fetchStreamDetails = async () => {
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

        // Get user details from local storage or auth context
        const storedUserId = localStorage.getItem('userId') || 'guest-' + Math.random().toString(36).substring(7);
        const storedUsername = localStorage.getItem('username') || 'Guest';
        setUserId(storedUserId);
        setUsername(storedUsername);

        // Check if current user is the streamer
        setIsStreamer(data.creatorId === storedUserId);

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
              if (checkData.isStreamer !== isStreamer) {
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
        setError('Failed to load stream details');
      } finally {
        setIsLoading(false);
      }
    };

    if (streamId) {
      fetchStreamDetails();
    }
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

  // Track connection issues
  useEffect(() => {
    // Check for connection issues
    const checkConnection = () => {
      // If we're not connected after 5 seconds, show diagnostics
      if (connectionState.lastError || connectionState.isReconnecting) {
        setConnectionState({
          isConnected: false,
          isReconnecting: true,
          lastError: connectionState.lastError
        });

        // Auto-show diagnostics if we detect connection issues
        if (!showDiagnostics) {
          logMessage("Connection issues detected, showing diagnostics", "warn", {
            lastError: connectionState.lastError,
            isReconnecting: connectionState.isReconnecting
          });
          setShowDiagnostics(true);
        }
      } else {
        setConnectionState({
          isConnected: true,
          isReconnecting: false,
          lastError: null
        });
      }
    };

    // Check immediately and then periodically
    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, [connectionState.lastError, connectionState.isReconnecting, showDiagnostics]);

  const handleConnectionReset = () => {
    logMessage("User initiated connection reset", "info");

    // Force reload with cache clearing
    window.location.reload();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

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
                <WebRTCStreamManager
                  streamId={streamId}
                  userId={userId}
                  username={username}
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
    <div className="container mx-auto px-4 py-8 min-h-screen">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h2 className="text-xl font-semibold">Loading stream...</h2>
        </div>
      ) : streamDetails ? (
        <div className={`grid ${isPremiumLayout ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
          <div className={`${isPremiumLayout ? 'lg:col-span-2' : 'w-full'} space-y-4`}>
            {/* Stream header */}
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold truncate">{streamDetails.title}</h1>
              <button onClick={handleBackToHome} className="p-2 rounded-full hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stream status & info */}
            <div className="flex items-center gap-3 flex-wrap">
              {streamStatus === 'LIVE' ? (
                <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-medium inline-flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-1"></span> LIVE
                </span>
              ) : streamStatus === 'SCHEDULED' ? (
                <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm font-medium inline-flex items-center">
                  <Calendar className="w-3 h-3 mr-1" /> SCHEDULED
                </span>
              ) : (
                <span className="bg-gray-500 text-white px-2 py-1 rounded text-sm font-medium">
                  ENDED
                </span>
              )}

              <span className="text-sm font-medium inline-flex items-center gap-1">
                <Clock className="h-4 w-4" /> {elapsedTime}
              </span>

              <span className="text-sm font-medium inline-flex items-center gap-1">
                <Eye className="h-4 w-4" /> {viewerCount} watching
              </span>

              <span className="text-sm font-medium">
                Host: {streamDetails.user?.username || 'Unknown'}
              </span>

              {connectionState.isReconnecting && (
                <span className="text-sm font-medium text-red-500 inline-flex items-center gap-1 bg-red-100 px-2 py-1 rounded">
                  Connection issues detected
                  <button
                    onClick={() => setShowDiagnostics(true)}
                    className="text-xs underline"
                  >
                    Troubleshoot
                  </button>
                </span>
              )}
            </div>

            {/* Video player */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              {streamStatus === 'LIVE' ? (
                <WebRTCStreamManager
                  streamId={streamId}
                  userId={userId}
                  username={username}
                  isStreamer={isStreamer}
                />
              ) : streamStatus === 'SCHEDULED' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Calendar className="h-16 w-16 mb-4 opacity-70" />
                  <h3 className="text-2xl font-bold mb-2">Stream Scheduled</h3>
                  <p className="text-gray-300">
                    {streamDetails.startTime
                      ? `Starting ${new Date(streamDetails.startTime).toLocaleString()}`
                      : 'Stay tuned for the upcoming stream'}
                  </p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <PlayCircle className="h-16 w-16 mb-4 opacity-70" />
                  <h3 className="text-2xl font-bold mb-2">Stream Ended</h3>
                  <p className="text-gray-300">This live stream has concluded</p>
                </div>
              )}

              {/* Connection diagnostics modal */}
              {showDiagnostics && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                  <div className="relative w-full max-w-md">
                    <button
                      onClick={() => setShowDiagnostics(false)}
                      className="absolute top-2 right-2 text-white hover:text-gray-300"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <StreamDiagnostics streamId={streamId} onReset={handleConnectionReset} />
                  </div>
                </div>
              )}
            </div>

            {/* Interaction bar */}
            <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1 ${isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  <Heart className={`h-5 w-5 ${isLiked && 'fill-current'}`} />
                  <span>{likeCount}</span>
                </button>

                <button
                  onClick={() => setShowChat(!showChat)}
                  className="flex items-center gap-1 text-gray-600 dark:text-gray-300"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Chat</span>
                </button>

                <button className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                  <Share2 className="h-5 w-5" />
                  <span>Share</span>
                </button>
              </div>

              <div>
                {connectionState.isReconnecting && (
                  <button
                    onClick={() => setShowDiagnostics(true)}
                    className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded"
                  >
                    Fix Connection
                  </button>
                )}
              </div>
            </div>

            {/* Stream description */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <h3 className="font-semibold text-lg mb-2">About this stream</h3>
              <p className="text-gray-700 dark:text-gray-300">
                {streamDetails.description || 'No description provided for this live stream.'}
              </p>
            </div>

            {/* Product display section for this stream */}
            <ProductDisplay streamId={streamId} />
          </div>

          {/* Chat panel */}
          {(showChat || isPremiumLayout) && (
            <div className={`${!isPremiumLayout && 'mt-4 lg:mt-0'}`}>
              <StreamChat streamId={streamId} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-xl font-semibold mb-4">Stream Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The stream you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <button
            onClick={handleBackToHome}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Back to Live Streams
          </button>

          {/* Show diagnostics button when stream not found */}
          <button
            onClick={() => setShowDiagnostics(true)}
            className="mt-4 text-primary hover:underline"
          >
            Run connection diagnostics
          </button>

          {showDiagnostics && (
            <div className="mt-6 w-full max-w-md">
              <StreamDiagnostics streamId={streamId} onReset={handleConnectionReset} />
            </div>
          )}
        </div>
      )}

      {/* Debug panel */}
      {debugMode && (
        <div
          ref={debugPanelRef}
          className="fixed bottom-0 left-0 right-0 h-48 bg-black/90 text-green-400 font-mono text-xs p-2 overflow-y-auto z-50"
        >
          <div className="flex justify-between items-center mb-2 sticky top-0 bg-black">
            <h3 className="font-bold">Debug Console</h3>
            <button onClick={() => setDebugMode(false)} className="text-red-400 hover:text-red-300">
              Close
            </button>
          </div>
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.level === 'error' ? 'text-red-400' :
              log.level === 'warn' ? 'text-yellow-400' :
                log.level === 'debug' ? 'text-blue-400' : 'text-green-400'
              }`}>
              <span className="opacity-70">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
              {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}