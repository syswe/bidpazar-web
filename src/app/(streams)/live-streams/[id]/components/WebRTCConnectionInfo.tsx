"use client";

import { useState, useEffect } from "react";
import { Activity, Info, AlertTriangle } from "lucide-react";

interface WebRTCConnectionInfoProps {
  socket: any;
  deviceRef: any;
  transportRefs: {
    producer?: any;
    consumer?: any;
  };
  connectionState: string;
  streamId: string;
  isLoopback?: boolean;
  className?: string;
}

export default function WebRTCConnectionInfo({
  socket,
  deviceRef,
  transportRefs,
  connectionState,
  streamId,
  isLoopback,
  className,
}: WebRTCConnectionInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<{
    socketLatency?: number;
    iceCandidateType?: string;
    localAddress?: string;
    remoteAddress?: string;
    packetsLost?: number;
    rtt?: number;
    bitrateDownload?: number;
    bitrateUpload?: number;
    timestamp: number;
  }>({ timestamp: Date.now() });

  // Fetch connection stats periodically
  useEffect(() => {
    if (!isExpanded) return;

    const getSocketLatency = () => {
      const start = Date.now();
      socket?.emit("ping", () => {
        const latency = Date.now() - start;
        setStats((prev) => ({
          ...prev,
          socketLatency: latency,
          timestamp: Date.now(),
        }));
      });
    };

    const getWebRTCStats = async () => {
      try {
        // Get stats from producer transport (if streaming)
        if (transportRefs.producer && !transportRefs.producer.closed) {
          const senderStats = await transportRefs.producer.getStats();
          let packetsLost = 0;
          let rtt = 0;
          let bitrateUpload = 0;
          let candidateType = "";
          let localAddress = "";
          let remoteAddress = "";

          // Process stats
          senderStats.forEach((stat: any) => {
            // Handle outbound-rtp statistics
            if (stat.type === "outbound-rtp") {
              packetsLost += stat.packetsLost || 0;
              bitrateUpload += stat.bytesSent ? (stat.bytesSent * 8) / 1000 : 0;
            }
            // Handle candidate-pair statistics for ICE info
            else if (stat.type === "candidate-pair" && stat.selected) {
              rtt = stat.currentRoundTripTime * 1000 || 0; // Convert to ms
            }
            // Handle local candidate info
            else if (stat.type === "local-candidate") {
              candidateType = stat.candidateType || "";
              localAddress = `${stat.ip || ""}:${stat.port || ""}`;
            }
            // Handle remote candidate info
            else if (stat.type === "remote-candidate") {
              remoteAddress = `${stat.ip || ""}:${stat.port || ""}`;
            }
          });

          setStats((prev) => ({
            ...prev,
            packetsLost,
            rtt,
            bitrateUpload,
            iceCandidateType: candidateType,
            localAddress,
            remoteAddress,
            timestamp: Date.now(),
          }));
        }

        // Get stats from consumer transport (if viewing)
        else if (transportRefs.consumer && !transportRefs.consumer.closed) {
          const receiverStats = await transportRefs.consumer.getStats();
          let packetsLost = 0;
          let bitrateDownload = 0;
          let candidateType = "";
          let localAddress = "";
          let remoteAddress = "";

          // Process stats
          receiverStats.forEach((stat: any) => {
            // Handle inbound-rtp statistics
            if (stat.type === "inbound-rtp") {
              packetsLost += stat.packetsLost || 0;
              bitrateDownload += stat.bytesReceived
                ? (stat.bytesReceived * 8) / 1000
                : 0;
            }
            // Handle candidate-pair statistics for ICE info
            else if (stat.type === "candidate-pair" && stat.selected) {
              const rtt = stat.currentRoundTripTime * 1000 || 0; // Convert to ms
              setStats((prev) => ({ ...prev, rtt }));
            }
            // Handle local candidate info
            else if (stat.type === "local-candidate") {
              candidateType = stat.candidateType || "";
              localAddress = `${stat.ip || ""}:${stat.port || ""}`;
            }
            // Handle remote candidate info
            else if (stat.type === "remote-candidate") {
              remoteAddress = `${stat.ip || ""}:${stat.port || ""}`;
            }
          });

          setStats((prev) => ({
            ...prev,
            packetsLost,
            bitrateDownload,
            iceCandidateType: candidateType,
            localAddress,
            remoteAddress,
            timestamp: Date.now(),
          }));
        }
      } catch (error) {
        console.warn("Failed to get WebRTC stats:", error);
      }
    };

    // Run stats collection immediately and then every 5 seconds
    getSocketLatency();
    getWebRTCStats();

    const intervalId = setInterval(() => {
      getSocketLatency();
      getWebRTCStats();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isExpanded, socket, transportRefs, deviceRef]);

  // Format the connection state for display
  const getStateColor = () => {
    switch (connectionState) {
      case "connected":
        return "text-green-500";
      case "connecting":
        return "text-amber-500";
      case "disconnected":
      case "failed":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getStateIcon = () => {
    switch (connectionState) {
      case "connected":
        return <Activity className="h-4 w-4" />;
      case "connecting":
        return <Activity className="h-4 w-4 animate-pulse" />;
      case "disconnected":
      case "failed":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getConnectionType = () => {
    if (!stats.iceCandidateType) return "Unknown";

    // For loopback connections, highlight this in the UI
    if (isLoopback && stats.iceCandidateType === "host") {
      return "Loopback/Local (host)";
    }

    switch (stats.iceCandidateType) {
      case "host":
        return "Direct (host)";
      case "srflx":
        return "STUN (srflx)";
      case "prflx":
        return "STUN/Peer Reflexive (prflx)";
      case "relay":
        return "TURN relay";
      default:
        return stats.iceCandidateType;
    }
  };

  return (
    <div className={`text-sm ${className}`}>
      <div
        className="flex items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={`flex items-center gap-1 ${getStateColor()}`}>
          {getStateIcon()}
          <span className="font-medium">{connectionState}</span>
          {isLoopback && (
            <span className="text-xs ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
              local
            </span>
          )}
        </span>
        <button className="text-xs ml-2 text-blue-500 hover:underline">
          {isExpanded ? "Hide details" : "Show details"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-2 p-2 bg-gray-50 border rounded text-xs">
          <h4 className="font-medium mb-1">WebRTC Connection Details</h4>
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">Connection Type:</span>
              <span>{getConnectionType()}</span>
            </div>
            {isLoopback && (
              <div className="grid grid-cols-2 gap-x-2">
                <span className="text-gray-600">Loopback Mode:</span>
                <span className="text-amber-600">Optimized for localhost</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">Socket Latency:</span>
              <span>
                {stats.socketLatency !== undefined
                  ? `${stats.socketLatency}ms`
                  : "N/A"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">WebRTC Latency:</span>
              <span>{stats.rtt ? `${Math.round(stats.rtt)}ms` : "N/A"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">Packets Lost:</span>
              <span>
                {stats.packetsLost !== undefined ? stats.packetsLost : "N/A"}
              </span>
            </div>
            {stats.bitrateDownload !== undefined && (
              <div className="grid grid-cols-2 gap-x-2">
                <span className="text-gray-600">Download:</span>
                <span>{(stats.bitrateDownload / 1024).toFixed(2)} Mbps</span>
              </div>
            )}
            {stats.bitrateUpload !== undefined && (
              <div className="grid grid-cols-2 gap-x-2">
                <span className="text-gray-600">Upload:</span>
                <span>{(stats.bitrateUpload / 1024).toFixed(2)} Mbps</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">Local:</span>
              <span className="truncate">{stats.localAddress || "N/A"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">Remote:</span>
              <span className="truncate">{stats.remoteAddress || "N/A"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <span className="text-gray-600">Stream ID:</span>
              <span className="truncate">{streamId}</span>
            </div>
          </div>
          <div className="mt-2 text-gray-400">
            Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
