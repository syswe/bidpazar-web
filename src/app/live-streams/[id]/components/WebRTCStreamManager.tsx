import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface BaseSignalingMessage {
  userId: string;
  streamId: string;
  username: string;
}

interface JoinRoomMessage extends BaseSignalingMessage {
  type: 'join-room' | 'leave-room';
  data: { timestamp: number; participantCount: number };
}

interface RTCOfferMessage extends BaseSignalingMessage {
  type: 'offer' | 'answer';
  data: RTCSessionDescriptionInit;
}

interface RTCIceCandidateMessage extends BaseSignalingMessage {
  type: 'ice-candidate';
  data: RTCIceCandidateInit;
}

type SignalingMessage = JoinRoomMessage | RTCOfferMessage | RTCIceCandidateMessage;

export default function WebRTCStreamManager({
  streamId,
  userId,
  username,
  isStreamer,
}: {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
}) {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [participants, setParticipants] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidatesQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const connectToSignalingServer = () => {
      const wsUrl = `ws://${window.location.hostname}:5001/rtc?streamId=${streamId}&userId=${userId}&username=${encodeURIComponent(username)}`;
      console.log('Connecting to WebSocket server:', wsUrl);

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setError('Failed to create WebSocket connection');
        return;
      }

      ws.onopen = () => {
        console.log('Connected to signaling server');
        setConnectionStatus('connected');
        setError(null);
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          await handleSignalingMessage(message);
        } catch (error) {
          console.error('Failed to handle WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('Disconnected from signaling server. Code:', event.code, 'Reason:', event.reason);
        setConnectionStatus('disconnected');
        // Attempt to reconnect after a delay
        setTimeout(connectToSignalingServer, 5000);
      };

      ws.onerror = (event) => {
        const error = event as ErrorEvent;
        console.error('WebSocket error:', error.message || 'Unknown error');
        setError(`Connection failed. Please ensure the server is running at ${window.location.hostname}:5001`);
      };

      wsRef.current = ws;
    };

    const startStreaming = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setError('Failed to access camera and microphone');
      }
    };

    const cleanup = () => {
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Stop local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }
    };

    if (isStreamer) {
      startStreaming();
    }
    connectToSignalingServer();

    return cleanup;
  }, [streamId, userId, username, isStreamer]);

  const handleSignalingMessage = async (message: SignalingMessage) => {
    switch (message.type) {
      case 'join-room':
        setParticipants(message.data.participantCount);
        if (isStreamer) {
          createPeerConnection(message.userId);
        }
        break;

      case 'leave-room':
        setParticipants(message.data.participantCount);
        if (peerConnectionsRef.current.has(message.userId)) {
          peerConnectionsRef.current.get(message.userId)?.close();
          peerConnectionsRef.current.delete(message.userId);
          iceCandidatesQueueRef.current.delete(message.userId);
        }
        break;

      case 'offer':
        if (!isStreamer) {
          const pc = createPeerConnection(message.userId);
          await pc.setRemoteDescription(new RTCSessionDescription(message.data));

          // Process any queued ICE candidates
          const queuedCandidates = iceCandidatesQueueRef.current.get(message.userId) || [];
          for (const candidate of queuedCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          iceCandidatesQueueRef.current.delete(message.userId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignalingMessage({
            type: 'answer',
            userId,
            streamId,
            username,
            data: answer,
          });
        }
        break;

      case 'answer':
        const pc = peerConnectionsRef.current.get(message.userId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(message.data));

          // Process any queued ICE candidates
          const queuedCandidates = iceCandidatesQueueRef.current.get(message.userId) || [];
          for (const candidate of queuedCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          iceCandidatesQueueRef.current.delete(message.userId);
        }
        break;

      case 'ice-candidate':
        const targetPc = peerConnectionsRef.current.get(message.userId);
        if (targetPc?.remoteDescription) {
          await targetPc.addIceCandidate(new RTCIceCandidate(message.data));
        } else {
          // Queue the ICE candidate if remote description is not set yet
          const queue = iceCandidatesQueueRef.current.get(message.userId) || [];
          queue.push(message.data);
          iceCandidatesQueueRef.current.set(message.userId, queue);
        }
        break;
    }
  };

  const createPeerConnection = (targetUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: 'ice-candidate',
          userId,
          streamId,
          username,
          data: event.candidate,
        });
      }
    };

    if (isStreamer && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    pc.ontrack = (event) => {
      if (videoRef.current && !isStreamer) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionsRef.current.set(targetUserId, pc);

    if (isStreamer) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            sendSignalingMessage({
              type: 'offer',
              userId,
              streamId,
              username,
              data: pc.localDescription
            });
          }
        })
        .catch((error) => {
          console.error('Error creating offer:', error);
          setError('Failed to create connection offer');
        });
    }

    return pc;
  };

  const sendSignalingMessage = (message: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isStreamer}
        className="w-full h-full object-contain"
      />
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white p-2 text-center">
          {error}
        </div>
      )}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{participants} watching</span>
      </div>
    </div>
  );
} 