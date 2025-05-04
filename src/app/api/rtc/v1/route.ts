import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer } from 'ws';
import { mediasoupConfig } from '../mediasoup/config';
import { logger } from '@/lib/logger';
import { verifyToken } from '@/lib/auth';

// Enhanced advanced diagnostics
const DIAGNOSTICS = {
  connectionAttempts: 0,
  authSuccesses: 0,
  authFailures: 0,
  startTime: Date.now(),
  lastConnectionTime: null as string | null,
  connectionIps: new Map<string, number>(),
  errorCounts: new Map<string, number>(),
  requestMetrics: {
    totalRequests: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0,
    minProcessingTime: Number.MAX_SAFE_INTEGER,
    maxProcessingTime: 0
  }
};

// Enhanced logging with trace ID
const createTraceLogger = (traceId: string) => {
  return {
    trace: (message: string, data: Record<string, any> = {}) => {
      logger.debug(`[WebSocket:rtc/v1][${traceId}] 🔍 TRACE: ${message}`, { ...data, traceId });
    },
    debug: (message: string, data: Record<string, any> = {}) => {
      logger.debug(`[WebSocket:rtc/v1][${traceId}] 🐛 DEBUG: ${message}`, { ...data, traceId });
    },
    info: (message: string, data: Record<string, any> = {}) => {
      logger.info(`[WebSocket:rtc/v1][${traceId}] ℹ️ INFO: ${message}`, { ...data, traceId });
    },
    warn: (message: string, data: Record<string, any> = {}) => {
      logger.warn(`[WebSocket:rtc/v1][${traceId}] ⚠️ WARN: ${message}`, { ...data, traceId });
    },
    error: (message: string, data: Record<string, any> = {}) => {
      const errorObj = data.error;
      const errorKey = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Unknown error');
      DIAGNOSTICS.errorCounts.set(errorKey, (DIAGNOSTICS.errorCounts.get(errorKey) || 0) + 1);
      logger.error(`[WebSocket:rtc/v1][${traceId}] 🔴 ERROR: ${message}`, { ...data, traceId });
    }
  };
};

// In-memory store for active WebSocket connections
interface WebSocketConnection {
  socket: WebSocket;
  userId: string;
  username: string;
  streamId: string;
  connectedAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
  diagnostics: {
    messagesSent: number,
    messagesReceived: number,
    errors: number,
    reconnects: number,
    pingLatency: number[]
  };
}

// Client data interface for WebSocket connection context
interface ClientData {
  streamId: string;
  userId: string;
  username: string;
}

const connections = new Map<string, WebSocketConnection>();

