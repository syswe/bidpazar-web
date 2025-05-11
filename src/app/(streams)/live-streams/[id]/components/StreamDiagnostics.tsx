'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Cpu, RotateCw, Info, Download, Shield, Terminal } from 'lucide-react';
import { getToken } from "@/lib/frontend-auth";
import { useRuntimeConfig } from '@/context/RuntimeConfigContext'; // Import the hook
import { formatDate } from '../utils/dateUtils';
import { LiveStreamDetails } from '../hooks/useStreamDetails';
import { ConnectionState, LogItem } from '../hooks/useStreamLogging';

interface StreamDiagnosticsProps {
  streamId: string;
  streamInfo: LiveStreamDetails;
  connectionState: ConnectionState;
  logs: LogItem[];
  onReset: () => void;
}

interface DiagnosticResult {
  success: boolean;
  message: string;
  details?: string[];
}

export const StreamDiagnostics: React.FC<StreamDiagnosticsProps> = ({
  streamId,
  streamInfo,
  connectionState,
  logs,
  onReset,
}) => {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig(); // Use the hook
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [healthStatus, setHealthStatus] = useState<string>("unknown");
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'connection' | 'logs'>('details');

  // Use the streamId from props if available
  const streamIdToUse = streamId || (streamInfo?.id || '');

  // If logs are provided, display them instead of running diagnostics
  const hasExternalLogs = logs && logs.length > 0;

  // Only run diagnostics if no external logs are provided
  const runDiagnostics = async () => {
    if (hasExternalLogs) return;
    
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
      if (streamIdToUse) {
        await checkStreamStatus();
      }

      setSummary('Diagnostics complete. Check the results below.');
    } catch (error) {
      setSummary(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const checkNetworkConnectivity = async () => {
    if (isConfigLoading || !runtimeConfig) {
      addResult({
        success: false,
        message: 'Network connectivity check failed',
        details: ['Runtime configuration not loaded']
      });
      throw new Error('Runtime configuration not loaded');
    }
    const apiUrl = runtimeConfig.apiUrl; // Use runtime config

    try {
      const response = await fetch(`${apiUrl}/health`); // Use runtime apiUrl
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
    if (isConfigLoading || !runtimeConfig) {
      addResult({
        success: false,
        message: 'Signaling server connection check failed',
        details: ['Runtime configuration not loaded']
      });
      throw new Error('Runtime configuration not loaded');
    }
    const socketUrl = runtimeConfig.socketUrl; // Use runtime config

    try {
      if (!socketUrl) {
        throw new Error('Socket URL is not configured');
      }
      
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
    if (isConfigLoading || !runtimeConfig) {
      addResult({
        success: false,
        message: 'Stream status check failed',
        details: ['Runtime configuration not loaded']
      });
      throw new Error('Runtime configuration not loaded');
    }
    const apiUrl = runtimeConfig.apiUrl; // Use runtime config

    try {
      // Check stream status via API
      const token = getToken();
      const response = await fetch(`${apiUrl}/live-streams/${streamIdToUse}`, { // Use runtime apiUrl
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
          `Stream ID: ${streamIdToUse}`,
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
    if (!isConfigLoading && runtimeConfig) { // Only run when config is ready
      runDiagnostics();
    } else if (!isConfigLoading && !runtimeConfig) {
      // Handle config error state
      setSummary("Error: Failed to load runtime configuration.");
      setIsRunning(false);
    }
  }, [streamId, runtimeConfig, isConfigLoading]); // Add dependencies

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'debug':
        return 'text-blue-400';
      case 'info':
      default:
        return 'text-gray-400';
    }
  };

  const renderDetailsTab = () => (
    <div className="space-y-4">
      <div className="rounded-md bg-black/30 p-3">
        <h4 className="text-sm font-semibold mb-2 flex items-center">
          <Info className="h-4 w-4 mr-1" /> Stream Information
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-400">ID</div>
          <div className="font-mono">{streamInfo.id}</div>
          <div className="text-gray-400">Title</div>
          <div>{streamInfo.title}</div>
          <div className="text-gray-400">Status</div>
          <div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                streamInfo.status === 'LIVE'
                  ? 'bg-green-500/20 text-green-500'
                  : streamInfo.status === 'ENDED'
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-yellow-500/20 text-yellow-500'
              }`}
            >
              {streamInfo.status}
            </span>
          </div>
          <div className="text-gray-400">Creator ID</div>
          <div className="font-mono">{streamInfo.creatorId}</div>
          <div className="text-gray-400">Creator</div>
          <div>{streamInfo.user?.username || 'Unknown'}</div>
          <div className="text-gray-400">Started</div>
          <div>{formatDate(streamInfo.startTime)}</div>
          <div className="text-gray-400">Updated</div>
          <div>{formatDate(streamInfo.updatedAt)}</div>
        </div>
      </div>
    </div>
  );

  const renderConnectionTab = () => (
    <div className="space-y-4">
      <div className="rounded-md bg-black/30 p-3">
        <h4 className="text-sm font-semibold mb-2 flex items-center">
          <Shield className="h-4 w-4 mr-1" /> Connection Status
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-gray-400">Connected</div>
          <div>
            <span
              className={`px-2 py-0.5 rounded-full ${
                connectionState.isConnected
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-red-500/20 text-red-500'
              }`}
            >
              {connectionState.isConnected ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="text-gray-400">Reconnecting</div>
          <div>
            <span
              className={`px-2 py-0.5 rounded-full ${
                connectionState.isReconnecting
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {connectionState.isReconnecting ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="text-gray-400">Loopback</div>
          <div>
            <span
              className={`px-2 py-0.5 rounded-full ${
                connectionState.isLoopback
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {connectionState.isLoopback ? 'Yes' : 'No'}
            </span>
            {connectionState.isLoopback && (
              <span className="block mt-1 text-xs text-gray-400">
                {connectionState.optimizedForLoopback
                  ? 'Optimized for local connection'
                  : ''}
              </span>
            )}
          </div>
          {connectionState.lastError && (
            <>
              <div className="text-gray-400">Last Error</div>
              <div className="text-red-400 whitespace-normal break-words">
                {connectionState.lastError}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          onClick={onReset}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center"
        >
          <RotateCw className="h-4 w-4 mr-2" /> Reset Connection
        </button>
      </div>
    </div>
  );

  const renderLogsTab = () => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold flex items-center">
          <Terminal className="h-4 w-4 mr-1" /> Session Logs
        </h4>
        <button
          onClick={() => {
            const logText = logs
              .map(
                (log) =>
                  `${log.timestamp} [${log.level}] ${log.message} ${
                    log.data ? JSON.stringify(log.data) : ''
                  }`
              )
              .join('\n');
            
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stream-logs-${streamId}-${new Date().toISOString()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded flex items-center"
        >
          <Download className="h-3 w-3 mr-1" /> Export
        </button>
      </div>

      <div className="h-64 overflow-y-auto rounded-md bg-black/50 p-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center p-4">No logs available</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="border-b border-gray-800 py-1">
              <div className="flex items-start">
                <span className="text-gray-500 min-w-[180px] mr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`uppercase font-bold min-w-[50px] ${getLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="ml-2 break-words">{log.message}</span>
              </div>
              {log.data !== undefined && log.data !== null && (
                <pre className="mt-1 pl-[230px] text-gray-400 whitespace-pre-wrap break-words">
                  {typeof log.data === 'object'
                    ? JSON.stringify(log.data, null, 2)
                    : String(log.data)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 text-sm ${
            activeTab === 'details'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center">
            <Info className="h-4 w-4 mr-1" /> Details
          </div>
        </button>
        <button
          onClick={() => setActiveTab('connection')}
          className={`px-4 py-2 text-sm ${
            activeTab === 'connection'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center">
            <Cpu className="h-4 w-4 mr-1" /> Connection
          </div>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm ${
            activeTab === 'logs'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <div className="flex items-center">
            <Terminal className="h-4 w-4 mr-1" /> Logs ({logs.length})
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="pb-4">
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'connection' && renderConnectionTab()}
        {activeTab === 'logs' && renderLogsTab()}
      </div>
    </div>
  );
}; 