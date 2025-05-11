"use client";

import React, { useEffect, useState } from "react";
import { logInfo, logError } from "../utils/logging";
import { Settings } from "lucide-react";

interface DeviceSelectorProps {
  onDeviceChange: (deviceType: "video" | "audio", deviceId: string) => void;
  initialVideoDeviceId?: string;
  initialAudioDeviceId?: string;
}

export function DeviceSelector({
  onDeviceChange,
  initialVideoDeviceId,
  initialAudioDeviceId,
}: DeviceSelectorProps) {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>(
    initialVideoDeviceId || ""
  );
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>(
    initialAudioDeviceId || ""
  );
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Load available devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permissions first to ensure we get labeled devices
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          
          // Stop tracks immediately after getting permissions
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr) {
          logError("Permission to access media devices denied", { error: permErr instanceof Error ? permErr.message : "Unknown error" });
          setPermissionDenied(true);
        }

        // Now enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const videoInputs = devices.filter(
          (device) => device.kind === "videoinput"
        );
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );

        setVideoDevices(videoInputs);
        setAudioDevices(audioInputs);

        // Set default devices if not already set
        if (!selectedVideoDevice && videoInputs.length > 0) {
          const defaultVideoDevice = videoInputs[0].deviceId;
          setSelectedVideoDevice(defaultVideoDevice);
          onDeviceChange("video", defaultVideoDevice);
        }

        if (!selectedAudioDevice && audioInputs.length > 0) {
          const defaultAudioDevice = audioInputs[0].deviceId;
          setSelectedAudioDevice(defaultAudioDevice);
          onDeviceChange("audio", defaultAudioDevice);
        }

        logInfo("Media devices loaded", {
          videoDevices: videoInputs.length,
          audioDevices: audioInputs.length,
        });
      } catch (err) {
        logError("Error loading media devices", { error: err instanceof Error ? err.message : "Unknown error" });
      }
    };

    // Listen for device changes
    const handleDeviceChange = () => {
      loadDevices();
    };

    loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [onDeviceChange, selectedVideoDevice, selectedAudioDevice]);

  // Handle device selection
  const handleVideoDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const deviceId = event.target.value;
    setSelectedVideoDevice(deviceId);
    onDeviceChange("video", deviceId);
  };

  const handleAudioDeviceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const deviceId = event.target.value;
    setSelectedAudioDevice(deviceId);
    onDeviceChange("audio", deviceId);
  };

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
            value={selectedVideoDevice}
            onChange={handleVideoDeviceChange}
            className="w-full text-xs py-1 px-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {videoDevices.length === 0 ? (
              <option value="">No cameras found</option>
            ) : (
              videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
                </option>
              ))
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
            value={selectedAudioDevice}
            onChange={handleAudioDeviceChange}
            className="w-full text-xs py-1 px-2 rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {audioDevices.length === 0 ? (
              <option value="">No microphones found</option>
            ) : (
              audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.substring(0, 5)}...`}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
} 