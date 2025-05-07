// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { IncomingMessage, ServerResponse } from 'http';

// Fix import path for the socket handler
import { initializeSocketIOServer } from './src/lib/socket/socketHandler';
import { logger } from './src/lib/logger';

const dev = process.env.NODE_ENV !== 'development';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create the Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      // Add any custom routing/handling before Next.js if needed here
      await handle(req, res, parsedUrl);
    } catch (err: unknown) {
      logger.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach Socket.IO server to the HTTP server
  initializeSocketIOServer(httpServer);

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
    logger.info(`> Ready on http://${hostname}:${port}`);
    logger.info(`> Socket.IO server initialized and attached to path /socket.io/`);
  });
}).catch((err: unknown) => {
  logger.error('Error during Next.js app.prepare():', err);
  process.exit(1);
});
