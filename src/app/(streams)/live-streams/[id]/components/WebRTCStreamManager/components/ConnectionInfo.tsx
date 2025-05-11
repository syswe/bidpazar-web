"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ConnectionStatus, TransportRefs } from "../types";
import { Socket } from "socket.io-client";
import { Info, WifiOff, Wifi, Signal } from "lucide-react";

interface ConnectionInfoProps {
  socket: Socket | null;
  deviceRef: React.MutableRefObject<any>;
  transportRefs: TransportRefs;
  connectionState: ConnectionStatus;
  streamId: string;
  className?: string;
}

export function ConnectionInfo({
  socket,
  deviceRef,
  transportRefs,
  connectionState,
  streamId,
  className
}: ConnectionInfoProps) {
  // Early return if no connection details (hide component)
  if (!socket && connectionState === 'disconnected') {
    return null;
  }
  
  // Get human-readable statuses
  const getSocketStatus = () => {
    if (!socket) return "Disconnected";
    return socket.connected ? "Connected" : "Disconnected";
  };
  
  const getTransportStatus = (type: 'producer' | 'consumer') => {
    const transport = type === 'producer' 
      ? transportRefs.producer 
      : transportRefs.consumer;
    
    if (!transport) return "Not created";
    
    // Get connection state if available
    if ((transport as any).connectionState) {
      return (transport as any).connectionState;
    }
    
    return transport.closed ? "Closed" : "Active";
  };
  
  const getDeviceStatus = () => {
    if (!deviceRef.current) return "Not initialized";
    if (deviceRef.current.error) return "Error";
    return deviceRef.current.loaded ? "Loaded" : "Not loaded";
  };
  
  // Calculate overall signal quality
  const getSignalQuality = (): 'excellent' | 'good' | 'fair' | 'poor' | 'none' => {
    // No connection
    if (!socket || !socket.connected) return 'none';
    
    // Check transport statuses
    const producerState = transportRefs.producer 
      ? (transportRefs.producer as any).connectionState 
      : null;
    const consumerState = transportRefs.consumer 
      ? (transportRefs.consumer as any).connectionState 
      : null;
    
    // If any transport is in failed state, signal is poor
    if (producerState === 'failed' || consumerState === 'failed') return 'poor';
    
    // If any transport is disconnected, signal is fair
    if (producerState === 'disconnected' || consumerState === 'disconnected') return 'fair';
    
    // If socket is connected and any transport is connected, signal is good
    if (producerState === 'connected' || consumerState === 'connected') return 'good';
    
    // If we're fully streaming, signal is excellent
    if (connectionState === 'streaming') return 'excellent';
    
    // Default to fair if we're connected but not fully operational
    return socket.connected ? 'fair' : 'none';
  };
  
  // Get signal quality UI elements
  const getSignalIcon = () => {
    const quality = getSignalQuality();
    
    switch (quality) {
      case 'excellent':
        return <Signal className="h-4 w-4 text-green-500" />;
      case 'good':
        return <Wifi className="h-4 w-4 text-green-400" />;
      case 'fair':
        return <Wifi className="h-4 w-4 text-yellow-400" />;
      case 'poor':
        return <Wifi className="h-4 w-4 text-orange-500" />;
      case 'none':
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };
  
  return (
    <div className={cn(
      "bg-black/60 text-white p-2 rounded text-xs font-mono",
      className
    )}>
      <div className="flex items-center gap-1 mb-1">
        <Info className="h-3 w-3" />
        <span className="font-bold">WebRTC Status</span>
      </div>
      
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <span className="opacity-80">Socket:</span>
        <span className="font-semibold">{getSocketStatus()}</span>
        
        <span className="opacity-80">Device:</span>
        <span className="font-semibold">{getDeviceStatus()}</span>
        
        <span className="opacity-80">Producer:</span>
        <span className="font-semibold capitalize">{getTransportStatus('producer')}</span>
        
        <span className="opacity-80">Consumer:</span>
        <span className="font-semibold capitalize">{getTransportStatus('consumer')}</span>
        
        <span className="opacity-80">Stream:</span>
        <span className="font-semibold capitalize">{connectionState}</span>
        
        <span className="opacity-80">Signal:</span>
        <span className="font-semibold flex items-center gap-1">
          {getSignalIcon()}
          <span className="capitalize">{getSignalQuality()}</span>
        </span>
      </div>
      
      <div className="mt-1 text-xs opacity-70 truncate w-full" title={streamId}>
        ID: {streamId.substring(0, 8)}...
      </div>
    </div>
  );
} 