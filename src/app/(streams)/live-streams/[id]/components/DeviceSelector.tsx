"use client";

import { useEffect, useState } from 'react';
import { Mic, Video, RefreshCw, Info, AlertTriangle } from 'lucide-react';

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
  const [showMacOSWarning, setShowMacOSWarning] = useState(false);
  const [hasVirtualCamera, setHasVirtualCamera] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);
  
  // Detect operating system
  const isMacOS = /Mac OS/.test(navigator.userAgent);
  const isWindows = /Windows/.test(navigator.userAgent);
  const isLinux = /Linux/.test(navigator.userAgent) || /X11/.test(navigator.userAgent);

  // Enumerate available media devices
  const enumerateDevices = async () => {
    try {
      setDeviceError(null);
      
      // Request permissions first to get accurate device labels
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setPermissionRequested(true);
      } catch (permissionErr) {
        console.log('Permission request issue:', permissionErr);
        
        if ((permissionErr as any)?.name === 'NotAllowedError') {
          setDeviceError('Camera/microphone access denied. Please check your browser permissions.');
        } else if ((permissionErr as any)?.name === 'NotFoundError') {
          setDeviceError('No camera or microphone found. Please connect a device and try again.');
        } else {
          console.log('Proceeding with limited device info');
        }
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Devices detected:', {
        audio: audioInputs.map(d => d.label || 'Unlabeled device'),
        video: videoInputs.map(d => d.label || 'Unlabeled device'),
        os: { isMacOS, isWindows, isLinux }
      });
      
      // Check for virtual cameras on different platforms
      const virtualCameraPatterns = [
        /virtual/i, /obs/i, /capture/i, /cam link/i, /webcamoid/i, 
        /droidcam/i, /epoccam/i, /snap/i, /v4l2loopback/i
      ];
      
      const hasVirtualCam = videoInputs.some(device => 
        virtualCameraPatterns.some(pattern => pattern.test(device.label))
      );
      setHasVirtualCamera(hasVirtualCam);
      
      // Set platform-specific warnings
      setShowMacOSWarning(isMacOS && !hasVirtualCam);
      
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // If no audio device is selected, select the first available one
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
        onDeviceChange('audio', audioInputs[0].deviceId);
      } else if (audioInputs.length === 0 && !deviceError) {
        setDeviceError('No microphone detected. Please connect a microphone to stream.');
      }
      
      // If no video device is selected, look for the best option
      if (!selectedVideoDevice && videoInputs.length > 0) {
        // First, try to find any virtual camera
        const virtualCamera = videoInputs.find(device => 
          virtualCameraPatterns.some(pattern => pattern.test(device.label))
        );
        
        // Next, try to find an external camera (usually better quality)
        const externalCamera = virtualCamera || videoInputs.find(device => 
          !device.label.toLowerCase().includes('built-in') && 
          !device.label.toLowerCase().includes('internal')
        );
        
        // Fall back to the first camera if no better option found
        const deviceToSelect = externalCamera || videoInputs[0];
        setSelectedVideoDevice(deviceToSelect.deviceId);
        onDeviceChange('video', deviceToSelect.deviceId);
      } else if (videoInputs.length === 0 && !deviceError) {
        setDeviceError('No camera detected. Please connect a camera to stream.');
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      setDeviceError('Failed to detect media devices. Please check your browser settings.');
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
      
      {/* Device Error Message */}
      {deviceError && (
        <div className="mt-2 text-xs flex items-start gap-2 p-2 bg-red-50 text-red-800 rounded-md border border-red-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{deviceError}</p>
        </div>
      )}
      
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
        
        {/* macOS Virtual Camera Notice */}
        {showMacOSWarning && (
          <div className="mt-2 text-xs flex items-start gap-2 p-2 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>For best streaming quality on macOS, we recommend installing OBS Virtual Camera. <a href="https://obsproject.com/download" target="_blank" rel="noopener noreferrer" className="underline">Download OBS</a></p>
          </div>
        )}
        
        {/* Linux Virtual Camera Notice */}
        {isLinux && !hasVirtualCamera && (
          <div className="mt-2 text-xs flex items-start gap-2 p-2 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>For Linux users, we recommend using OBS with v4l2loopback for virtual camera. <a href="https://obsproject.com/wiki/install-instructions#linux" target="_blank" rel="noopener noreferrer" className="underline">Learn more</a></p>
          </div>
        )}
        
        {/* Windows Virtual Camera Notice */}
        {isWindows && !hasVirtualCamera && (
          <div className="mt-2 text-xs flex items-start gap-2 p-2 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>For best streaming quality, we recommend using OBS Virtual Camera on Windows. <a href="https://obsproject.com/download" target="_blank" rel="noopener noreferrer" className="underline">Download OBS</a></p>
          </div>
        )}
        
        {/* Virtual Camera Found Notice */}
        {hasVirtualCamera && (
          <div className="mt-2 text-xs flex items-start gap-2 p-2 bg-green-50 text-green-800 rounded-md border border-green-200">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>Virtual camera detected! This is great for broadcasting with professional effects.</p>
          </div>
        )}
        
        {/* Permissions Warning */}
        {!permissionRequested && (
          <div className="mt-2 text-xs flex items-start gap-2 p-2 bg-blue-50 text-blue-800 rounded-md border border-blue-200">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>You need to allow camera and microphone access to stream. Click "Refresh Devices" to request permissions.</p>
          </div>
        )}
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