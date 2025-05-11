import React, { useEffect, useState } from 'react';
import { ActivitySquare, Info, Layers, Server } from 'lucide-react';

/**
 * Simple WebRTC Diagnostics Component
 * 
 * This version doesn't depend on UI component libraries to avoid missing dependencies
 */
export default function WebRTCDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [environment, setEnvironment] = useState<any>(null);
  const [mediaStatus, setMediaStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Diagnose environment on open
  useEffect(() => {
    if (isOpen) {
      diagnoseEnvironment();
    }
  }, [isOpen]);

  const diagnoseEnvironment = async () => {
    setIsLoading(true);
    
    // Check for WebRTC support
    const hasWebRTC = !!window.RTCPeerConnection;
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    // Check if this is a loopback connection
    const isLoopback = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.');
      
    // Check browser information
    const userAgent = navigator.userAgent;
    const isFirefox = userAgent.indexOf('Firefox') !== -1;
    const isChrome = userAgent.indexOf('Chrome') !== -1 && userAgent.indexOf('Edge') === -1;
    const isSafari = userAgent.indexOf('Safari') !== -1 && userAgent.indexOf('Chrome') === -1;
    const isEdge = userAgent.indexOf('Edg') !== -1;
    
    // Check development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    setEnvironment({
      hasWebRTC,
      hasGetUserMedia,
      isLoopback,
      browser: {
        userAgent,
        isFirefox,
        isChrome,
        isSafari,
        isEdge
      },
      isDevelopment
    });
    
    // Check media permissions
    await checkMediaPermissions();
    
    setIsLoading(false);
  };
  
  const checkMediaPermissions = async () => {
    let videoPermission = 'unknown';
    let audioPermission = 'unknown';
    let videoDevices: MediaDeviceInfo[] = [];
    let audioDevices: MediaDeviceInfo[] = [];
    
    try {
      // Try to get a list of media devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(d => d.kind === 'videoinput');
      audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      // Check for labels (only present if permissions granted)
      const hasVideoLabels = videoDevices.some(d => !!d.label);
      const hasAudioLabels = audioDevices.some(d => !!d.label);
      
      if (videoDevices.length > 0) {
        videoPermission = hasVideoLabels ? 'granted' : 'prompt';
      } else {
        videoPermission = 'unavailable';
      }
      
      if (audioDevices.length > 0) {
        audioPermission = hasAudioLabels ? 'granted' : 'prompt';
      } else {
        audioPermission = 'unavailable';
      }
      
      // If we don't have labels, try to access the devices
      if ((!hasVideoLabels || !hasAudioLabels) && 
          videoDevices.length > 0 && audioDevices.length > 0) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true
          });
          
          // Stop the stream
          stream.getTracks().forEach(track => track.stop());
          
          // Re-check devices to see if we now have labels
          const updatedDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = updatedDevices.filter(d => d.kind === 'videoinput');
          audioDevices = updatedDevices.filter(d => d.kind === 'audioinput');
          
          videoPermission = 'granted';
          audioPermission = 'granted';
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            videoPermission = 'denied';
            audioPermission = 'denied';
          }
        }
      }
    } catch (err) {
      console.error('Error checking media permissions:', err);
    }
    
    setMediaStatus({
      video: {
        permission: videoPermission,
        devices: videoDevices.length,
        deviceLabels: videoDevices.map(d => d.label)
      },
      audio: {
        permission: audioPermission,
        devices: audioDevices.length,
        deviceLabels: audioDevices.map(d => d.label)
      }
    });
  };
  
  const testMediaCapture = async () => {
    setIsLoading(true);
    
    try {
      // Try to capture media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Check track information
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      const videoInfo = videoTrack ? {
        label: videoTrack.label,
        settings: videoTrack.getSettings(),
        constraints: videoTrack.getConstraints()
      } : null;
      
      const audioInfo = audioTrack ? {
        label: audioTrack.label,
        settings: audioTrack.getSettings(),
        constraints: audioTrack.getConstraints()
      } : null;
      
      // Update media status
      setMediaStatus((prev: any) => ({
        ...prev,
        test: {
          success: true,
          video: videoInfo,
          audio: audioInfo
        }
      }));
      
      // Stop the stream
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      setMediaStatus((prev: any) => ({
        ...prev,
        test: {
          success: false,
          error: err.name,
          message: err.message
        }
      }));
    }
    
    setIsLoading(false);
  };
  
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        <ActivitySquare className="h-3.5 w-3.5" />
        <span>WebRTC Diagnostics</span>
      </button>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">WebRTC Diagnostics</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Environment */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-medium">Environment</h3>
            </div>
            
            {environment ? (
              <div className="grid grid-cols-2 gap-2 pl-7">
                <StatusItem 
                  label="WebRTC Support" 
                  value={environment.hasWebRTC ? "Supported" : "Not Supported"}
                  status={environment.hasWebRTC ? "success" : "error"}
                />
                <StatusItem 
                  label="getUserMedia Support" 
                  value={environment.hasGetUserMedia ? "Supported" : "Not Supported"}
                  status={environment.hasGetUserMedia ? "success" : "error"}
                />
                <StatusItem 
                  label="Loopback Connection" 
                  value={environment.isLoopback ? "Yes (Localhost)" : "No"}
                  status={environment.isLoopback ? "warning" : "default"}
                />
                <StatusItem 
                  label="Environment" 
                  value={environment.isDevelopment ? "Development" : "Production"}
                  status={environment.isDevelopment ? "warning" : "default"}
                />
                <div className="col-span-2 flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm font-medium">Browser</span>
                  <div className="flex gap-2">
                    {environment.browser.isChrome && <BrowserBadge name="Chrome" />}
                    {environment.browser.isFirefox && <BrowserBadge name="Firefox" />}
                    {environment.browser.isSafari && <BrowserBadge name="Safari" />}
                    {environment.browser.isEdge && <BrowserBadge name="Edge" />}
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : null}
          </div>
          
          {/* Media Permissions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-medium">Media Devices</h3>
              </div>
              <button 
                onClick={testMediaCapture}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Test Media Capture
              </button>
            </div>
            
            {mediaStatus ? (
              <div className="space-y-4 pl-7">
                <div className="grid grid-cols-2 gap-2">
                  <StatusItem 
                    label="Video Permission" 
                    value={mediaStatus.video.permission}
                    status={
                      mediaStatus.video.permission === 'granted' ? "success" : 
                      mediaStatus.video.permission === 'prompt' ? "warning" : 
                      mediaStatus.video.permission === 'denied' ? "error" : 
                      "default"
                    }
                  />
                  <StatusItem 
                    label="Audio Permission" 
                    value={mediaStatus.audio.permission}
                    status={
                      mediaStatus.audio.permission === 'granted' ? "success" : 
                      mediaStatus.audio.permission === 'prompt' ? "warning" : 
                      mediaStatus.audio.permission === 'denied' ? "error" : 
                      "default"
                    }
                  />
                  <StatusItem 
                    label="Video Devices" 
                    value={mediaStatus.video.devices || "None"}
                    status={mediaStatus.video.devices > 0 ? "success" : "error"}
                  />
                  <StatusItem 
                    label="Audio Devices" 
                    value={mediaStatus.audio.devices || "None"}
                    status={mediaStatus.audio.devices > 0 ? "success" : "error"}
                  />
                </div>
                
                {/* Test results */}
                {mediaStatus.test && (
                  <div className="border rounded p-3 mt-4">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Info className="h-4 w-4" />
                      Media Test Results
                    </h4>
                    
                    {mediaStatus.test.success ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-600">Successfully accessed media devices.</p>
                        
                        {mediaStatus.test.video && (
                          <div className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div><span className="font-medium">Video Device:</span> {mediaStatus.test.video.label}</div>
                            <div className="mt-1">
                              <div className="font-medium">Settings:</div>
                              <pre className="text-xs mt-1 overflow-x-auto">
                                {JSON.stringify(mediaStatus.test.video.settings, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {mediaStatus.test.audio && (
                          <div className="text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            <div><span className="font-medium">Audio Device:</span> {mediaStatus.test.audio.label}</div>
                            <div className="mt-1">
                              <div className="font-medium">Settings:</div>
                              <pre className="text-xs mt-1 overflow-x-auto">
                                {JSON.stringify(mediaStatus.test.audio.settings, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-red-600">Failed to access media devices.</p>
                        <div className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          <div><span className="font-medium">Error:</span> {mediaStatus.test.error}</div>
                          <div><span className="font-medium">Message:</span> {mediaStatus.test.message}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-20">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : null}
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-end gap-2">
          <button 
            onClick={() => diagnoseEnvironment()}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {isLoading ? 'Running Checks...' : 'Refresh Diagnostics'}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper component for status items
function StatusItem({ label, value, status }: { label: string, value: string | number, status: 'success' | 'error' | 'warning' | 'default' }) {
  const getBgColor = () => {
    switch(status) {
      case 'success': return 'bg-green-100 dark:bg-green-900/20';
      case 'error': return 'bg-red-100 dark:bg-red-900/20';
      case 'warning': return 'bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'bg-gray-50 dark:bg-gray-700';
    }
  };
  
  const getTextColor = () => {
    switch(status) {
      case 'success': return 'text-green-700 dark:text-green-400';
      case 'error': return 'text-red-700 dark:text-red-400';
      case 'warning': return 'text-yellow-700 dark:text-yellow-400';
      default: return 'text-gray-700 dark:text-gray-300';
    }
  };
  
  return (
    <div className={`flex items-center justify-between p-2 ${getBgColor()} rounded`}>
      <span className="text-sm font-medium">{label}</span>
      <span className={`px-2 py-1 rounded text-xs font-medium ${getTextColor()}`}>
        {value}
      </span>
    </div>
  );
}

// Helper component for browser badges
function BrowserBadge({ name }: { name: string }) {
  return (
    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full text-xs">
      {name}
    </span>
  );
} 