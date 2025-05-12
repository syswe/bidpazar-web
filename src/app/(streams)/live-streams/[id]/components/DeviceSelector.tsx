"use client";

import React, { useEffect, useState } from "react";
import { logInfo, logError } from "./WebRTCStreamManager/utils/logging";
import { Settings } from "lucide-react";

/**
 * DeviceSelector interface - standardized for use across components
 */
export interface DeviceSelectorProps {
  devices: {
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
  };
  selectedDevices: {
    videoId: string | null;
    audioId: string | null;
  };
  onDeviceChange: (deviceType: "video" | "audio", deviceId: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * DeviceSelector - A standardized component for selecting audio/video devices
 * Used by both StreamControls and WebRTCStreamManager
 */
export function DeviceSelector({
  devices,
  selectedDevices,
  onDeviceChange,
  isLoading = false,
  error = null
}: DeviceSelectorProps) {
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Handle device selection
  const handleVideoDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const deviceId = event.target.value;
    onDeviceChange("video", deviceId);
  };

  const handleAudioDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const deviceId = event.target.value;
    onDeviceChange("audio", deviceId);
  };

  // Check for permission errors
  useEffect(() => {
    if (error && (
      error.includes("Permission denied") || 
      error.includes("permission") || 
      error.includes("NotAllowedError")
    )) {
      setPermissionDenied(true);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="p-3">
        <h3 className="text-sm font-semibold mb-2 flex items-center">
          <Settings className="w-4 h-4 mr-1" />
          Loading Devices...
        </h3>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
        <h3 className="text-sm font-semibold mb-1 flex items-center">
          <Settings className="w-4 h-4 mr-1" />
          Camera/Microphone Access Denied
        </h3>
        <p className="text-xs opacity-80">
          Please grant permission to use your camera and microphone.
        </p>
      </div>
    );
  }

  if (error && !permissionDenied) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
        <h3 className="text-sm font-semibold mb-1 flex items-center">
          <Settings className="w-4 h-4 mr-1" />
          Device Error
        </h3>
        <p className="text-xs opacity-80">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-2 flex items-center">
        <Settings className="w-4 h-4 mr-1" />
        Media Settings
      </h3>

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
            className="w-full text-xs py-1 px-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">No camera</option>
            {devices.video.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
              </option>
            ))}
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
            className="w-full text-xs py-1 px-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">No microphone</option>
            {devices.audio.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.substring(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
