"use client";

import React, { useEffect, useState, useRef } from "react";
import { Check, RefreshCw, VideoIcon, Mic, Volume2, Settings, AlertTriangle } from "lucide-react";
import { isLikelyLoopbackConnection } from "../utils/loopbackUtils";
import { toast } from "sonner";

interface DeviceSelectorProps {
  devices: {
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
  };
  selectedDevices: {
    videoId: string | null;
    audioId: string | null;
  };
  onDeviceChange: (type: "video" | "audio", deviceId: string) => void;
  isLoading: boolean;
  onRefreshDevices?: () => void;
  error?: string | null;
}

export function DeviceSelector({
  devices,
  selectedDevices,
  onDeviceChange,
  isLoading,
  onRefreshDevices,
  error
}: DeviceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showLoopbackWarning, setShowLoopbackWarning] = useState(false);

  // Check for loopback connection on mount
  useEffect(() => {
    const isLoopback = isLikelyLoopbackConnection();
    setShowLoopbackWarning(isLoopback);
  }, []);

  // Handle device selection
  const handleVideoDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const deviceId = event.target.value;
    if (deviceId) {
      onDeviceChange("video", deviceId);
    }
  };

  const handleAudioDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const deviceId = event.target.value;
    if (deviceId) {
      onDeviceChange("audio", deviceId);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (onRefreshDevices) {
      onRefreshDevices();
      toast.info("Refreshing available devices...");
    }
  };

  // Button to toggle selector visibility
  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
        title="Media Settings"
        aria-label="Open media settings"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-background border border-border rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-top-5 duration-200">
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold flex items-center">
                <Settings className="w-4 h-4 mr-1" />
                Media Settings
              </h3>
              <button
                type="button"
                onClick={handleRefresh}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Refresh devices"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Loopback warning */}
            {showLoopbackWarning && (
              <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-sm">
                <p className="text-xs flex items-start">
                  <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 text-amber-500" />
                  <span>
                    Local connection detected. Camera access may be limited.
                  </span>
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-sm">
                <p className="text-xs flex items-start">
                  <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 text-destructive" />
                  <span>{error}</span>
                </p>
              </div>
            )}

            {/* Permission denied message */}
            {permissionDenied && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-sm">
                <p className="text-xs flex items-start">
                  <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 text-destructive" />
                  <span>
                    Camera/microphone access denied. Please check browser permissions.
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-3">
              {/* Camera selection */}
              <div>
                <label
                  htmlFor="camera-select"
                  className="block text-xs font-medium mb-1"
                >
                  Camera
                </label>
                <select
                  id="camera-select"
                  value={selectedDevices.videoId || ""}
                  onChange={handleVideoDeviceChange}
                  className="w-full text-xs py-1.5 px-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isLoading}
                >
                  {devices.video.length === 0 ? (
                    <option value="">No cameras found</option>
                  ) : (
                    <>
                      <option value="">Select camera...</option>
                      {devices.video.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Microphone selection */}
              <div>
                <label
                  htmlFor="microphone-select"
                  className="block text-xs font-medium mb-1"
                >
                  Microphone
                </label>
                <select
                  id="microphone-select"
                  value={selectedDevices.audioId || ""}
                  onChange={handleAudioDeviceChange}
                  className="w-full text-xs py-1.5 px-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isLoading}
                >
                  {devices.audio.length === 0 ? (
                    <option value="">No microphones found</option>
                  ) : (
                    <>
                      <option value="">Select microphone...</option>
                      {devices.audio.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.substring(0, 5)}...`}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Device count information */}
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                {isLoading ? (
                  <span className="flex items-center">
                    <RefreshCw className="animate-spin h-3 w-3 mr-1" />
                    Detecting devices...
                  </span>
                ) : (
                  <span>
                    {devices.video.length} camera(s), {devices.audio.length} microphone(s) available
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
