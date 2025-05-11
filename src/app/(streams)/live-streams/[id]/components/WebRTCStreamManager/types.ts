import { Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

// ===================== LOGGING TYPES =====================
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];
export type LogData = Record<string, any> | null | undefined;

// ===================== WEBRTC TYPES =====================
export interface RouterRtpCapabilitiesResponse {
  rtpCapabilities?: mediasoupClient.types.RtpCapabilities;
  error?: string;
  duplicateConnection?: boolean;
  existingSocketId?: string;
}

export interface ProducerTransportResponse {
  id?: string;
  iceParameters?: any;
  iceCandidates?: any;
  dtlsParameters?: any;
  error?: string;
}

export interface ProduceResponse {
  id?: string;
  error?: string;
}

export type ProducersRef = {
  video?: mediasoupClient.types.Producer | null;
  audio?: mediasoupClient.types.Producer | null;
  setupInProgress?: boolean;
};

export interface ConnectionInfo {
  sessionId: string;
  timestamp: number;
  isActive: boolean;
}

export interface SessionData {
  streamId: string;
  userId: string;
  deviceCapabilities: any;
  timestamp: number;
  isStreamer: boolean;
  sessionId: string;
}

// ===================== COMPONENT TYPES =====================
export interface WebRTCStreamManagerProps {
  streamId: string;
  userId: string;
  username: string;
  isStreamer: boolean;
  isCameraOn?: boolean;
  isMicrophoneOn?: boolean;
  isAnonymous?: boolean;
  onParticipantCount?: (count: number) => void;
  onConnectionError?: (error: {
    type: string;
    message: string;
    canReconnect: boolean;
    isLoopback?: boolean;
    details?: any;
  }) => void;
  onMediaError?: (
    errorType: string,
    errorMessage: string,
    details?: any
  ) => void;
  className?: string;
  onReconnectRequest?: (callback: () => void) => void;
  isLoopbackConnection?: boolean;
  optimizeForLoopback?: boolean;
  onLoopbackDetected?: (isLoopback: boolean) => void;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "streaming";

// Extend the MediaSoup Device type for our custom error property
declare module "mediasoup-client" {
  namespace types {
    interface Device {
      // Custom property to track device error state
      error?: boolean;
    }
  }
}

// Basic type for a MediaSoup device
export interface MediasoupDevice extends mediasoupClient.Device {
  loaded: boolean;
  error?: boolean;
  rtpCapabilities: mediasoupClient.types.RtpCapabilities;
}

// Producer transport response
export interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
  error?: string;
}

// Connection error format
export interface ConnectionError {
  type: string;
  message: string;
  canReconnect: boolean;
  isLoopback?: boolean;
  details?: any;
}

// Producer info
export interface ProducerInfo {
  producerId: string;
  kind: string;
  peerId: string;
}

// Storage types
export interface SessionInfo {
  streamId: string;
  userId: string;
  deviceCapabilities?: any;
  timestamp: number;
  isStreamer: boolean;
  sessionId: string;
}

// Socket event responses
export interface BroadcasterReadyConfirmedData {
  success: boolean;
  roomState?: {
    viewers: number;
    [key: string]: any;
  };
}

export interface ViewerReadyResponseData {
  broadcasterSocketId?: string;
  broadcasterUserId?: string;
  hasActiveStreamer: boolean;
  activeProducers?: ProducerInfo[];
}

export interface BroadcasterReadyData {
  broadcasterSocketId: string;
  broadcasterUserId: string;
  streamId: string;
  activeProducers?: ProducerInfo[];
}

export interface ViewerConnectedData {
  viewerSocketId: string;
  viewerUserId: string;
  streamId: string;
}

export interface ServerErrorData {
  message: string;
  code?: string;
  details?: any;
  canReconnect?: boolean;
}

export interface ParticipantCountData {
  count: number;
}

// Reference types for component internals
export interface TransportRefs {
  producer?: mediasoupClient.types.Transport | null;
  consumer?: mediasoupClient.types.Transport | null;
}

export interface ProducerRefs {
  video?: mediasoupClient.types.Producer | null;
  audio?: mediasoupClient.types.Producer | null;
  setupInProgress?: boolean;
}

export interface ConsumerRefs {
  video?: mediasoupClient.types.Consumer | null;
  audio?: mediasoupClient.types.Consumer | null;
} 