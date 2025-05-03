'use client';

import { useState, useEffect, useRef } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import env from '@/lib/env';

export default function TestWebRTC() {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rtpCapabilities, setRtpCapabilities] = useState<any>(null);
  const [transportCreated, setTransportCreated] = useState(false);
  const [producerCreated, setProducerCreated] = useState(false);
  const [showLocalVideo, setShowLocalVideo] = useState(false);
  const [showRemoteVideo, setShowRemoteVideo] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const transportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);
  
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11, 19)} ${message}`]);
  };

  const startLocalCamera = async () => {
    try {
      addLog('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: true 
      });
      
      addLog('✅ Camera access granted');
      mediaStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Mute local preview to avoid feedback
        setShowLocalVideo(true);
      }
      
      // If we already have a transport, produce the stream
      if (transportRef.current) {
        produceStream(stream);
      }
      
      return stream;
    } catch (err) {
      addLog(`❌ Camera access error: ${err}`);
      setError(`Camera access error: ${err}`);
      return null;
    }
  };
  
  const produceStream = async (stream: MediaStream) => {
    if (!transportRef.current || !deviceRef.current) {
      addLog('❌ Cannot produce: transport or device not ready');
      return;
    }
    
    try {
      addLog('Starting to produce video...');
      
      // Get the video track from the stream
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        addLog('❌ No video track found in stream');
        return;
      }
      
      // Produce the video
      producerRef.current = await transportRef.current.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 100000, scaleResolutionDownBy: 4 },
          { maxBitrate: 300000, scaleResolutionDownBy: 2 },
          { maxBitrate: 900000 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1000
        },
        appData: {
          streamId: 'test-stream',
          mediaType: 'video'
        }
      });
      
      addLog(`✅ Video producer created with ID: ${producerRef.current.id}`);
      setProducerCreated(true);
      
      // Also produce audio if available
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await transportRef.current.produce({
          track: audioTrack,
          appData: {
            streamId: 'test-stream',
            mediaType: 'audio'
          }
        });
        
        addLog(`✅ Audio producer created with ID: ${audioProducer.id}`);
      } else {
        addLog('⚠️ No audio track found in stream');
      }
    } catch (err) {
      addLog(`❌ Error producing media: ${err}`);
      setError(`Production error: ${err}`);
    }
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const runTest = async () => {
      addLog('Starting WebRTC test with live media...');
      
      try {
        // 1. Create WebSocket connection
        const socketUrl = env.SOCKET_URL;
        const wsUrl = socketUrl.startsWith('ws') 
          ? socketUrl.replace(/\/$/, '') 
          : socketUrl.replace(/^http/, 'ws').replace(/\/$/, '');
        
        const testId = `test-${Date.now()}`;
        const fullWsUrl = `${wsUrl}/rtc/v1?streamId=test-stream&userId=${testId}&username=tester`;
        
        addLog(`Connecting to: ${fullWsUrl}`);
        ws = new WebSocket(fullWsUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          addLog('✅ WebSocket connected successfully');
          setConnected(true);
          
          // 2. Send join room message
          try {
            ws?.send(JSON.stringify({
              type: 'join-room',
              streamId: 'test-stream',
              userId: testId,
              username: 'tester',
              data: {
                timestamp: Date.now(),
                isStreamer: true
              }
            }));
            addLog('✅ Sent join-room message');
          } catch (err) {
            addLog(`❌ Error sending join message: ${err}`);
          }
          
          // 3. Get router capabilities
          try {
            ws?.send(JSON.stringify({
              type: 'getRouterRtpCapabilities',
              streamId: 'test-stream',
              userId: testId,
              username: 'tester',
              data: {}
            }));
            addLog('✅ Requested RTP capabilities');
          } catch (err) {
            addLog(`❌ Error requesting capabilities: ${err}`);
          }
        };
        
        ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            addLog(`📥 Received: ${message.type}`);
            
            if (message.type === 'connection-status') {
              addLog('✅ Connection acknowledged by server');
              
              // Report mediasoup availability
              if (message.data?.mediasoupAvailable) {
                addLog('✅ MediaSoup available on server');
              } else {
                addLog('⚠️ MediaSoup not available on server');
              }
            }
            else if (message.type === 'routerCapabilities') {
              addLog('✅ Received router capabilities');
              setRtpCapabilities(message.data);
              
              // 4. Initialize device with capabilities
              try {
                const device = new mediasoupClient.Device();
                await device.load({ routerRtpCapabilities: message.data });
                deviceRef.current = device;
                addLog('✅ MediaSoup device initialized');
                
                // 5. Request transport creation
                ws?.send(JSON.stringify({
                  type: 'createTransport',
                  streamId: 'test-stream',
                  userId: testId,
                  username: 'tester',
                  data: {}
                }));
                addLog('✅ Requested transport creation');
              } catch (err) {
                addLog(`❌ Error initializing device: ${err}`);
              }
            }
            else if (message.type === 'transportCreated') {
              addLog('✅ Transport created by server');
              setTransportCreated(true);
              
              // 6. Create local send transport
              if (deviceRef.current) {
                const transport = deviceRef.current.createSendTransport({
                  id: message.data.id,
                  iceParameters: message.data.iceParameters,
                  iceCandidates: message.data.iceCandidates,
                  dtlsParameters: message.data.dtlsParameters,
                  iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                  ]
                });
                transportRef.current = transport;
                
                transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                  addLog('Transport connect event triggered');
                  try {
                    ws?.send(JSON.stringify({
                      type: 'connectProducerTransport',
                      streamId: 'test-stream',
                      userId: testId,
                      username: 'tester',
                      transportId: transport.id,
                      dtlsParameters,
                      data: {}
                    }));
                    callback();
                  } catch (error) {
                    errback(error as Error);
                  }
                });
                
                transport.on('produce', ({ kind, rtpParameters, appData }, callback) => {
                  addLog(`Transport produce event (${kind})`);
                  
                  ws?.send(JSON.stringify({
                    type: 'produce',
                    streamId: 'test-stream',
                    userId: testId,
                    username: 'tester',
                    transportId: transport.id,
                    kind,
                    rtpParameters,
                    appData: {
                      ...appData,
                      streamId: 'test-stream',
                      userId: testId
                    },
                    data: {}
                  }));
                  
                  callback({ id: `test-producer-${Date.now()}-${kind}` });
                });
                
                transport.on('connectionstatechange', (state) => {
                  addLog(`Transport connection state: ${state}`);
                  
                  if (state === 'connected') {
                    addLog('🎉 Transport connected successfully');
                    // If we have a media stream, produce it
                    if (mediaStreamRef.current) {
                      produceStream(mediaStreamRef.current);
                    } else {
                      // Request camera access if we don't have it yet
                      startLocalCamera();
                    }
                  } else if (state === 'failed' || state === 'disconnected') {
                    addLog(`❌ Transport connection ${state}`);
                  }
                });
                
                addLog('✅ Local transport created');
              }
            }
            else if (message.type === 'produced') {
              addLog(`✅ Producer ID received: ${message.producerId}`);
              // Could set up consumers here to receive streams from other users
            }
            else if (message.type === 'error') {
              addLog(`❌ Server error: ${message.data}`);
              setError(`Server error: ${message.data}`);
            }
          } catch (err) {
            addLog(`❌ Error processing message: ${err}`);
          }
        };
        
        ws.onerror = (error) => {
          addLog(`❌ WebSocket error: ${JSON.stringify(error)}`);
          setError('Connection error');
        };
        
        ws.onclose = (event) => {
          addLog(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'No reason'}`);
          setConnected(false);
        };
      } catch (err) {
        addLog(`❌ Test error: ${err}`);
        setError(`${err}`);
      }
    };
    
    runTest();
    
    return () => {
      // Clean up camera when component unmounts
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close the producer
      if (producerRef.current) {
        producerRef.current.close();
      }
      
      // Close the transport
      if (transportRef.current) {
        transportRef.current.close();
      }
      
      // Close websocket
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Live Video Streaming Test</h1>
      
      <div className="mb-4 flex space-x-4">
        <div className="p-3 border rounded flex-1">
          <div className="font-semibold mb-2">Connection Status:</div>
          <div className={`rounded-full h-4 w-4 ${connected ? 'bg-green-500' : 'bg-red-500'} inline-block mr-2`}></div>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
          {error && <div className="text-red-500 mt-2">{error}</div>}
        </div>
        
        <div className="p-3 border rounded flex-1">
          <div className="font-semibold mb-2">RTP Capabilities:</div>
          <div className={`rounded-full h-4 w-4 ${rtpCapabilities ? 'bg-green-500' : 'bg-gray-300'} inline-block mr-2`}></div>
          <span>{rtpCapabilities ? 'Received' : 'Waiting...'}</span>
        </div>
        
        <div className="p-3 border rounded flex-1">
          <div className="font-semibold mb-2">Media Streaming:</div>
          <div className={`rounded-full h-4 w-4 ${producerCreated ? 'bg-green-500' : 'bg-gray-300'} inline-block mr-2`}></div>
          <span>{producerCreated ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {showLocalVideo && (
          <div className="p-2 border rounded">
            <h3 className="font-semibold mb-2">Local Camera</h3>
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-48 bg-black object-contain"
            />
          </div>
        )}
        
        {showRemoteVideo && (
          <div className="p-2 border rounded">
            <h3 className="font-semibold mb-2">Remote Stream</h3>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-48 bg-black object-contain" 
            />
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <button 
          onClick={startLocalCamera} 
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          disabled={!!mediaStreamRef.current}
        >
          Start Camera
        </button>
        
        <button 
          onClick={() => {
            // This would be for manually connecting to other streams
            addLog('This would connect to a remote stream if available.');
          }} 
          className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
          disabled={!transportCreated}
        >
          Connect to Stream
        </button>
      </div>
      
      <div className="border rounded p-4 bg-black text-green-400 font-mono text-sm h-96 overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i} className="leading-relaxed">{log}</div>
        ))}
      </div>
    </div>
  );
} 