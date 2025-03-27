import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const LiveStreamPlayer: React.FC = () => {
  const [streamId] = useState('');

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
      }
    });

    socket.on('error', (error: string) => {
      // setError(error);
      // setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [streamId]);

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default LiveStreamPlayer; 