import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Route handlers must be one of the supported HTTP methods.
// All other functions and logic have been moved to src/lib/socket/socketHandler.ts

export async function GET(request: NextRequest) {
  logger.info('[API /api/rtc/socket] GET request received. This route is only for confirming endpoint existence. WebSocket connections should go to the dedicated Socket.IO server port.');
  
  return new NextResponse('WebSocket endpoint. Use the Socket.IO server on the dedicated port (e.g., 3001).', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}

export async function POST(request: NextRequest) {
  logger.info('[API /api/rtc/socket] POST request received (e.g., for health check). WebSocket connections should go to the dedicated Socket.IO server port.');
  // You could add logic here to check if mediasoupWorker is alive (if state is shared appropriately),
  // but the primary worker interaction happens in the separate Socket.IO server process.
  return NextResponse.json({ status: 'ok', message: 'Socket.IO server is expected to be operational on its dedicated port.' });
} 