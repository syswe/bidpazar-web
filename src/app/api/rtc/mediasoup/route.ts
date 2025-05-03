import { NextResponse } from 'next/server';
import type { types } from 'mediasoup';
import * as mediasoup from 'mediasoup';
import { verifyToken } from '@/lib/auth';

// MediaSoup workers
let workers: types.Worker[] = [];
let nextWorkerIndex = 0;

// Initialize MediaSoup workers
async function initWorkers() {
  const { numWorkers } = {
    numWorkers: parseInt(process.env.MEDIASOUP_WORKERS || '1'),
  };

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000'),
      rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '40100'),
    });

    worker.on('died', () => {
      console.error('MediaSoup worker died, exiting in 2 seconds...');
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
}

// Get next worker
function getNextWorker() {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

// Initialize workers on startup
initWorkers().catch(console.error);

// Store active rooms
const rooms = new Map<string, {
  router: types.Router;
  transports: Map<string, types.WebRtcTransport>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
}>();

export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, roomId, rtpCapabilities } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    let room = rooms.get(roomId);
    if (!room) {
      const worker = getNextWorker();
      const router = await worker.createRouter({
        mediaCodecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
          },
          {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
            parameters: {
              'x-google-start-bitrate': 1000,
            },
          },
        ],
      });

      room = {
        router,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      rooms.set(roomId, room);
    }

    switch (action) {
      case 'createTransport': {
        const { type } = body;
        const transport = await room.router.createWebRtcTransport({
          listenIps: [
            {
              ip: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
              announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
            },
          ],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });

        room.transports.set(transport.id, transport);

        return NextResponse.json({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      }

      case 'connectTransport': {
        const { transportId, dtlsParameters } = body;
        const transport = room.transports.get(transportId);
        if (!transport) {
          return NextResponse.json({ error: 'Transport not found' }, { status: 404 });
        }

        await transport.connect({ dtlsParameters });
        return NextResponse.json({ connected: true });
      }

      case 'produce': {
        const { transportId, kind, rtpParameters } = body;
        const transport = room.transports.get(transportId);
        if (!transport) {
          return NextResponse.json({ error: 'Transport not found' }, { status: 404 });
        }

        const producer = await transport.produce({
          kind,
          rtpParameters,
        });

        room.producers.set(producer.id, producer);
        return NextResponse.json({ id: producer.id });
      }

      case 'consume': {
        const { transportId, producerId } = body;
        const transport = room.transports.get(transportId);
        if (!transport) {
          return NextResponse.json({ error: 'Transport not found' }, { status: 404 });
        }

        const producer = room.producers.get(producerId);
        if (!producer) {
          return NextResponse.json({ error: 'Producer not found' }, { status: 404 });
        }

        if (!room.router.canConsume({
          producerId,
          rtpCapabilities,
        })) {
          return NextResponse.json({ error: 'Cannot consume' }, { status: 400 });
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        room.consumers.set(consumer.id, consumer);
        return NextResponse.json({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('MediaSoup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 