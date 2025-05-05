"use client";

import { useEffect, useState } from 'react';
import { Mic, Video, RefreshCw } from 'lucide-react';

interface DeviceSelectorProps {
  onDeviceChange: (type: 'audio' | 'video', deviceId: string) => void;
  initialAudioDeviceId?: string;
  initialVideoDeviceId?: string;
}

export default function DeviceSelector({
  onDeviceChange,
  initialAudioDeviceId,
  initialVideoDeviceId
}: DeviceSelectorProps) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(initialAudioDeviceId);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | undefined>(initialVideoDeviceId);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Enumerate available media devices
  const enumerateDevices = async () => {
    try {
      // Request permissions first to get accurate device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .catch(() => console.log('Permission denied, proceeding with limited device info'));
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // If no device is selected, select the first available one
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
        onDeviceChange('audio', audioInputs[0].deviceId);
      }
      
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
        onDeviceChange('video', videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  };

  // Initialize device list
  useEffect(() => {
    enumerateDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, []);

  // Handle audio device change
  const handleAudioDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedAudioDevice(deviceId);
    onDeviceChange('audio', deviceId);
  };

  // Handle video device change
  const handleVideoDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedVideoDevice(deviceId);
    onDeviceChange('video', deviceId);
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await enumerateDevices();
    setTimeout(() => setIsRefreshing(false), 500); // Visual feedback
  };

  return (
    <div className="p-3 space-y-4 text-sm">
      <h3 className="font-semibold text-primary">Media Settings</h3>
      
      {/* Audio device selection */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 font-medium">
          <Mic className="w-4 h-4" />
          Microphone
        </label>
        <select
          className="w-full p-2 rounded-md bg-muted/50 border border-border text-xs"
          value={selectedAudioDevice}
          onChange={handleAudioDeviceChange}
          disabled={audioDevices.length === 0}
        >
          {audioDevices.length === 0 && (
            <option value="">No microphones found</option>
          )}
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.substring(0, 5)}...`}
            </option>
          ))}
        </select>
      </div>
      
      {/* Video device selection */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 font-medium">
          <Video className="w-4 h-4" />
          Camera
        </label>
        <select
          className="w-full p-2 rounded-md bg-muted/50 border border-border text-xs"
          value={selectedVideoDevice}
          onChange={handleVideoDeviceChange}
          disabled={videoDevices.length === 0}
        >
          {videoDevices.length === 0 && (
            <option value="">No cameras found</option>
          )}
          {videoDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
            </option>
          ))}
        </select>
      </div>
      
      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        className="w-full flex items-center justify-center gap-2 p-2 bg-primary/10 hover:bg-primary/20 rounded-md text-primary transition-colors"
        disabled={isRefreshing}
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh Devices
      </button>
    </div>
  );
} 