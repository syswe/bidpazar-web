import React, { useState, useEffect, useCallback } from 'react';

interface DeviceSelectorProps {
  onDeviceChange: (deviceId: string, kind: 'videoinput' | 'audioinput') => void;
  initialVideoDeviceId?: string;
  initialAudioDeviceId?: string;
}

interface MediaDevice {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
}

export default function DeviceSelector({ 
  onDeviceChange, 
  initialVideoDeviceId, 
  initialAudioDeviceId 
}: DeviceSelectorProps) {
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string | undefined>(initialVideoDeviceId);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | undefined>(initialAudioDeviceId);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const enumerateDevices = useCallback(async () => {
    try {
      // Request permissions first to get labeled devices
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .catch(err => {
          console.warn('Permission request failed', err);
          setPermissionError('Camera/microphone permissions needed to see device names');
          // Continue enumeration even if permissions fail
        });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      setVideoDevices(videoInputs as MediaDevice[]);
      setAudioDevices(audioInputs as MediaDevice[]);
      
      // Set default selections if not already set
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
        onDeviceChange(videoInputs[0].deviceId, 'videoinput');
      }
      
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
        onDeviceChange(audioInputs[0].deviceId, 'audioinput');
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      setPermissionError('Failed to access media devices');
    }
  }, [onDeviceChange, selectedAudioDevice, selectedVideoDevice]);

  useEffect(() => {
    // Enumerate devices on component mount
    enumerateDevices();
    
    // Set up device change listener
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    
    // Clean up listener on unmount
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
    };
  }, [enumerateDevices]);

  const handleVideoDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedVideoDevice(deviceId);
    onDeviceChange(deviceId, 'videoinput');
  };

  const handleAudioDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setSelectedAudioDevice(deviceId);
    onDeviceChange(deviceId, 'audioinput');
  };

  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-md">
      <h3 className="text-sm font-semibold mb-2">Media Devices</h3>
      
      {permissionError && (
        <div className="text-yellow-600 text-xs mb-2 p-2 bg-yellow-50 rounded">
          <p>{permissionError}</p>
        </div>
      )}
      
      <div className="space-y-2">
        <div>
          <label htmlFor="video-device" className="block text-xs font-medium text-gray-700 mb-1">
            Camera
          </label>
          <select
            id="video-device"
            value={selectedVideoDevice}
            onChange={handleVideoDeviceChange}
            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={videoDevices.length === 0}
          >
            {videoDevices.length === 0 ? (
              <option value="">No cameras available</option>
            ) : (
              videoDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                </option>
              ))
            )}
          </select>
        </div>
        
        <div>
          <label htmlFor="audio-device" className="block text-xs font-medium text-gray-700 mb-1">
            Microphone
          </label>
          <select
            id="audio-device"
            value={selectedAudioDevice}
            onChange={handleAudioDeviceChange}
            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            disabled={audioDevices.length === 0}
          >
            {audioDevices.length === 0 ? (
              <option value="">No microphones available</option>
            ) : (
              audioDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
} 