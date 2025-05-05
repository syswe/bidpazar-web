import { NextRequest } from 'next/server';
import { Server as SocketIO } from 'socket.io';
import * as mediasoup from 'mediasoup';
import { types } from 'mediasoup';
import { logger } from '@/lib/logger';

// Global variables to store MediaSoup resources
let io: SocketIO | null = null;
let mediasoupWorkers: types.Worker[] = [];
let nextWorkerIndex = 0;

// Map to store room data
// Key: streamId, Value: room data
const rooms = new Map<string, {
  router: types.Router;
  peers: Map<string, {
    id: string;
    username: string;
    isStreamer: boolean;
    transports: Map<string, types.WebRtcTransport>;
    producers: Map<string, types.Producer>;
    consumers: Map<string, types.Consumer>;
  }>;
}>();

// Initialize MediaSoup workers
async function createMediasoupWorkers() {
  const numWorkers = Number(process.env.MEDIASOUP_WORKERS) || 1;
  logger.info(`[MediaSoup] Creating ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
      rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 40100,
    });

    worker.on('died', () => {
      logger.error(`[MediaSoup] Worker died, exiting in 2 seconds... [pid:${worker.pid}]`);
      setTimeout(() => process.exit(1), 2000);
    });

    mediasoupWorkers.push(worker);
    logger.info(`[MediaSoup] Worker ${i+1} created [pid:${worker.pid}]`);
  }
}

// Get the next available worker using round-robin
function getMediasoupWorker() {
  const worker = mediasoupWorkers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % mediasoupWorkers.length;
  return worker;
}

// WebSocket endpoint
export async function GET(req: NextRequest) {
  logger.info('[MediaSoup:Socket] WebSocket connection request', {
    url: req.url
  });

  // Initialize MediaSoup workers if not already done
  if (mediasoupWorkers.length === 0) {
    await createMediasoupWorkers();
  }

  // Return a simple response - WebSockets are handled by the Next.js middleware
  return new Response("WebSocket server is running", {
    status: 101,
    headers: {
      "Connection": "Upgrade",
      "Upgrade": "websocket"
    }
  });
}

// Also export POST for fallback
export async function POST(request: Request) {
  return new Response('Socket.IO server is running', { status: 200 });
} 