// Generate performance diagnostics
function getDiagnosticsSummary() {
  const now = Date.now();
  const uptime = now - DIAGNOSTICS.startTime;
  
  const errorSummary = Array.from(DIAGNOSTICS.errorCounts.entries())
    .map(([key, count]) => ({ type: key, count }))
    .sort((a, b) => b.count - a.count);
  
  const ipSummary = Array.from(DIAGNOSTICS.connectionIps.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 IPs
  
  return {
    uptime: {
      ms: uptime,
      seconds: Math.floor(uptime / 1000),
      minutes: Math.floor(uptime / 60000),
      hours: Math.floor(uptime / 3600000)
    },
    connections: {
      total: DIAGNOSTICS.connectionAttempts,
      active: connections.size,
      authSuccesses: DIAGNOSTICS.authSuccesses,
      authFailures: DIAGNOSTICS.authFailures
    },
    performance: {
      ...DIAGNOSTICS.requestMetrics,
      requestsPerMinute: DIAGNOSTICS.requestMetrics.totalRequests / (uptime / 60000)
    },
    errors: {
      unique: DIAGNOSTICS.errorCounts.size,
      total: Array.from(DIAGNOSTICS.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      topErrors: errorSummary.slice(0, 5) // Top 5 errors
    },
    ips: ipSummary,
    lastConnectionTime: DIAGNOSTICS.lastConnectionTime,
    timestamp: now
  };
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const traceId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const log = createTraceLogger(traceId);
  
  DIAGNOSTICS.connectionAttempts++;
  DIAGNOSTICS.requestMetrics.totalRequests++;
  DIAGNOSTICS.lastConnectionTime = new Date().toISOString();
  
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  DIAGNOSTICS.connectionIps.set(clientIp, (DIAGNOSTICS.connectionIps.get(clientIp) || 0) + 1);

  // Check if the request is a WebSocket upgrade request
  const upgrade = req.headers.get('upgrade');
  
  log.info('Received API request', { 
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    ip: clientIp,
    isWebSocketUpgrade: upgrade === 'websocket',
    userAgent: req.headers.get('user-agent') || 'unknown'
  });
  
  if (upgrade !== 'websocket') {
    log.warn('Received non-WebSocket request to WebSocket endpoint', { upgrade });
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Update metrics
    DIAGNOSTICS.requestMetrics.totalProcessingTime += processingTime;
    DIAGNOSTICS.requestMetrics.minProcessingTime = Math.min(DIAGNOSTICS.requestMetrics.minProcessingTime, processingTime);
    DIAGNOSTICS.requestMetrics.maxProcessingTime = Math.max(DIAGNOSTICS.requestMetrics.maxProcessingTime, processingTime);
    DIAGNOSTICS.requestMetrics.averageProcessingTime = DIAGNOSTICS.requestMetrics.totalProcessingTime / DIAGNOSTICS.requestMetrics.totalRequests;
    
    return new NextResponse('Expected WebSocket connection', { 
      status: 400,
      headers: {
        'X-Trace-ID': traceId,
        'X-Processing-Time': `${processingTime}ms`
      }
    });
  }

  try {
    // Parse connection parameters
    const { searchParams } = new URL(req.url);
    const streamId = searchParams.get('streamId');
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const token = searchParams.get('token');

    log.debug('Parsed connection parameters', { streamId, userId, username, hasToken: !!token });

    // Validate required parameters
    if (!streamId || !userId || !username) {
      log.warn('Missing required connection parameters', { streamId, userId, username });
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Update metrics
      DIAGNOSTICS.requestMetrics.totalProcessingTime += processingTime;
      DIAGNOSTICS.requestMetrics.minProcessingTime = Math.min(DIAGNOSTICS.requestMetrics.minProcessingTime, processingTime);
      DIAGNOSTICS.requestMetrics.maxProcessingTime = Math.max(DIAGNOSTICS.requestMetrics.maxProcessingTime, processingTime);
      DIAGNOSTICS.requestMetrics.averageProcessingTime = DIAGNOSTICS.requestMetrics.totalProcessingTime / DIAGNOSTICS.requestMetrics.totalRequests;
      
      return new NextResponse('Missing required connection parameters', { 
        status: 400,
        headers: {
          'X-Trace-ID': traceId,
          'X-Processing-Time': `${processingTime}ms`
        }
      });
    }

    // Verify authentication token if provided
    if (token) {
      try {
        log.debug('Attempting to verify token');
        const user = await verifyToken(token);
        
        if (!user) {
          log.warn('Token verification returned no user', { userId });
          DIAGNOSTICS.authFailures++;
          // Continue anyway for anonymous users who may have sent an invalid token
          log.info('Continuing as anonymous user despite invalid token', { userId, username });
        } else {
          DIAGNOSTICS.authSuccesses++;
          log.info('User authenticated successfully', { 
            userId: user.userId,
            tokenUserId: userId,
            streamId,
            isMatch: user.userId === userId
          });
        }
      } catch (error) {
        log.error('Token verification error', { error, token: token.substring(0, 10) + '...' });
        DIAGNOSTICS.authFailures++;
        // Continue anyway for anonymous users
        log.info('Continuing as anonymous user despite token verification error', { userId, username });
      }
    } else {
      // Allow anonymous connections without a token
      log.info('Anonymous connection without authentication token', { userId, username });
    }

    // Next.js doesn't support direct WebSocket handling in API routes
    // Return a message instructing to use a proper WebSocket server
    log.warn('WebSocket connection attempted with Next.js API route', {
      streamId,
      userId,
      diagnosticsSummary: getDiagnosticsSummary()
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Update metrics
    DIAGNOSTICS.requestMetrics.totalProcessingTime += processingTime;
    DIAGNOSTICS.requestMetrics.minProcessingTime = Math.min(DIAGNOSTICS.requestMetrics.minProcessingTime, processingTime);
    DIAGNOSTICS.requestMetrics.maxProcessingTime = Math.max(DIAGNOSTICS.requestMetrics.maxProcessingTime, processingTime);
    DIAGNOSTICS.requestMetrics.averageProcessingTime = DIAGNOSTICS.requestMetrics.totalProcessingTime / DIAGNOSTICS.requestMetrics.totalRequests;
    
    return new NextResponse(
      JSON.stringify({
        error: 'WebSocket connections not supported directly in Next.js API routes',
        message: 'Please use the Socket.IO endpoint at /api/rtc/socket for WebRTC signaling',
        serverInfo: {
          streamId,
          userId,
          timestamp: Date.now(),
          traceId,
          processingTime: `${processingTime}ms`,
          serverUptime: `${Math.floor((Date.now() - DIAGNOSTICS.startTime) / 1000)}s`,
          activeConnections: connections.size
        },
        solution: `To connect to the WebRTC service, use the Socket.IO endpoint at /api/rtc/socket 
                 which is properly configured for real-time communication in the Next.js environment.`,
        alternativeEndpoint: '/api/rtc/socket'
      }),
      { 
        status: 426,
        headers: {
          'Content-Type': 'application/json',
          'Upgrade': 'websocket',
          'X-Trace-ID': traceId,
          'X-Processing-Time': `${processingTime}ms`
        }
      }
    );
  } catch (error) {
    log.error('Connection error', { error });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    // Update metrics
    DIAGNOSTICS.requestMetrics.totalProcessingTime += processingTime;
    DIAGNOSTICS.requestMetrics.minProcessingTime = Math.min(DIAGNOSTICS.requestMetrics.minProcessingTime, processingTime);
    DIAGNOSTICS.requestMetrics.maxProcessingTime = Math.max(DIAGNOSTICS.requestMetrics.maxProcessingTime, processingTime);
    DIAGNOSTICS.requestMetrics.averageProcessingTime = DIAGNOSTICS.requestMetrics.totalProcessingTime / DIAGNOSTICS.requestMetrics.totalRequests;
    
    return new NextResponse('Internal server error', { 
      status: 500,
      headers: {
        'X-Trace-ID': traceId,
        'X-Processing-Time': `${processingTime}ms`
      }
    });
  }
}

// Handle incoming WebSocket messages - Mock implementation 
// This won't actually run in Next.js API routes
function handleWebSocketMessage(connectionId: string, message: any) {
  const connection = connections.get(connectionId);
  if (!connection) {
    logger.error('[WebSocket:rtc/v1] Connection not found', { connectionId });
    return;
  }

  const { streamId, userId, username, socket } = connection;
  const { type } = message;
  
  // Update last activity timestamp
  connection.lastActivity = Date.now();
  connection.diagnostics.messagesReceived++;

  logger.debug('[WebSocket:rtc/v1] Received message', { 
    type, 
    connectionId, 
    streamId,
    messageSize: JSON.stringify(message).length,
    timestamp: new Date().toISOString()
  });

  // Handle message based on type - simplified mock implementation
  switch (type) {
    case 'getRouterRtpCapabilities':
      // Mock response with the router capabilities
      try {
        const response = JSON.stringify({
          type: 'routerCapabilities',
          data: mediasoupConfig.routerOptions
        });
        
        socket.send(response);
        connection.diagnostics.messagesSent++;
        
        logger.debug('[WebSocket:rtc/v1] Sent router capabilities', { 
          connectionId,
          responseSize: response.length
        });
      } catch (error) {
        logger.error('[WebSocket:rtc/v1] Error sending capabilities', { error, connectionId });
        connection.diagnostics.errors++;
      }
      break;
      
    case 'ping':
      // Handle ping messages (for latency testing)
      try {
        const pingTimestamp = message.timestamp;
        const now = Date.now();
        const latency = now - pingTimestamp;
        
        // Store latency for diagnostics
        connection.diagnostics.pingLatency.push(latency);
        if (connection.diagnostics.pingLatency.length > 10) {
          connection.diagnostics.pingLatency.shift(); // Keep last 10 values
        }
        
        const response = JSON.stringify({
          type: 'pong',
          timestamp: pingTimestamp,
          serverTime: now,
          latency
        });
        
        socket.send(response);
        connection.diagnostics.messagesSent++;
        
        logger.debug('[WebSocket:rtc/v1] Replied to ping', { 
          connectionId, 
          latency,
          timestamp: now
        });
      } catch (error) {
        logger.error('[WebSocket:rtc/v1] Error sending pong', { error, connectionId });
        connection.diagnostics.errors++;
      }
      break;

    // Other cases would be implemented here in a real WebSocket server
    default:
      logger.debug('[WebSocket:rtc/v1] Unhandled message type', { 
        type,
        connectionId,
        messageKeys: Object.keys(message)
      });
      break;
  }
}

// Handle POST requests (for non-WebSocket clients)
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const traceId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const log = createTraceLogger(traceId);
  
  DIAGNOSTICS.requestMetrics.totalRequests++;
  
  log.info('Received POST request', { 
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  // Try to parse the request body if present
  let body = null;
  try {
    body = await req.json();
    log.debug('Parsed request body', { body });
  } catch (e) {
    log.debug('No JSON body in request');
  }
  
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  
  // Update metrics
  DIAGNOSTICS.requestMetrics.totalProcessingTime += processingTime;
  DIAGNOSTICS.requestMetrics.minProcessingTime = Math.min(DIAGNOSTICS.requestMetrics.minProcessingTime, processingTime);
  DIAGNOSTICS.requestMetrics.maxProcessingTime = Math.max(DIAGNOSTICS.requestMetrics.maxProcessingTime, processingTime);
  DIAGNOSTICS.requestMetrics.averageProcessingTime = DIAGNOSTICS.requestMetrics.totalProcessingTime / DIAGNOSTICS.requestMetrics.totalRequests;
  
  // Return information about the required WebSocket setup
  return NextResponse.json({
    message: 'WebRTC signaling requires WebSocket connection',
    setup: {
      endpoint: '/api/rtc/socket',  // Redirecting to the Socket.IO endpoint
      parameters: ['streamId', 'userId', 'username', 'token'],
      protocol: 'Socket.IO'
    },
    diagnostics: getDiagnosticsSummary(),
    documentation: {
      nextjsLimitation: 'Next.js API routes do not support WebSockets natively',
      solution: 'Use the Socket.IO endpoint at /api/rtc/socket for WebRTC signaling',
      links: [
        'https://nextjs.org/docs/pages/building-your-application/routing/api-routes',
        'https://socket.io/docs/v4/',
        'https://mediasoup.org/documentation/'
      ]
    },
    _meta: {
      traceId,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    }
  }, {
    headers: {
      'X-Trace-ID': traceId,
      'X-Processing-Time': `${processingTime}ms`
    }
  });
} 