import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Camera, CameraOff, RefreshCcw, Square, Mic, MicOff, User, Share2 } from 'lucide-react';
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
  streamId: string;
  streamStatus: 'SCHEDULED' | 'LIVE' | 'ENDED';
  onCameraToggle?: () => void;
  onMicrophoneToggle?: () => void;
  onSwitchCamera?: () => void;
  isCameraOn?: boolean;
  isMicrophoneOn?: boolean;
  viewerCount?: number;
  onEndStream?: () => void;
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
  onEndStream
}: StreamControlsProps) => {
  const { user } = useAuth();
  const { token } = getAuth();
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const [isProcessing, setIsProcessing] = useState(false);
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
      userId: user?.id
    });

    return () => {
      console.debug('[StreamControls] Component unmounting');
    };
  }, [streamId, streamStatus, isCameraOn, isMicrophoneOn, viewerCount, token, user]);

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

  const handleEndStream = async () => {
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

      // Call the onEndStream callback if provided
      if (onEndStream) {
        console.debug("[StreamControls] Calling onEndStream callback");
        onEndStream();
      }

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

  return (
    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
      {/* Main stream control buttons */}
      <div className="flex flex-col md:flex-row gap-2">
        {streamStatus === 'SCHEDULED' && (
          <Button
            onClick={handleStartStream}
            size="sm"
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center"
          >
            {isProcessing ? (
              <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            Start Stream
          </Button>
        )}

        {streamStatus === 'LIVE' && (
          <Button
            onClick={handleEndStream}
            size="sm"
            disabled={isProcessing}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center"
          >
            {isProcessing ? (
              <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            End Stream
          </Button>
        )}
      </div>

      {/* Media control buttons */}
      {streamStatus === 'LIVE' && (
        <div className="flex gap-1">
          <Button
            onClick={onCameraToggle}
            size="sm"
            variant="outline"
            className="flex items-center"
            title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCameraOn ? (
              <Camera className="h-4 w-4" />
            ) : (
              <CameraOff className="h-4 w-4" />
            )}
          </Button>

          <Button
            onClick={onMicrophoneToggle}
            size="sm"
            variant="outline"
            className="flex items-center"
            title={isMicrophoneOn ? "Mute microphone" : "Unmute microphone"}
          >
            {isMicrophoneOn ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </Button>

          <Button
            onClick={onSwitchCamera}
            size="sm"
            variant="outline"
            className="flex items-center"
            title="Switch camera"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleShareStream}
            size="sm"
            variant="outline"
            className="flex items-center"
            title="Share stream"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Stream info display */}
      {streamStatus === 'LIVE' && (
        <div className="flex items-center ml-2 text-sm">
          <div className="flex items-center bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
            <User className="h-3 w-3 mr-1" />
            <span>{viewerCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamControls; 