import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface NetworkStats {
  connectionType?: string;
  effectiveType?: string;
  downlink: number;
  rtt: number;
  lastChecked: Date;
}

interface VideoStats {
  width: number;
  height: number;
  frameRate?: number;
  decodedFrames?: number;
  droppedFrames?: number;
  playbackRate: number;
  readyState: number;
  networkState: number;
}

interface SocketStats {
  connected: boolean;
  id?: string;
  transport?: string;
  reconnectAttempts: number;
  errors: number;
  lastActivity?: Date;
  ping?: number;
}

interface StreamStatsProps {
  networkStats: NetworkStats;
  videoStats: VideoStats;
  socketStats: SocketStats;
  framesSent?: number;
  framesReceived?: number;
  streamId: string;
  userId?: string;
  isStreamer: boolean;
  onRunTest?: () => void;
}

const NetworkTest: React.FC<{ onComplete: (results: any) => void }> = ({ onComplete }) => {
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);

    try {
      // Simple bandwidth estimation test
      const startTime = Date.now();
      const testSizes = [100, 500, 1000, 2000]; // KB
      const results = {
        downloadSpeeds: [] as number[],
        avgDownloadKbps: 0,
        testTime: 0,
        success: false
      };

      for (let i = 0; i < testSizes.length; i++) {
        setProgress(Math.floor((i / testSizes.length) * 100));

        // Fetch a file with the specified size
        const size = testSizes[i];
        const fetchStart = Date.now();

        try {
          // Add cache busting parameter and fetch test file
          const url = `${process.env.NEXT_PUBLIC_API_URL}/test-bandwidth?size=${size}&_cb=${Date.now()}`;
          const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout(10000) // 10s timeout
          });

          if (response.ok) {
            const blob = await response.blob();
            const fetchEnd = Date.now();
            const fetchTime = fetchEnd - fetchStart;

            // Calculate speed in Kbps
            const fileSizeKB = blob.size / 1024;
            const speedKbps = (fileSizeKB * 8) / (fetchTime / 1000);
            results.downloadSpeeds.push(speedKbps);
          }
        } catch (e) {
          console.warn("Test fetch failed", e);
        }
      }

      // Calculate average download speed
      if (results.downloadSpeeds.length > 0) {
        results.avgDownloadKbps = results.downloadSpeeds.reduce((a, b) => a + b, 0) / results.downloadSpeeds.length;
        results.success = true;
      }

      results.testTime = Date.now() - startTime;

      setProgress(100);
      onComplete(results);
    } catch (error) {
      console.error("Network test failed", error);
      onComplete({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setTesting(false);
    }
  }, [onComplete]);

  useEffect(() => {
    runTest();
  }, [runTest]);

  return (
    <div className="p-3 bg-slate-800 rounded-md">
      <p className="text-white mb-2">Network Test in Progress...</p>
      <div className="w-full h-2 bg-slate-600 rounded-md overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-width duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const StreamDiagnostics: React.FC<StreamStatsProps> = ({
  networkStats,
  videoStats,
  socketStats,
  framesSent = 0,
  framesReceived = 0,
  streamId,
  userId,
  isStreamer,
  onRunTest
}) => {
  const [expanded, setExpanded] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Function to determine streaming quality assessment
  const assessStreamQuality = useCallback(() => {
    let quality = 'good';
    let issues = [];

    // Check network conditions
    if (networkStats.downlink < 1.5) {
      quality = 'poor';
      issues.push('Low bandwidth');
    } else if (networkStats.downlink < 3) {
      quality = 'fair';
      issues.push('Limited bandwidth');
    }

    if (networkStats.rtt > 200) {
      quality = quality === 'good' ? 'fair' : 'poor';
      issues.push('High latency');
    }

    // Check video playback
    if (videoStats.droppedFrames && videoStats.decodedFrames) {
      const dropRate = (videoStats.droppedFrames / videoStats.decodedFrames) * 100;
      if (dropRate > 15) {
        quality = 'poor';
        issues.push('High frame drop rate');
      } else if (dropRate > 5) {
        quality = quality === 'good' ? 'fair' : 'poor';
        issues.push('Moderate frame drops');
      }
    }

    // Check socket connection
    if (!socketStats.connected) {
      quality = 'poor';
      issues.push('Socket disconnected');
    } else if (socketStats.errors > 3) {
      quality = quality === 'good' ? 'fair' : 'poor';
      issues.push('Connection errors');
    }

    return { quality, issues };
  }, [networkStats, videoStats, socketStats]);

  const { quality, issues } = assessStreamQuality();

  const handleRunTest = () => {
    setRunningTest(true);
    if (onRunTest) onRunTest();
  };

  const handleTestComplete = (results: any) => {
    setTestResults(results);
    setRunningTest(false);

    if (results.success) {
      const mbps = results.avgDownloadKbps / 1000;
      if (mbps < 1.5) {
        toast.error(`Network bandwidth test results: ${mbps.toFixed(2)} Mbps - This connection may be too slow for streaming video.`);
      } else if (mbps < 3) {
        toast.warning(`Network bandwidth test results: ${mbps.toFixed(2)} Mbps - This connection may experience quality issues with HD streaming.`);
      } else {
        toast.success(`Network bandwidth test results: ${mbps.toFixed(2)} Mbps - This connection should be suitable for streaming.`);
      }
    } else {
      toast.error("Network test failed. Please try again later.");
    }
  };

  const getQualityColor = () => {
    switch (quality) {
      case 'good': return 'bg-green-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-black/60 rounded-lg p-2 text-xs font-mono text-white">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${getQualityColor()}`}></div>
          <span className="font-semibold">Stream Health: {quality.toUpperCase()}</span>
        </div>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 p-2 rounded">
              <h4 className="font-bold mb-1">Network</h4>
              <p>Type: {networkStats.connectionType || 'unknown'}</p>
              <p>Quality: {networkStats.effectiveType || 'unknown'}</p>
              <p>Bandwidth: {networkStats.downlink.toFixed(1)} Mbps</p>
              <p>Latency: {networkStats.rtt} ms</p>
            </div>

            <div className="bg-black/30 p-2 rounded">
              <h4 className="font-bold mb-1">Connection</h4>
              <p>Status: {socketStats.connected ? 'Connected' : 'Disconnected'}</p>
              <p>Socket ID: {socketStats.id || 'none'}</p>
              <p>Reconnects: {socketStats.reconnectAttempts}</p>
              <p>Errors: {socketStats.errors}</p>
            </div>

            <div className="bg-black/30 p-2 rounded">
              <h4 className="font-bold mb-1">Video</h4>
              <p>Resolution: {videoStats.width}x{videoStats.height}</p>
              <p>State: {videoStats.readyState}/4</p>
              {videoStats.frameRate && <p>Frame Rate: {videoStats.frameRate.toFixed(1)} fps</p>}
              {videoStats.decodedFrames !== undefined && (
                <p>Frames: {videoStats.decodedFrames} (dropped: {videoStats.droppedFrames || 0})</p>
              )}
            </div>

            <div className="bg-black/30 p-2 rounded">
              <h4 className="font-bold mb-1">Stream Info</h4>
              <p>Stream ID: {streamId.substring(0, 10)}...</p>
              <p>User ID: {userId ? userId.substring(0, 10) + '...' : 'anonymous'}</p>
              <p>Role: {isStreamer ? 'Streamer' : 'Viewer'}</p>
              <p>{isStreamer ? `Sent: ${framesSent} frames` : `Received: ${framesReceived} frames`}</p>
            </div>
          </div>

          {issues.length > 0 && (
            <div className="bg-red-900/30 p-2 rounded">
              <h4 className="font-bold">Issues Detected:</h4>
              <ul className="list-disc list-inside">
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2">
            {runningTest ? (
              <NetworkTest onComplete={handleTestComplete} />
            ) : (
              <button
                onClick={handleRunTest}
                className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs"
              >
                Run Network Test
              </button>
            )}

            {testResults?.success && (
              <div className="mt-2 bg-slate-800 p-2 rounded text-xs">
                <p>Download: {(testResults.avgDownloadKbps / 1000).toFixed(2)} Mbps</p>
                <p>Test Time: {(testResults.testTime / 1000).toFixed(1)}s</p>
                <p>Status: {testResults.avgDownloadKbps > 3000 ? 'Good' : testResults.avgDownloadKbps > 1500 ? 'Fair' : 'Poor'}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-2">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.location.reload();
              }}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              Reload Page
            </a>
          </div>
        </div>
      )}
    </div>
  );
}; 