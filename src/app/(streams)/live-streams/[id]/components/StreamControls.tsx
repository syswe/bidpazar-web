import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Camera, CameraOff, RefreshCcw, Square, Mic, MicOff, User, Share2, Play, Pause } from 'lucide-react';
import { getAuth } from "@/lib/frontend-auth";
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';

interface StreamDetails {
  id: string;
  title: string;
  status: string;
  viewerCount?: number;
  [key: string]: unknown; // Use unknown instead of any for better type safety
}

interface StreamControlsProps {
  streamId?: string;
  streamStatus: 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'ENDED' | null;
  onCameraToggle?: () => void;
  onMicrophoneToggle?: () => void;
  onSwitchCamera?: () => void;
  isCameraOn?: boolean;
  isMicrophoneOn?: boolean;
  viewerCount?: number;
  onEndStream?: () => void;
  onStartStream?: () => void;
  onPauseStream?: () => void;
  isStreamer: boolean;
  isLoading?: boolean;
}

const StreamControls = ({
  streamId,
  streamStatus,
  onCameraToggle,
  onMicrophoneToggle,
  onSwitchCamera,
  isCameraOn = true,
  isMicrophoneOn = true,
  viewerCount = 0,
  onEndStream,
  onStartStream,
  onPauseStream,
  isStreamer,
  isLoading
}: StreamControlsProps) => {
  const { user } = useAuth();
  const { token } = getAuth();
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [detailedStreamInfo, setDetailedStreamInfo] = useState<StreamDetails | null>(null);

  // Debug log
  useEffect(() => {
    console.debug('[StreamControls] Mounted with props:', {
      streamId,
      streamStatus,
      isCameraOn,
      isMicrophoneOn,
      viewerCount,
      hasToken: !!token,
      userId: user?.id,
      isStreamer
    });

    return () => {
      console.debug('[StreamControls] Component unmounting');
    };
  }, [streamId, streamStatus, isCameraOn, isMicrophoneOn, viewerCount, token, user, isStreamer]);

  // Fetch detailed stream information
  useEffect(() => {
    const fetchStreamDetails = async () => {
      if (!streamId || !token || isConfigLoading || !runtimeConfig) {
        console.debug('[StreamControls] Cannot fetch details: Missing required info or config.');
        return;
      }
      const backendApiUrl = runtimeConfig.apiUrl;

      console.debug('[StreamControls] Fetching stream details for stream:', streamId);

      try {
        const response = await axios.get(
          `${backendApiUrl}/live-streams/${streamId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        console.debug('[StreamControls] Stream details received:', response.data);
        setDetailedStreamInfo(response.data);
      } catch (error) {
        console.error('[StreamControls] Error fetching stream details:', error);
      }
    };

    fetchStreamDetails();
  }, [streamId, token, runtimeConfig, isConfigLoading]);

  const handleStartStream = async () => {
    if (onStartStream) {
      onStartStream();
      return;
    }

    if (isConfigLoading || !runtimeConfig) {
      toast.error("Configuration not loaded. Cannot start stream.");
      return;
    }
    const backendApiUrl = runtimeConfig.apiUrl;

    try {
      setIsProcessing(true);
      console.debug("[StreamControls] Starting stream:", {
        streamId,
        endpoint: `${backendApiUrl}/live-streams/${streamId}/start`,
        hasToken: !!token
      });

      const response = await axios.post(
        `${backendApiUrl}/live-streams/${streamId}/start`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.debug("[StreamControls] Stream start response:", response.data);
      toast.success('Stream started successfully');
      // Reload the page to refresh the stream status
      window.location.reload();
    } catch (error: unknown) {
      console.error('[StreamControls] Error starting stream:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to start stream';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePauseStream = async () => {
    if (onPauseStream) {
      onPauseStream();
      return;
    }

    if (isConfigLoading || !runtimeConfig) {
      toast.error("Configuration not loaded. Cannot pause stream.");
      return;
    }
    const backendApiUrl = runtimeConfig.apiUrl;

    try {
      setIsPausing(true);
      console.debug("[StreamControls] Pausing stream:", {
        streamId,
        endpoint: `${backendApiUrl}/live-streams/${streamId}/pause`,
        hasToken: !!token
      });

      const response = await axios.post(
        `${backendApiUrl}/live-streams/${streamId}/pause`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.debug("[StreamControls] Stream pause response:", response.data);
      toast.success('Stream paused successfully');
      
      // Refresh the stream status without full page reload
      setDetailedStreamInfo(prev => prev ? {...prev, status: 'PAUSED'} : null);
    } catch (error: unknown) {
      console.error('[StreamControls] Error pausing stream:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to pause stream';
      toast.error(errorMessage);
    } finally {
      setIsPausing(false);
    }
  };

  const handleEndStream = async () => {
    if (onEndStream) {
      onEndStream();
      return;
    }

    if (isConfigLoading || !runtimeConfig) {
      toast.error("Configuration not loaded. Cannot end stream.");
      return;
    }
    const backendApiUrl = runtimeConfig.apiUrl;

    try {
      setIsProcessing(true);
      console.debug("[StreamControls] Ending stream:", {
        streamId,
        endpoint: `${backendApiUrl}/live-streams/${streamId}/end`,
        hasToken: !!token
      });

      const response = await axios.post(
        `${backendApiUrl}/live-streams/${streamId}/end`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.debug("[StreamControls] Stream end response:", response.data);
      toast.success('Stream ended successfully');

      // Reload the page to refresh the stream status
      window.location.reload();
    } catch (error: unknown) {
      console.error('[StreamControls] Error ending stream:', error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage = axiosError.response?.data?.message || 'Failed to end stream';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareStream = () => {
    console.debug("[StreamControls] Sharing stream link");

    try {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: `Live Stream - ${detailedStreamInfo?.title || 'Join Now'}`,
          text: 'Check out this live stream!',
          url: url,
        });
      } else {
        navigator.clipboard.writeText(url);
        toast.success('Stream link copied to clipboard');
      }
    } catch (error) {
      console.error('[StreamControls] Error sharing stream:', error);
      toast.error('Failed to share stream link');
    }
  };

  // Only show the broadcast controls if the user is a streamer
  if (!isStreamer) {
    return null;
  }

  return (
    <div className="broadcast-controls-container relative z-30">
      <div className="text-white text-xs font-medium mb-1 uppercase tracking-wider text-center">
        Yayın Kontrolleri
      </div>
      
      {/* Main stream control buttons */}
      {streamStatus === 'SCHEDULED' && (
        <div className="flex flex-col items-center">
          <Button
            onClick={handleStartStream}
            disabled={isProcessing || isLoading}
            className="broadcast-button broadcast-button-start text-white flex items-center justify-center rounded-full h-10 w-10 shadow-lg"
          >
            {isProcessing || isLoading ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
          <span className="text-white text-xs mt-1">YAYINI BAŞLAT</span>
        </div>
      )}

      {streamStatus === 'LIVE' && (
        <div className="flex gap-4 justify-center">
          {/* Pause Stream Button */}
          <div className="flex flex-col items-center">
            <Button
              onClick={handlePauseStream}
              disabled={isPausing || isLoading}
              className="broadcast-button broadcast-button-pause text-white flex items-center justify-center rounded-full h-10 w-10 shadow-lg bg-yellow-600 hover:bg-yellow-700"
            >
              {isPausing ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
            <span className="text-white text-xs mt-1">DURAKLAT</span>
          </div>
          
          {/* End Stream Button */}
          <div className="flex flex-col items-center">
            <Button
              onClick={handleEndStream}
              disabled={isProcessing || isLoading}
              className="broadcast-button broadcast-button-end text-white flex items-center justify-center rounded-full h-10 w-10 shadow-lg bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </Button>
            <span className="text-white text-xs mt-1">SONLANDIR</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamControls; 