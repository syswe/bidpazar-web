'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getToken } from "@/lib/frontend-auth";
import { env } from "@/lib/env"; // Import env config

interface StreamDiagnosticsProps {
  streamId: string;
  onReset?: () => void;
}

interface DiagnosticResult {
  success: boolean;
  message: string;
  details?: string[];
}

export function StreamDiagnostics({ streamId, onReset }: StreamDiagnosticsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [healthStatus, setHealthStatus] = useState<string>("unknown");
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    setSummary('Running diagnostics...');

    try {
      // Step 1: Check network connectivity
      await checkNetworkConnectivity();

      // Step 2: Check WebRTC support
      await checkWebRTCSupport();

      // Step 3: Check media devices
      await checkMediaDevices();

      // Step 4: Test STUN/TURN servers
      await testICEServers();

      // Step 5: Test signaling server connection
      await testSignalingServer();

      // Step 6: Check stream status
      await checkStreamStatus();

      setSummary('Diagnostics complete. Check the results below.');
    } catch (error) {
      setSummary(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const checkNetworkConnectivity = async () => {
    try {
      const response = await fetch(`${env.BACKEND_API_URL}/health`);
      if (response.ok) {
        addResult({
          success: true,
          message: 'Network connectivity check passed',
          details: ['Server is reachable', `Response status: ${response.status}`]
        });
      } else {
        throw new Error(`Server returned status: ${response.status}`);
      }
    } catch (error) {
      addResult({
        success: false,
        message: 'Network connectivity check failed',
        details: [error instanceof Error ? error.message : String(error)]
      });
      throw error;
    }
  };

  const checkWebRTCSupport = async () => {
    try {
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC is not supported in this browser');
      }

      addResult({
        success: true,
        message: 'WebRTC support check passed',
        details: [
          'RTCPeerConnection is available',
          `Browser: ${navigator.userAgent}`
        ]
      });
    } catch (error) {
      addResult({
        success: false,
        message: 'WebRTC support check failed',
        details: [error instanceof Error ? error.message : String(error)]
      });
      throw error;
    }
  };

  const checkMediaDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API is not supported');
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some(device => device.kind === 'videoinput');
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');

      if (!hasVideoInput && !hasAudioInput) {
        throw new Error('No media input devices found');
      }

      addResult({
        success: true,
        message: 'Media devices check passed',
        details: [
          `Video input devices: ${devices.filter(d => d.kind === 'videoinput').length}`,
          `Audio input devices: ${devices.filter(d => d.kind === 'audioinput').length}`
        ]
      });
    } catch (error) {
      addResult({
        success: false,
        message: 'Media devices check failed',
        details: [error instanceof Error ? error.message : String(error)]
      });
      throw error;
    }
  };

  const testICEServers = async () => {
    try {
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];

      const pc = new RTCPeerConnection({ iceServers });
      pc.createDataChannel('test');

      let candidateFound = false;
      let timeoutId: NodeJS.Timeout;

      await new Promise<void>((resolve, reject) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidateFound = true;
            clearTimeout(timeoutId);
            pc.close();
            resolve();
          }
        };

        timeoutId = setTimeout(() => {
          pc.close();
          if (!candidateFound) {
            reject(new Error('No ICE candidates found'));
          }
        }, 5000);

        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(reject);
      });

      addResult({
        success: true,
        message: 'ICE servers check passed',
        details: ['Successfully gathered ICE candidates']
      });
    } catch (error) {
      addResult({
        success: false,
        message: 'ICE servers check failed',
        details: [error instanceof Error ? error.message : String(error)]
      });
      throw error;
    }
  };

  const testSignalingServer = async () => {
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5001';
      
      // Ensure socket URL uses correct protocol and remove any trailing slashes
      const wsUrl = socketUrl.startsWith('ws')
        ? socketUrl.replace(/\/$/, '')
        : socketUrl.replace(/^http/, 'ws').replace(/\/$/, '');
      
      // Create a test connection to the signaling server
      const wsTestUrl = `${wsUrl}/rtc/health`;
      
      let connectionSuccess = false;
      let errorMessage = '';
      
      await new Promise<void>((resolve, reject) => {
        try {
          const ws = new WebSocket(wsTestUrl);
          
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout after 5 seconds'));
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            connectionSuccess = true;
            ws.close();
            resolve();
          };
          
          ws.onerror = (event) => {
            clearTimeout(timeout);
            errorMessage = 'WebSocket connection error';
            ws.close();
            reject(new Error(errorMessage));
          };
        } catch (err) {
          reject(err);
        }
      });
      
      addResult({
        success: connectionSuccess,
        message: 'Signaling server connection check passed',
        details: [
          `Connected to: ${wsTestUrl}`,
          'WebSocket connection established successfully'
        ]
      });
    } catch (error) {
      addResult({
        success: false,
        message: 'Signaling server connection check failed',
        details: [
          error instanceof Error ? error.message : String(error),
          'This may indicate that the streaming server is not running or unreachable'
        ]
      });
      // Don't throw here to allow other tests to continue
    }
  };

  const checkStreamStatus = async () => {
    try {
      // Check stream status via API
      const token = getToken();
      const response = await fetch(`${env.BACKEND_API_URL}/live-streams/${streamId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stream status: ${response.status}`);
      }
      
      const streamData = await response.json();
      const status = streamData.status;
      
      const isLive = status === 'active';
      
      addResult({
        success: true,
        message: `Stream status check: ${isLive ? 'Stream is LIVE' : 'Stream is not live'}`,
        details: [
          `Current status: ${status}`,
          `Stream ID: ${streamId}`,
          `Creator: ${streamData.user?.username || 'Unknown'}`,
          `Created: ${new Date(streamData.createdAt || Date.now()).toLocaleString()}`
        ]
      });
    } catch (error) {
      addResult({
        success: false,
        message: 'Stream status check failed',
        details: [error instanceof Error ? error.message : String(error)]
      });
      // Don't throw here to allow other tests to continue
    }
  };

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  useEffect(() => {
    runDiagnostics();
  }, [streamId]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Stream Diagnostics</h2>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
              }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'
                  }`}
              />
              <span className={result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                {result.message}
              </span>
            </div>
            {result.details && (
              <ul className="mt-2 ml-4 text-sm space-y-1">
                {result.details.map((detail, i) => (
                  <li key={i} className="text-gray-600 dark:text-gray-400">
                    • {detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {isRunning && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Running diagnostics...</span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{summary}</p>
          <div className="flex gap-2">
            <button
              onClick={runDiagnostics}
              disabled={isRunning}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
            >
              Run Again
            </button>
            {onReset && (
              <button
                onClick={onReset}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
              >
                Reset Connection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 