// server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { join } = require('path');

// Important: Set Next.js runtime flags before loading anything else
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
// These flags help with AsyncLocalStorage errors in custom servers
global.__NEXT_RUNTIME_CUSTOM_SERVER = true;
global.__NEXT_RUNTIME_WEBPACK = true;
global.__NEXT_HANDLED_LOADING_MIDDLEWARE = true;
global.__NEXT_INIT_RESOLVED = true;

// Work around Next.js AsyncLocalStorage issues
if (!global.AsyncLocalStorage) {
  const { AsyncLocalStorage } = require('async_hooks');
  global.AsyncLocalStorage = AsyncLocalStorage;
}

// We can't require a TypeScript file directly in Node.js, so we need
// to require the compiled version from the .next directory after Next.js has built it
let initializeSocketIOServer;
let logger;

// Set up module alias for @ path resolution used in TypeScript files
require('module-alias').addAliases({
  '@': join(__dirname, 'src')
});

try {
  // Try to require from compiled output first (production)
  initializeSocketIOServer = require('./.next/server/lib/socket/socketHandler').initializeSocketIOServer;
  logger = require('./.next/server/lib/logger').logger;
  console.log('Successfully loaded modules from compiled Next.js output.');
} catch (e) {
  console.warn('Could not load modules from .next build directory, looking in src (dev mode)');
  try {
    // Try to require from TypeScript source via ts-node (development)
    // Note: This requires ts-node to be installed and available in the environment
    require('ts-node').register({ 
      project: './tsconfig.json',
      transpileOnly: true, // Faster but no type checking
      compilerOptions: {
        // Override the module resolution for ts-node
        module: 'commonjs'
      }
    });
    
    initializeSocketIOServer = require('./src/lib/socket/socketHandler').initializeSocketIOServer;
    logger = require('./src/lib/logger').logger;
    console.log('Successfully loaded modules via ts-node from source.');
  } catch (e2) {
    console.error('Failed to load required modules:', e2);
    console.error('Please make sure you have built the project with `npm run build` first,');
    console.error('or have installed ts-node with `npm install -D ts-node` for development mode.');
    process.exit(1);
  }
}

// Better error handling for process
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit the process in production to maintain server uptime
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const socketPort = parseInt(process.env.PORT_SOCKET || '3001', 10);

console.log(`Starting server in ${dev ? 'development' : 'production'} mode on ${hostname}`);
console.log(`Web server port: ${port}, Socket.IO server port: ${socketPort}`);

// Create a separate HTTP server for Socket.IO
const socketHttpServer = createServer();

// Start by initializing the Socket.IO server
console.log('Initializing Socket.IO server...');
initializeSocketIOServer(socketHttpServer);
console.log('Socket.IO server initialized on a separate HTTP server');

// Start the Socket.IO server first
socketHttpServer.listen(socketPort, hostname, (err) => {
  if (err) {
    console.error('Failed to start Socket.IO server:', err);
    process.exit(1);
  }
  console.log(`> Socket.IO server running on http://${hostname}:${socketPort}`);
  
  // Then start Next.js after Socket.IO is running
  startNextJsServer();
});

// Function to start the Next.js server
function startNextJsServer() {
  // Create the Next.js app instance
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    const nextHttpServer = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url || '', true);
        
        // For WebSocket requests, redirect to the Socket.IO server
        if (parsedUrl.pathname?.startsWith('/socket.io/')) {
          // Redirect socket.io requests to the separate socket.io server
          res.writeHead(302, {
            'Location': `http://${hostname}:${socketPort}${req.url}`
          });
          res.end();
          return;
        }
        
        // Otherwise, handle with Next.js
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('internal server error');
        }
      }
    });

    nextHttpServer.listen(port, hostname, (err) => {
      if (err) {
        console.error('Failed to start Next.js server:', err);
        process.exit(1);
      }
      console.log(`> Next.js server ready on http://${hostname}:${port}`);
      console.log(`> Full system running - Web: port ${port}, Socket.IO: port ${socketPort}`);
    });
  }).catch(err => {
    console.error('Error during Next.js app.prepare():', err);
    process.exit(1);
  });
} 