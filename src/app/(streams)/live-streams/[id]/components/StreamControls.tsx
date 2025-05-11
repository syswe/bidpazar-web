import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import {
  Camera,
  CameraOff,
  RefreshCcw,
  Square,
  Mic,
  MicOff,
  User,
  Share2,
  Play,
  Pause,
  Settings,
  X
} from "lucide-react";
import { getAuth } from "@/lib/frontend-auth";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";

interface StreamDetails {
  id: string;
  title: string;
  status: string;
  viewerCount?: number;
  [key: string]: unknown; // Use unknown instead of any for better type safety
}

interface DeviceInfo {
  video: MediaDeviceInfo[];
  audio: MediaDeviceInfo[];
}

interface SelectedDevices {
  videoId?: string;
  audioId?: string;
}

interface StreamControlsProps {
  streamId?: string;
  streamStatus: "SCHEDULED" | "LIVE" | "PAUSED" | "ENDED" | null;
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
  devices?: DeviceInfo;
  selectedDevices?: SelectedDevices;
  onDeviceSelect?: (kind: 'audio' | 'video', deviceId: string) => void;
  isDeviceSetupComplete?: boolean;
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
  isLoading,
  devices,
  selectedDevices,
  onDeviceSelect,
  isDeviceSetupComplete = false,
}: StreamControlsProps) => {
  const { user } = useAuth();
  const { token } = getAuth();
  const { config: runtimeConfig, isLoading: isConfigLoading } =
    useRuntimeConfig();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [detailedStreamInfo, setDetailedStreamInfo] =
    useState<StreamDetails | null>(null);
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  
  // Use refs to track the camera and microphone state to avoid issues during remounts
  const cameraStateRef = useRef(isCameraOn);
  const microphoneStateRef = useRef(isMicrophoneOn);
  
  // Update refs when props change
  useEffect(() => {
    cameraStateRef.current = isCameraOn;
    microphoneStateRef.current = isMicrophoneOn;
  }, [isCameraOn, isMicrophoneOn]);
  
  const [permissionStatus, setPermissionStatus] = useState<{
    camera: 'granted' | 'denied' | 'prompt' | 'unknown';
    microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  }>({
    camera: 'unknown',
    microphone: 'unknown'
  });

  // Debug log with improved debug information
  useEffect(() => {
    console.debug("[StreamControls] Mounted with props:", {
      streamId,
      streamStatus,
      isCameraOn,
      isMicrophoneOn,
      viewerCount,
      hasToken: !!token,
      userId: user?.id,
      isStreamer,
      hasDevices: !!devices,
      deviceSetupComplete: isDeviceSetupComplete,
      mediaState: {
        cameraRef: cameraStateRef.current,
        microphoneRef: microphoneStateRef.current
      }
    });

    return () => {
      console.debug("[StreamControls] Component unmounting");
    };
  }, [
    streamId,
    streamStatus,
    isCameraOn,
    isMicrophoneOn,
    viewerCount,
    token,
    user,
    isStreamer,
    devices,
    isDeviceSetupComplete,
  ]);

  // Handle camera toggle with improved state tracking
  const handleCameraToggle = useCallback(() => {
    if (onCameraToggle) {
      // Update ref before calling the toggle function
      cameraStateRef.current = !cameraStateRef.current;
      onCameraToggle();
    }
  }, [onCameraToggle]);

  // Handle microphone toggle with improved state tracking
  const handleMicrophoneToggle = useCallback(() => {
    if (onMicrophoneToggle) {
      // Update ref before calling the toggle function
      microphoneStateRef.current = !microphoneStateRef.current;
      onMicrophoneToggle();
    }
  }, [onMicrophoneToggle]);

  // Fetch detailed stream information
  useEffect(() => {
    const fetchStreamDetails = async () => {
      if (!streamId || !token || isConfigLoading || !runtimeConfig) {
        console.debug(
          "[StreamControls] Cannot fetch details: Missing required info or config."
        );
        return;
      }
      const backendApiUrl = runtimeConfig.apiUrl;

      console.debug(
        "[StreamControls] Fetching stream details for stream:",
        streamId
      );

      try {
        const response = await axios.get(
          `${backendApiUrl}/live-streams/${streamId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.debug(
          "[StreamControls] Stream details received:",
          response.data
        );
        setDetailedStreamInfo(response.data);
      } catch (error) {
        console.error("[StreamControls] Error fetching stream details:", error);
      }
    };

    fetchStreamDetails();
  }, [streamId, token, runtimeConfig, isConfigLoading]);

  // Check for permissions
  const checkPermissions = useCallback(async () => {
    if (!navigator.permissions) {
      console.warn("[StreamControls] Permissions API not available");
      return;
    }

    try {
      // Check camera permission
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      // Check microphone permission
      const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      setPermissionStatus({
        camera: cameraPermission.state as 'granted' | 'denied' | 'prompt',
        microphone: microphonePermission.state as 'granted' | 'denied' | 'prompt'
      });
      
      // Add event listeners to update when permissions change
      cameraPermission.addEventListener('change', () => {
        setPermissionStatus(prev => ({
          ...prev,
          camera: cameraPermission.state as 'granted' | 'denied' | 'prompt'
        }));
      });
      
      microphonePermission.addEventListener('change', () => {
        setPermissionStatus(prev => ({
          ...prev,
          microphone: microphonePermission.state as 'granted' | 'denied' | 'prompt'
        }));
      });
      
    } catch (error) {
      console.warn("[StreamControls] Error checking permissions:", error);
    }
  }, []);

  // Run permission check on mount
  useEffect(() => {
    if (isStreamer) {
      checkPermissions();
    }
  }, [isStreamer, checkPermissions]);

  const handleStartStream = async () => {
    console.debug(
      "[StreamControls] Start button clicked - streamStatus:",
      streamStatus
    );

    // Check if device setup is complete before starting
    if (!isDeviceSetupComplete) {
      console.debug("[StreamControls] Device setup not complete");
      toast.warning("Please set up your camera and microphone before starting the stream.");
      setIsDeviceDialogOpen(true);
      return;
    }
    
    // Check permissions explicitly
    if (permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied') {
      console.debug("[StreamControls] Permissions denied");
      toast.error(
        "Camera or microphone access is denied. Please check your browser settings and reload the page.",
        { duration: 10000 }
      );
      return;
    }

    if (onStartStream) {
      console.debug("[StreamControls] Using passed onStartStream callback");
      onStartStream();
      return;
    }

    console.debug(
      "[StreamControls] Using internal start stream implementation"
    );

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
        hasToken: !!token,
      });

      const response = await axios.post(
        `${backendApiUrl}/live-streams/${streamId}/start`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.debug("[StreamControls] Stream start response:", response.data);
      toast.success("Stream started successfully");
      // Reload the page to refresh the stream status
      window.location.reload();
    } catch (error: unknown) {
      console.error("[StreamControls] Error starting stream:", error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage =
        axiosError.response?.data?.message || "Failed to start stream";
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

    try {
      setIsPausing(true);
      console.debug("[StreamControls] Pausing stream:", {
        streamId,
        endpoint: `/api/live-streams/${streamId}/pause`,
        hasToken: !!token,
      });

      const response = await axios.post(
        `/api/live-streams/${streamId}/pause`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.debug("[StreamControls] Stream pause response:", response.data);
      toast.success("Stream paused successfully");

      // Refresh the stream status without full page reload
      setDetailedStreamInfo((prev) =>
        prev ? { ...prev, status: "PAUSED" } : null
      );
    } catch (error: unknown) {
      console.error("[StreamControls] Error pausing stream:", error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage =
        axiosError.response?.data?.message || "Failed to pause stream";
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

    try {
      setIsProcessing(true);
      console.debug("[StreamControls] Ending stream:", {
        streamId,
        endpoint: `/api/live-streams/${streamId}/end`,
        hasToken: !!token,
      });

      const response = await axios.post(
        `/api/live-streams/${streamId}/end`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.debug("[StreamControls] Stream end response:", response.data);
      toast.success("Stream ended successfully");

      // Reload the page to refresh the stream status
      window.location.reload();
    } catch (error: unknown) {
      console.error("[StreamControls] Error ending stream:", error);
      const axiosError = error as AxiosError<{ message: string }>;
      const errorMessage =
        axiosError.response?.data?.message || "Failed to end stream";
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
          title: `Live Stream - ${detailedStreamInfo?.title || "Join Now"}`,
          text: "Check out this live stream!",
          url: url,
        });
      } else {
        navigator.clipboard.writeText(url);
        toast.success("Stream link copied to clipboard");
      }
    } catch (error) {
      console.error("[StreamControls] Error sharing stream:", error);
      toast.error("Failed to share stream link");
    }
  };

  // Only show the broadcast controls if the user is a streamer
  if (!isStreamer) {
    return null;
  }

  console.debug("[StreamControls] Rendering with streamStatus:", streamStatus);

  return (
    <div className="broadcast-controls-container relative z-50">
      <div className="text-white text-xs font-medium mb-1 uppercase tracking-wider text-center">
        Yayın Kontrolleri
      </div>

      {/* Device selection controls for SCHEDULED status */}
      {streamStatus === "SCHEDULED" && (
        <div className="mb-3 flex justify-center">
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            {/* Camera toggle */}
            <Button
              onClick={handleCameraToggle}
              className={`broadcast-button text-white flex items-center justify-center rounded-full h-9 w-9 shadow-lg ${
                cameraStateRef.current ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              {cameraStateRef.current ? (
                <Camera className="h-4 w-4" />
              ) : (
                <CameraOff className="h-4 w-4" />
              )}
            </Button>

            {/* Mic toggle */}
            <Button
              onClick={handleMicrophoneToggle}
              className={`broadcast-button text-white flex items-center justify-center rounded-full h-9 w-9 shadow-lg ${
                microphoneStateRef.current ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              {microphoneStateRef.current ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>

            {/* Device settings button and dialog */}
            <Button
              onClick={() => setIsDeviceDialogOpen(true)}
              className="broadcast-button text-white flex items-center justify-center rounded-full h-9 w-9 shadow-lg bg-blue-600"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            {/* Custom Device Dialog with permission status */}
            {isDeviceDialogOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-background border border-border rounded-md shadow-lg max-w-md w-full mx-4">
                  <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-medium">Cihaz Seçimi</h3>
                    <button 
                      onClick={() => setIsDeviceDialogOpen(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="p-4">
                    {/* Permission status indicators */}
                    <div className="mb-4 p-3 rounded-md bg-gray-100 dark:bg-gray-800">
                      <h4 className="font-medium mb-2 text-sm">İzin Durumu</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center">
                          <Camera className="h-4 w-4 mr-1" />
                          <span>Kamera: </span>
                          <span className={`ml-1 ${
                            permissionStatus.camera === 'granted' ? 'text-green-500' : 
                            permissionStatus.camera === 'denied' ? 'text-red-500' : 'text-yellow-500'
                          }`}>
                            {permissionStatus.camera === 'granted' ? 'İzin Verildi' : 
                             permissionStatus.camera === 'denied' ? 'İzin Reddedildi' : 'Sorulacak'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Mic className="h-4 w-4 mr-1" />
                          <span>Mikrofon: </span>
                          <span className={`ml-1 ${
                            permissionStatus.microphone === 'granted' ? 'text-green-500' : 
                            permissionStatus.microphone === 'denied' ? 'text-red-500' : 'text-yellow-500'
                          }`}>
                            {permissionStatus.microphone === 'granted' ? 'İzin Verildi' : 
                             permissionStatus.microphone === 'denied' ? 'İzin Reddedildi' : 'Sorulacak'}
                          </span>
                        </div>
                      </div>
                      
                      {(permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied') && (
                        <div className="mt-2 text-xs text-red-500">
                          İzinler reddedildi. Lütfen tarayıcı ayarlarınızı kontrol edin ve sayfayı yenileyin.
                        </div>
                      )}
                    </div>
                    
                    {/* Device selection section */}
                    {devices && onDeviceSelect ? (
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Kamera Seçimi</label>
                          <select
                            value={selectedDevices?.videoId || ""}
                            onChange={(e) => onDeviceSelect('video', e.target.value)}
                            disabled={!cameraStateRef.current || permissionStatus.camera === 'denied'}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="">Kamera seçin</option>
                            {devices.video.map((device) => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Mikrofon Seçimi</label>
                          <select
                            value={selectedDevices?.audioId || ""}
                            onChange={(e) => onDeviceSelect('audio', e.target.value)}
                            disabled={!microphoneStateRef.current || permissionStatus.microphone === 'denied'}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="">Mikrofon seçin</option>
                            {devices.audio.map((device) => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Mic ${device.deviceId.slice(0, 5)}...`}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-500">
                          Yayını başlatmadan önce kamera ve mikrofonunuzu seçin. Cihazlarınızı seçtikten sonra yayını başlatabilirsiniz.
                        </div>
                        
                        {devices.video.length === 0 && devices.audio.length === 0 && (
                          <div className="p-3 bg-yellow-100 text-yellow-800 rounded-md text-xs mt-2">
                            Hiçbir cihaz bulunamadı. Lütfen kamera ve mikrofon izinlerini kontrol edin ve sayfayı yenileyin.
                          </div>
                        )}
                        
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => {
                              checkPermissions();
                              // Trigger permission prompt if needed
                              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                                navigator.mediaDevices.getUserMedia({ audio: true, video: true })
                                  .then(() => {
                                    checkPermissions();
                                    toast.success("Kamera ve mikrofon izinleri verildi", { duration: 3000 });
                                  })
                                  .catch((err) => {
                                    console.error("[StreamControls] Permission error:", err);
                                    toast.error("İzin hatası: " + (err.message || "Bilinmeyen hata"), { duration: 5000 });
                                    checkPermissions();
                                  });
                              }
                            }}
                            className="mr-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm"
                          >
                            İzinleri Kontrol Et
                          </button>
                          
                          <button
                            onClick={() => setIsDeviceDialogOpen(false)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                          >
                            Tamam
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-gray-500">
                          Cihaz bilgileri yüklenemedi. Lütfen tarayıcı izinlerinizi kontrol edin ve sayfayı yenileyin.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main stream control buttons */}
      {streamStatus === "SCHEDULED" && (
        <div className="flex flex-col items-center z-50">
          <Button
            onClick={(e) => {
              console.debug("[StreamControls] Start button clicked", e);
              handleStartStream();
            }}
            disabled={isProcessing || isLoading}
            className="broadcast-button broadcast-button-start text-white flex items-center justify-center rounded-full h-10 w-10 shadow-lg pointer-events-auto cursor-pointer !z-50"
            style={{ position: "relative", pointerEvents: "auto", zIndex: 999 }}
          >
            {isProcessing || isLoading ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
          <span className="text-white text-xs mt-1">YAYINI BAŞLAT</span>
          {!isDeviceSetupComplete && (
            <div className="mt-2 px-2 py-1 bg-orange-600/70 rounded-md text-white text-xs">
              Cihazlarınızı seçin ve önizlemeyi kontrol edin
            </div>
          )}
          {isDeviceSetupComplete && (
            <div className="mt-2 px-2 py-1 bg-green-600/70 rounded-md text-white text-xs">
              Cihaz kurulumu tamamlandı, yayın başlatılabilir
            </div>
          )}
        </div>
      )}

      {streamStatus === "LIVE" && (
        <div className="flex gap-4 justify-center">
          {/* Camera and Mic Toggle Buttons */}
          <div className="flex gap-2 mr-4">
            <Button
              onClick={handleCameraToggle}
              className={`broadcast-button text-white flex items-center justify-center rounded-full h-9 w-9 shadow-lg ${
                cameraStateRef.current ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              {cameraStateRef.current ? (
                <Camera className="h-4 w-4" />
              ) : (
                <CameraOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleMicrophoneToggle}
              className={`broadcast-button text-white flex items-center justify-center rounded-full h-9 w-9 shadow-lg ${
                microphoneStateRef.current ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              {microphoneStateRef.current ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Pause Stream Button */}
          <div className="flex flex-col items-center">
            <Button
              onClick={handlePauseStream}
              disabled={isPausing || isLoading}
              className="broadcast-button broadcast-button-pause text-white flex items-center justify-center rounded-full h-10 w-10 shadow-lg bg-yellow-600 hover:bg-yellow-700 pointer-events-auto"
              style={{
                position: "relative",
                pointerEvents: "auto",
                zIndex: 999,
              }}
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
              className="broadcast-button broadcast-button-end text-white flex items-center justify-center rounded-full h-10 w-10 shadow-lg bg-red-600 hover:bg-red-700 pointer-events-auto"
              style={{
                position: "relative",
                pointerEvents: "auto",
                zIndex: 999,
              }}
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
