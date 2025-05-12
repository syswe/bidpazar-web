import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import * as mediasoup from "mediasoup";
import { types as MediasoupTypes } from "mediasoup";

// Peer type definition
export type Peer = {
  socketId: string;
  userId: string;
  username: string;
  sessionId: string;
  isStreamer: boolean;
  transports: Map<string, mediasoup.types.Transport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  lastActivity: number;
  rtpCapabilities?: mediasoup.types.RtpCapabilities;
  connectionType?: string; // Added to track loopback connections
};

// Room structure
export interface Room {
  router: MediasoupTypes.Router;
  peers: Map<string, Peer>;
  activeSessions: Map<string, string>;
}

// Extended HttpServer with Socket.IO
export interface ExtendedHttpServer extends HttpServer {
  io?: SocketIOServer;
}

// Chat message structure
export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

// Room creation context
export interface RoomCreationContext {
  streamId: string;
  userId?: string;
  isStreamer?: boolean;
}

// Main context passed to event handlers
export interface SocketHandlerContext {
  io: SocketIOServer;
  rooms: Map<string, Room>;
  roomCreationLocks: Map<string, Promise<Room>>;
  activeSessions: Map<string, string>;
  chatMessages: Record<string, ChatMessage[]>;
  broadcasterHeartbeats: Map<string, number>;
  mediasoupWorker: MediasoupTypes.Worker | null;
  httpServer: HttpServer;
}

// MediaSoup app configuration
export const mediasoupAppConfig = {
  router: {
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: { "x-google-start-bitrate": 1000 },
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
        },
      },
    ] as MediasoupTypes.RtpCodecCapability[],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
      },
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || "40000"),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || "40100"),
    logLevel: "warn" as MediasoupTypes.WorkerLogLevel,
    logTags: [
      "info",
      "ice",
      "dtls",
      "rtp",
      "srtp",
      "rtcp",
    ] as MediasoupTypes.WorkerLogTag[],
  },
};

// Constants
export const MAX_CHAT_HISTORY = 100;
export const HEARTBEAT_INTERVAL = 15000; // 15 seconds
export const HEARTBEAT_TIMEOUT = 45000;  // 45 seconds
export const SESSION_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

// Socket timeouts
export const DEFAULT_SOCKET_TIMEOUT = 30000; // 30 seconds 