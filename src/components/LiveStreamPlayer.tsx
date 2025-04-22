import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import io from 'socket.io-client';
import axios from 'axios';
import { env } from '@/lib/env';
import { getToken } from '@/lib/auth';

const LiveStreamPlayer: React.FC<{ streamId: string }> = ({ streamId }) => {
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    if (!video || !streamId) return;

    let hls: Hls | null = null;

    const setupHls = async () => {
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
            // Handle HLS errors (e.g., retry logic, show error message)
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
      } catch (error) {
        console.error('Error setting up HLS:', error);
        setError('Failed to initialize video stream.');
        setIsLoading(false);
      }
    };

    setupHls();

    // Socket connection for real-time updates (using SOCKET_URL)
    const socket = io(env.SOCKET_URL, { // Use SOCKET_URL from env
      auth: { token: getToken() }, // Send token for authentication
      transports: ['websocket'], // Prefer WebSocket
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('joinStream', streamId);
    });

    socket.on('stream-status', (status: string) => {
      if (status === 'LIVE') {
        // Start video playback
        console.log('Stream is LIVE, video playback should start');
      }
    });

    socket.on('error', (error: string) => {
      setError(error);
    });

    return () => {
      socket.disconnect();
    };
  }, [streamId]);

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