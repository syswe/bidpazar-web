'use client'; // Ensure this is a client component

import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import io from 'socket.io-client';
import axios from 'axios';
// import { env } from '@/lib/env'; // Remove direct env import
import { useRuntimeConfig } from '@/context/RuntimeConfigContext'; // Import the hook
import { getToken } from '@/lib/frontend-auth';

const LiveStreamPlayer: React.FC<{ streamId: string }> = ({ streamId }) => {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig(); // Use the hook
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hlsSetupDone, setHlsSetupDone] = useState(false);

  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        // Use relative path for Next.js API route
        const response = await fetch(`/api/live-streams/${streamId}/video`); 
        if (!response.ok) { // Check if response is OK
           throw new Error(`Failed to fetch stream info: ${response.statusText}`);
        }
        const data = await response.json(); // Correctly parse JSON body
        setStreamInfo(data);
      } catch (err) {
        setError('Failed to fetch stream information');
        console.error(err);
      }
    };

    if (streamId) {
      fetchStreamInfo();
    }
  }, [streamId]);

  useEffect(() => {
    const video = videoRef.current;
    // Wait for config and streamId
    if (!video || !streamId || isConfigLoading || !runtimeConfig || !runtimeConfig.socketUrl || hlsSetupDone) {
      if (isConfigLoading) console.log('[LiveStreamPlayer] Waiting for runtime config...');
      if (!streamId) console.log('[LiveStreamPlayer] Waiting for streamId...');
      if (hlsSetupDone) console.log('[LiveStreamPlayer] HLS setup already done or in progress.');
      return;
    }
    
    const socketUrl = runtimeConfig.socketUrl; // Use runtime config
    let hls: Hls | null = null;
    let socket: ReturnType<typeof io> | null = null;

    const setupHls = async () => {
      setHlsSetupDone(true); // Mark setup as started
      try {
        // Fetch video URL from the Next.js API route (relative path)
        const response = await fetch(`/api/live-streams/${streamId}/video`); 
        if (!response.ok) {
          throw new Error(`Failed to get video URL: ${response.statusText}`);
        }
        const data = await response.json();
        const videoUrl = data.videoUrl; // Assuming the API returns { videoUrl: '...' }

        if (!videoUrl) {
           console.error('Video URL not found in response');
           setError('Stream source not available.');
           setIsLoading(false);
           return;
        }

        if (Hls.isSupported()) {
          console.log('HLS supported, setting up HLS.js');
          hls = new Hls();
          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.error('Autoplay failed:', e));
            setIsLoading(false);
          });
          hls.on(Hls.Events.ERROR, (event: any, data: any) => {
            console.error('HLS Error:', data);
            setError('Error loading video stream.');
            setIsLoading(false);
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          console.log('Native HLS supported');
          video.src = videoUrl;
          video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.error('Autoplay failed:', e));
            setIsLoading(false);
          });
          video.addEventListener('error', () => {
             setError('Error loading video stream.');
             setIsLoading(false);
          });
        } else {
           console.error('HLS is not supported');
           setError('HLS playback is not supported in this browser.');
           setIsLoading(false);
        }
      } catch (error) { // Renamed catch variable
        console.error('Error setting up HLS:', error);
        setError('Failed to initialize video stream.');
        setIsLoading(false);
      }
    };

    setupHls();

    // Socket connection for real-time updates (using runtime SOCKET_URL)
    console.log(`[LiveStreamPlayer] Connecting socket to: ${socketUrl}`);
    socket = io(socketUrl, { // Use runtime socketUrl
      auth: { token: getToken() }, // Send token for authentication
      transports: ['websocket'], // Prefer WebSocket
    });

    socket.on('connect', () => {
      console.log('[LiveStreamPlayer] Socket connected');
      socket?.emit('joinStream', streamId);
    });

    socket.on('stream-status', (status: string) => {
      if (status === 'LIVE') {
        console.log('[LiveStreamPlayer] Stream is LIVE, video playback should start/continue');
      }
    });

    socket.on('error', (socketError: string) => { // Renamed catch variable
      setError(socketError);
      console.error('[LiveStreamPlayer] Socket Error:', socketError);
    });

    return () => {
      console.log('[LiveStreamPlayer] Cleanup: Disconnecting socket and destroying HLS');
      socket?.disconnect();
      hls?.destroy();
      setHlsSetupDone(false); // Reset setup flag on cleanup
    };
  // Add runtimeConfig and isConfigLoading to dependencies
  }, [streamId, runtimeConfig, isConfigLoading, hlsSetupDone]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      {!streamInfo && <div className="absolute inset-0 flex items-center justify-center">Loading stream...</div>}
    </div>
  );
};

export default LiveStreamPlayer; 