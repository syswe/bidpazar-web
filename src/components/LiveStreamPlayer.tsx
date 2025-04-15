import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const LiveStreamPlayer: React.FC<{ streamId: string }> = ({ streamId }) => {
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/live-streams/${streamId}/video`);
        setStreamInfo(response.data);
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
    if (!streamInfo || !videoRef.current) return;

    // Placeholder for WebRTC connection
    // In a real implementation, you would use a library like simple-peer or directly use RTCPeerConnection
    // to connect to the WebSocket endpoint provided in streamInfo.wsEndpoint
    console.log('WebRTC connection should be established to:', streamInfo.wsEndpoint);

    // For now, we'll just log a message
    // Actual implementation would involve setting up WebRTC peer connection and attaching the stream to the video element
    // videoRef.current.srcObject = stream; // This would be set once the stream is received via WebRTC

  }, [streamInfo]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      socket.emit('join-stream', streamId);
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