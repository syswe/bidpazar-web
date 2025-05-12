import { logger } from "@/lib/logger";

/**
 * Enhanced structured logging for WebRTC events
 */
export const logEvent = (
  event: string,
  socketId: string,
  data: Record<string, any> = {}
) => {
  logger.info(`[WebRTC:${event}]`, {
    socketId,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

/**
 * Enhanced error formatting helper
 */
export const formatError = (error: any) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
};

/**
 * Helper for formatting connection info for logging
 */
export const formatConnectionInfo = (socket: any) => {
  try {
    return {
      id: socket.id,
      ip: socket.handshake?.address || 'unknown',
      transport: socket.conn?.transport?.name || 'unknown',
      query: socket.handshake?.query || {},
      headers: {
        userAgent: socket.handshake?.headers?.['user-agent'] || 'unknown',
        host: socket.handshake?.headers?.host || 'unknown',
      },
    };
  } catch (e) {
    return { id: socket?.id || 'unknown', error: String(e) };
  }
}; 