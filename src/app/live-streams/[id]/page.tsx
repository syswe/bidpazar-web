"use client";

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/auth";
import { toast } from "sonner";
import { env } from "@/lib/env";
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
  ChevronUp
} from "lucide-react";
import { StreamDiagnostics } from './components/StreamDiagnostics';
import WebRTCStreamManager from './components/WebRTCStreamManager';
import { getCookie } from "cookies-next";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";

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
  };
}

interface LogItem {
  timestamp: string;
  message: string;
  data?: unknown;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.id as string;
  const { user, token } = useAuth();
  const userId = user?.id;
  const username = user?.username;

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

  const logMessage = useCallback((message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', data?: unknown) => {
    const timestamp = new Date().toISOString();
    console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`, data ?? '');
    setLogs(prevLogs => [{ timestamp, message, data, level }, ...prevLogs.slice(0, 199)]);
  }, []);

  const fetchStreamDetails = useCallback(async () => {
    if (!streamId) {
      setError("Stream ID is missing.");
      setIsLoading(false);
      logMessage("Fetch cancelled: Stream ID missing", 'warn');
      return;
    }
    logMessage(`Fetching stream details for ID: ${streamId}`, 'debug');
    setIsLoading(true);
    setError(null);

    try {
      const authToken = token ?? getCookie('token') as string | undefined;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        logMessage("Using auth token for fetch", 'debug');
      } else {
        logMessage("No auth token found for fetch", 'warn');
      }

      const response = await fetch(`${env.BACKEND_API_URL}/live-streams/${streamId}`, { headers });

      if (!response.ok) {
        let errorMsg = `HTTP error ${response.status}`;
        try {
          const errorData = await response.text();
          errorMsg += `: ${errorData}`;
        } catch (e) { /* Ignore if response body can't be read */ }

        if (response.status === 404) {
          setError("Stream not found.");
          logMessage(`Fetch failed: Stream not found (404)`, 'error');
        } else {
          setError(`Failed to load stream information (${response.status}). ${errorMsg}`);
          logMessage(`Fetch failed: ${errorMsg}`, 'error');
        }
        setStreamDetails(null);
        return;
      }

      const data: LiveStreamDetails = await response.json();
      logMessage('Stream details fetched successfully', 'info', { id: data.id, status: data.status, creatorId: data.creatorId, title: data.title });
      setStreamDetails(data);

      // Check if the user is the streamer (compare user ID with creatorId)
      const currentIsStreamer = !!userId && data.creatorId === userId;
      logMessage(`User ${userId} ${currentIsStreamer ? 'IS' : 'IS NOT'} the streamer (Creator ID: ${data.creatorId})`, 'info');

    } catch (err: any) {
      console.error('Error fetching stream details:', err);
      const errorMsg = err.message || 'Unknown fetch error';
      logMessage(`Fetch failed: ${errorMsg}`, 'error', err);
      toast.error("Could not load stream details. Please try refreshing the page.");
      setError("Failed to load stream information");
      setStreamDetails(null);
    } finally {
      setIsLoading(false);
      logMessage("Fetch stream details finished.", 'debug');
    }
  }, [streamId, userId, token, getCookie, logMessage]);

  useEffect(() => {
    fetchStreamDetails();
  }, [fetchStreamDetails]);

  const currentStreamStatus = streamDetails?.status ?? null;
  // Use the creatorId field from the API response
  const isStreamer = !!userId && !!streamDetails && streamDetails.creatorId === userId;

  const shouldRenderWebRTC = !isLoading && !!streamDetails && !!userId && !!username && !!streamId;
  const canRenderWebRTC = shouldRenderWebRTC && (currentStreamStatus === 'LIVE' || (isStreamer && currentStreamStatus === 'SCHEDULED'));

  useEffect(() => {
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
    });
  }, [isLoading, streamDetails, userId, username, streamId, currentStreamStatus, isStreamer, shouldRenderWebRTC, canRenderWebRTC, logMessage]);

  const handleStartStream = async () => {
    logMessage('Streamer attempting to start the stream', 'info');
    if (!streamId || !isStreamer) {
      logMessage('Start stream cancelled: Invalid streamId or user is not streamer', 'warn', { streamId, isStreamer });
      toast.error("Cannot start stream.");
      return;
    }
    setIsLoading(true);
    try {
      if (!token) {
        logMessage("Start stream failed: No auth token from context", "error");
        throw new Error("Authentication token not found.");
      }

      logMessage('[LiveStreamPage] Calling /start endpoint...', 'debug');
      const response = await fetch(`${env.BACKEND_API_URL}/live-streams/${streamId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMsg = `Error starting stream: ${response.status}`;
         try {
            const errorText = await response.text();
            errorMsg += ` - ${errorText}`;
        } catch (e) { /* Ignore */ }
        console.error(errorMsg);
        logMessage(`Start stream failed: ${errorMsg}`, 'error');
        throw new Error(errorMsg);
      }

      const data = await response.json();
      logMessage('Stream started successfully via API', 'info', data);
      toast.success('Stream started successfully!');

      await fetchStreamDetails();

    } catch (err: any) {
      console.error('Error in handleStartStream:', err);
      logMessage(`Start stream process failed: ${err.message}`, 'error');
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

  if (!streamDetails) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-[var(--accent)] to-[#071739]">
        <div className="text-center px-4 bg-white/10 p-8 rounded-lg shadow-xl border border-[var(--border)]">
          <TriangleAlert className="w-16 h-16 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-2">Yayın Bilgisi Bulunamadı</h2>
          <p className="text-white/80 mb-6">"{streamId}" ID'li yayın yüklenemedi veya mevcut değil.</p>
          <button
            onClick={handleBackToHome}
            className="bg-[var(--accent)] text-white px-6 py-2 rounded-md hover:bg-[var(--accent)]/80 transition-colors flex items-center mx-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Yayınlara Geri Dön
          </button>
        </div>
      </div>
    );
  }

  if (currentStreamStatus === 'SCHEDULED' && !isStreamer) {
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
              {streamDetails.title || 'Yayın Başlığı'}
            </h1>

            <p className="text-[var(--foreground)]/60 mb-6 max-w-xl mx-auto">
              {streamDetails.description || 'Bu yayın henüz başlamadı. Daha sonra tekrar kontrol edin.'}
            </p>

            <div className="inline-flex items-center bg-[var(--accent)]/10 px-4 py-2 rounded-full text-[var(--accent)] font-medium mb-8">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {streamDetails.startTime
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

  if (currentStreamStatus === 'SCHEDULED' && isStreamer) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <header className="bg-[var(--background)]/80 backdrop-blur-sm border-b border-[var(--border)] sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button onClick={handleBackToHome} className="text-[var(--foreground)]/80 hover:text-[var(--foreground)] flex items-center text-sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Yayınlara Dön
            </button>
            <h1 className="text-lg font-semibold text-[var(--foreground)] truncate px-4">
              {streamDetails.title} (Planlandı)
            </h1>
            <div className="w-24 text-right">
                 {isLoading && <Loader2 className="w-5 h-5 animate-spin inline-block text-[var(--foreground)]/50" />}
            </div>
          </div>
        </header>

        <div className="flex-grow flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[var(--accent)]/5 to-[#071739]/5 border border-[var(--border)] rounded-xl p-8 md:p-12 text-center max-w-2xl w-full shadow-lg">
            <div className="w-24 h-24 mx-auto bg-[var(--accent)]/10 rounded-full flex items-center justify-center mb-8 border-2 border-[var(--accent)]/30">
              <Radio className="w-12 h-12 text-[var(--accent)]" />
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-3">
              Yayına Başlamaya Hazır Mısın?
            </h2>

            <p className="text-[var(--foreground)]/60 mb-8 max-w-lg mx-auto">
              "{streamDetails.title}" başlıklı yayınınız planlandı. Başlatmak için aşağıdaki düğmeye tıklayın. Önce kamera ve mikrofon erişimine izin vermeniz istenecektir.
            </p>

            {shouldRenderWebRTC && (
              <div className="mb-6 border border-[var(--border)] rounded-md overflow-hidden bg-black aspect-video max-w-lg mx-auto relative">
                 <WebRTCStreamManager
                    streamId={streamId}
                    userId={userId!}
                    username={username!}
                    isStreamer={isStreamer}
                 />
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={!shouldRenderWebRTC || isLoading}
              className="mt-4 bg-[var(--accent)] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto w-full max-w-xs"
            >
              {isLoading ? (
                 <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                 <Play className="w-5 h-5 mr-2" />
              )}
              {isLoading ? 'Başlatılıyor...' : 'Yayını Başlat'}
            </button>

          </div>
        </div>
      </div>
    );
  }

  if (currentStreamStatus === 'ENDED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-black/30 backdrop-blur-lg border border-gray-700 rounded-xl p-8 md:p-12 text-center shadow-2xl">
           <button
             onClick={handleBackToHome}
             className="absolute top-4 left-4 text-white/70 hover:text-white transition-colors flex items-center text-sm z-10"
           >
             <ArrowLeft className="w-4 h-4 mr-1.5" />
             Geri
           </button>
           <div className="w-20 h-20 mx-auto bg-gray-700/50 rounded-full flex items-center justify-center mb-6 border-2 border-gray-600">
             <X className="w-10 h-10 text-gray-400" />
           </div>
           <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
             {streamDetails.title || 'Yayın Başlığı'}
           </h1>
           <p className="text-white/70 mb-6 max-w-xl mx-auto">
             Bu yayın sona erdi.
           </p>
           <div className="inline-flex items-center bg-gray-700/40 px-4 py-2 rounded-full text-gray-300 font-medium mb-8 text-sm">
             <Clock className="w-4 h-4 mr-2" />
             Bitiş Zamanı: {formatDate(streamDetails.updatedAt)}
           </div>
           <button
             onClick={handleBackToHome}
             className="mt-4 bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors flex items-center mx-auto"
           >
             <ArrowLeft className="w-4 h-4 mr-2" />
             Yayınlara Geri Dön
           </button>
         </div>
      </div>
    );
  }

  // TikTok-style vertical video layout for LIVE streams
  return (
    <div className="fixed inset-0 bg-black w-screen h-screen">
      {/* Minimal header with back button */}
      <div className="absolute top-0 left-0 w-full z-30 p-4 flex items-center">
        <button 
          onClick={handleBackToHome}
          className="text-white/80 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowDiagnostics(prev => !prev)}
            className={`p-2 rounded-md transition-colors ${showDiagnostics ? 'bg-blue-500/20 text-blue-400' : 'text-white/70 hover:text-white'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Centered vertical video container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full max-w-[500px] bg-black relative flex items-center justify-center">
          {!canRenderWebRTC && (
            <div className="text-center text-white/50 p-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              Bağlantı kuruluyor veya bekleniyor...
            </div>
          )}

          {canRenderWebRTC && userId && username && (
            <WebRTCStreamManager
              streamId={streamId}
              userId={userId}
              username={username}
              isStreamer={isStreamer}
            />
          )}

          {/* Video overlay with stream info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent z-20">
            <div className="mb-2">
              <h2 className="text-white font-semibold text-lg truncate">
                {streamDetails.title || 'Başlıksız Yayın'}
              </h2>
              <p className="text-white/80 text-sm">
                {streamDetails.user?.username || 'Yayıncı'}
                {currentStreamStatus === 'LIVE' && (
                  <span className="ml-2 inline-flex items-center text-red-500 font-medium">
                    <Radio className="w-3 h-3 mr-1 animate-pulse" /> CANLI
                  </span>
                )}
              </p>
            </div>

            {/* Control buttons */}
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={handleLike}
                className="flex flex-col items-center"
              >
                {isLiked ? 
                  <Heart className="w-8 h-8 text-red-500 fill-current mb-1" /> : 
                  <Heart className="w-8 h-8 text-white mb-1" />
                }
                <span className="text-white text-xs">{likeCount}</span>
              </button>

              <button
                onClick={toggleMute}
                className="flex flex-col items-center"
              >
                {isMuted ? 
                  <VolumeX className="w-8 h-8 text-white mb-1" /> : 
                  <Volume2 className="w-8 h-8 text-white mb-1" />
                }
                <span className="text-white text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                onClick={() => {}}
                className="flex flex-col items-center"
              >
                <Share2 className="w-8 h-8 text-white mb-1" />
                <span className="text-white text-xs">Share</span>
              </button>

              {isStreamer && (
                <button
                  onClick={() => {}}
                  className="flex flex-col items-center bg-red-500/20 p-2 rounded-full"
                >
                  <span className="text-red-500 text-xs font-bold">LIVE</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {connectionState.isReconnecting && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
          <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
          <p className="text-white text-lg font-semibold">Bağlantı yeniden kuruluyor...</p>
          {connectionState.lastError && (
            <p className="text-red-400 text-sm mt-2">Son Hata: {connectionState.lastError}</p>
          )}
        </div>
      )}

      {showDiagnostics && (
        <div className="absolute bottom-4 left-4 right-4 max-h-60 bg-[var(--background)]/90 backdrop-blur-md border border-[var(--border)] rounded-lg shadow-xl z-40 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[var(--border)] flex justify-between items-center flex-shrink-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center">
              <Terminal className="w-4 h-4 mr-2" /> Tanılama Günlüğü
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleConnectionReset}
                title="Bağlantıyı Sıfırla (Sayfayı Yenile)"
                className="text-xs flex items-center bg-red-500/10 text-red-500 px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
              >
                <RotateCw className="w-3 h-3 mr-1" /> Sıfırla
              </button>
              <button onClick={() => setShowDiagnostics(false)} className="p-1 rounded-md hover:bg-[var(--muted)] text-[var(--foreground)]/60 hover:text-[var(--foreground)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-xs font-mono space-y-1">
            {logs.length === 0 ? (
              <p className="text-[var(--foreground)]/50 italic">Henüz günlük kaydı yok.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-yellow-400' :
                  log.level === 'debug' ? 'text-blue-400' :
                  'text-[var(--foreground)]/70'
                }`}>
                  <span className="text-[var(--foreground)]/40 mr-2 select-none">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span>{log.message}</span>
                  {log.data !== undefined && log.data !== null && (
                    <span className="ml-2 text-[var(--foreground)]/50 opacity-80">
                      {`( ${typeof log.data === 'string' ? log.data : JSON.stringify(log.data)} )`}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Swipe indicator */}
      <div className="absolute bottom-24 left-0 right-0 flex justify-center">
        <div className="text-white/50 flex flex-col items-center animate-pulse">
          <ChevronUp className="w-6 h-6" />
          <span className="text-xs">Swipe up for next stream</span>
        </div>
      </div>
    </div>
  );
}