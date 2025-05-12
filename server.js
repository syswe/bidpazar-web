// server.js
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { join } = require("path");
const fs = require("fs");
const { Server: SocketIOServer } = require("socket.io");
const cors = require("cors");
const path = require('path');
const { execSync } = require('child_process');

// Important: Set Next.js runtime flags before loading anything else
process.env.NODE_ENV = process.env.NODE_ENV || "development";
// These flags help with AsyncLocalStorage errors in custom servers
global.__NEXT_RUNTIME_CUSTOM_SERVER = true;
global.__NEXT_RUNTIME_WEBPACK = true;
global.__NEXT_HANDLED_LOADING_MIDDLEWARE = true;
global.__NEXT_INIT_RESOLVED = true;

// Work around Next.js AsyncLocalStorage issues
if (!global.AsyncLocalStorage) {
  const { AsyncLocalStorage } = require("async_hooks");
  global.AsyncLocalStorage = AsyncLocalStorage;
}

// Debug file structure - print directory contents
console.log("DEBUG: Current directory:", __dirname);
console.log("DEBUG: Listing root directory content:");
try {
  console.log(fs.readdirSync(__dirname));

  if (fs.existsSync(join(__dirname, "src"))) {
    console.log("DEBUG: src directory exists, listing content:");
    console.log(fs.readdirSync(join(__dirname, "src")));

    if (fs.existsSync(join(__dirname, "src", "lib"))) {
      console.log("DEBUG: src/lib directory exists, listing content:");
      console.log(fs.readdirSync(join(__dirname, "src", "lib")));

      if (fs.existsSync(join(__dirname, "src", "lib", "socket"))) {
        console.log("DEBUG: src/lib/socket directory exists, listing content:");
        console.log(fs.readdirSync(join(__dirname, "src", "lib", "socket")));
      } else {
        console.log("DEBUG: src/lib/socket directory NOT found");
      }
    } else {
      console.log("DEBUG: src/lib directory NOT found");
    }
  } else {
    console.log("DEBUG: src directory NOT found");
  }
} catch (e) {
  console.error("DEBUG: Error listing directories:", e);
}

// Set up module alias for @ path resolution used in TypeScript files
// This assumes that the 'src' directory (with compiled .js files)
// is available relative to __dirname after the build and Docker copy.
// For server.js at /app/server.js, __dirname is /app, so @ resolves to /app/src
try {
  require("module-alias").addAliases({
    "@": join(__dirname, "src"),
  });
  console.log(
    "DEBUG: Set up module-alias with @ pointing to:",
    join(__dirname, "src")
  );
} catch (e) {
  console.error("DEBUG: Error setting up module-alias:", e);
}

let initializeSocketIOServer;
let logger;

// Try to load in different ways with fallbacks
function tryRequireMultiplePaths(moduleName, paths) {
  let lastError = null;
  for (const path of paths) {
    try {
      console.log(`DEBUG: Trying to require '${path}'`);
      const module = require(path);
      console.log(`DEBUG: Successfully loaded '${path}'`);
      return module;
    } catch (e) {
      console.log(`DEBUG: Failed to load '${path}':`, e.message);
      lastError = e;
    }
  }
  throw lastError;
}

if (process.env.NODE_ENV === "production") {
  try {
    // Try to load the bundled JavaScript files from the dist directory
    console.log("Loading bundled JavaScript modules in production mode...");

    // For socketHandler
    try {
      const socketModule = require("./dist/socketHandler");
      initializeSocketIOServer = socketModule.initializeSocketIOServer;
      console.log("Successfully loaded socketHandler from bundled JavaScript");
    } catch (e) {
      console.error("CRITICAL: Failed to load socketHandler module:", e);
      throw e;
    }

    // For logger
    try {
      const loggerModule = require("./dist/logger");
      logger = loggerModule.logger;
      console.log("Successfully loaded logger from bundled JavaScript");
    } catch (e) {
      console.error("CRITICAL: Failed to load logger module:", e);
      throw e;
    }

    console.log("Successfully loaded all required modules in production mode");
  } catch (e) {
    console.error(
      "CRITICAL: Failed to load required modules in production:",
      e
    );
    console.error(
      "Ensure the compiled files are correctly included in the Docker container"
    );
    process.exit(1); // Exit if critical modules can\'t be loaded
  }
} else {
  // Development mode: use ts-node
  try {
    console.log(
      "Attempting to load modules via ts-node for development mode..."
    );
    require("ts-node").register({
      project: "./tsconfig.json", // Ensure tsconfig.json is available
      transpileOnly: true,
      compilerOptions: {
        module: "commonjs",
      },
    });
    // Use the alias, which ts-node will respect for .ts files
    initializeSocketIOServer =
      require("@/lib/socket/socketHandler").initializeSocketIOServer;
    logger = require("@/lib/logger").logger;
    console.log(
      "Successfully loaded modules via ts-node from source (development mode)."
    );
  } catch (e2) {
    console.error(
      "CRITICAL: Failed to load required modules via ts-node (development mode):",
      e2
    );
    process.exit(1);
  }
}

// Improved error handling for process
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  if (logger) {
    logger.error("Uncaught exception in server process:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
  }
  // Don't exit the process in production to maintain server uptime, unless it's a startup failure handled above.
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled promise rejection:", reason);
  if (logger) {
    logger.error("Unhandled promise rejection in server process:", {
      reason:
        reason instanceof Error
          ? {
              name: reason.name,
              message: reason.message,
              stack: reason.stack,
            }
          : reason,
    });
  }
});

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

console.log(
  `Starting server in ${dev ? "development" : "production"} mode on ${hostname}`
);
console.log(`Web and WebSocket server port: ${port}`);

// Create the Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Create HTTP server with correct Next.js handling
const httpServer = createServer((req, res) => {
  // Apply CORS headers directly
  if (dev) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
  }
  
  // Handle the request with Next.js
  return handle(req, res);
});

// Helper function to detect loopback addresses
const isLoopbackAddress = (address) => {
  if (!address) return false;

  // Remove IPv6 brackets if present
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.substring(1, address.length - 1);
  }

  return (
    address === "localhost" ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "0.0.0.0" ||
    address === "::" ||
    // Also check for full IPv6 localhost
    address === "0:0:0:0:0:0:0:1"
  );
};

// Track active socket connections to prevent duplicate handling
const connectionTracker = new Map();
const connectionCounter = {
  total: 0,
  active: 0,
  byStreamId: new Map()
};

// WebSocket upgrade tracking ONLY - not handling the actual upgrade
httpServer.on("upgrade", (request, socket, head) => {
  try {
    // Only track metrics for Socket.IO requests - don't handle the actual upgrade
    const isSocketIOPath = request.url.startsWith("/socket.io");
    
    if (!isSocketIOPath) {
      return; // Let Socket.IO handle non-Socket.IO requests
    }
    
    // Extract connection info from URL for tracking
    const url = new URL(`http://localhost${request.url}`);
    const streamId = url.searchParams.get("streamId");
    const userId = url.searchParams.get("userId");
    const connectionId = url.searchParams.get("connectionId");
    const isStreamer = url.searchParams.get("isStreamer") === "1";
    const clientIP = request.headers["x-forwarded-for"] || request.connection.remoteAddress;
    
    // Create signature for this connection
    const socketSignature = connectionId || `${clientIP}-${streamId}-${userId}`;
    
    // Skip if we can't uniquely identify this connection
    if (!socketSignature) {
      return;
    }
    
    // Update connection metrics
    connectionCounter.total++;
    connectionCounter.active++;
    
    // Track by stream too
    if (streamId) {
      const count = connectionCounter.byStreamId.get(streamId) || 0;
      connectionCounter.byStreamId.set(streamId, count + 1);
    }
    
    // Check if it's a streamer viewing their own stream
    const isStreamerViewingOwnStream = 
      isStreamer && 
      streamId && 
      userId && 
      streamId.includes(userId.substring(0, 8));
    
    if (isStreamerViewingOwnStream) {
      console.log(`[WebSocket] Streamer ${userId} viewing own stream ${streamId}`);
    }
    
    // Log debug info
    console.debug("[WebSocket] upgrade request for connection " + (connectionId || "null"), {
      clientIP,
      url: request.url,
      isSocketIO: isSocketIOPath,
      connectionCounter: {
        total: connectionCounter.total,
        active: connectionCounter.active,
        byStream: streamId ? connectionCounter.byStreamId.get(streamId) : null
      }
    });
    
    // Add a one-time close event listener to track disconnects
    socket.once("close", () => {
      connectionCounter.active--;
      
      if (streamId) {
        const count = connectionCounter.byStreamId.get(streamId) || 0;
        if (count > 0) {
          connectionCounter.byStreamId.set(streamId, count - 1);
        }
      }
      
      // Clear from connection tracker
      connectionTracker.delete(socketSignature);
    });
    
    // Store connection in tracker
    connectionTracker.set(socketSignature, {
      timestamp: Date.now(),
      clientIP,
      streamId,
      userId,
      isStreamer
    });
  } catch (error) {
    // Log error but don't interfere with Socket.IO's handling
    console.error("[WebSocket] Error in upgrade tracking:", error);
  }
});

// Log connection metrics every 60 seconds
setInterval(() => {
  if (connectionTracker.size > 0 || connectionCounter.active > 0) {
    logger.info(`Active WebSocket connections: ${connectionCounter.active}/${connectionCounter.total}`, {
      trackerSize: connectionTracker.size,
      byStreamId: Object.fromEntries(connectionCounter.byStreamId)
    });
  }
}, 60000);

// Prepare and start Next.js app
app
  .prepare()
  .then(async () => {
    try {
      // Initialize MediaSoup first
      await initializeMediaSoup();
      
      // Create Socket.IO server
      let io;
      
      // Only create Socket.IO if it hasn't been attached already
      if (httpServer.io) {
        console.log("Socket.IO already initialized on this server instance, reusing existing instance");
        io = httpServer.io;
      } else {
        console.log("Initializing Socket.IO server...");
        
        // Initialize Socket.IO with more resilient settings
        io = new SocketIOServer(httpServer, {
          cors: {
            origin: "*", // In production, restrict this to your domains
            methods: ["GET", "POST"],
            credentials: true,
          },
          // Prioritize websocket transport
          transports: ["websocket", "polling"],
          allowUpgrades: true,
          // Fix path issues by being consistent
          path: "/socket.io", // No trailing slash
          serveClient: false, // Don't serve client files
          connectTimeout: 45000, // 45 seconds
          // Polling settings
          pingTimeout: 60000, // Increased to 60s for better connection stability
          pingInterval: 25000,
          upgradeTimeout: 15000, // Increased to 15s
          // WebSocket specific settings
          maxHttpBufferSize: 1e8, // 100 MB max message size
          // Fix for trailing slash issues in Next.js 13+
          addTrailingSlash: false,
          // Connection state recovery for better reconnection
          connectionStateRecovery: {
            maxDisconnectionDuration: 5 * 60 * 1000, // 5 minutes
            skipMiddlewares: true,
          },
        });
        
        // Store a reference to the io instance on the httpServer object
        // This helps prevent duplicate initialization
        httpServer.io = io;
      }
      
      // Add loopback protection middleware for Socket.IO
      io.use((socket, next) => {
        const clientIP =
          socket.handshake.headers["x-forwarded-for"] ||
          socket.handshake.address;
        const host = socket.handshake.headers.host;

        // Store connection details in socket data for diagnostics
        socket.data.clientIP = clientIP;
        socket.data.host = host;
        socket.data.isLoopback =
          isLoopbackAddress(clientIP) || isLoopbackAddress(host?.split(":")[0]);

        // Log potential loopback connections
        if (socket.data.isLoopback) {
          logger.info(`Socket.IO loopback connection detected`, {
            clientIP,
            host,
            id: socket.id,
            transportName: socket.conn?.transport?.name,
          });

          // Set a flag to handle loopback connections differently
          socket.data.connectionType = "loopback";
        }

        next();
      });

      // Enhanced error handling for Socket.IO
      io.engine.on("connection_error", (err) => {
        console.error("[Socket.IO] Connection error:", {
          message: err.message,
          type: err.type,
          code: err.code,
          transport: err.transport?.name || "unknown",
          req: {
            url: err.req?.url,
            headers: err.req?.headers
              ? {
                  host: err.req.headers.host,
                  connection: err.req.headers.connection,
                  upgrade: err.req.headers.upgrade,
                }
              : "unavailable",
          },
        });
        logger.error("[Socket.IO] Connection error:", {
          message: err.message,
          type: err.type,
          code: err.code,
        });
      });

      // Call the socketHandler initialization to set up WebRTC event handlers
      if (initializeSocketIOServer) {
        await initializeSocketIOServer(httpServer, io);
        console.log(
          "Socket.IO and WebRTC event handlers initialized successfully"
        );
      } else {
        console.error(
          "CRITICAL: initializeSocketIOServer function not available!"
        );
        throw new Error("initializeSocketIOServer not found");
      }

      console.log("Socket.IO server initialized with config:", {
        path: io._opts.path,
        serveClient: io._opts.serveClient,
        transports: io._opts.transports,
      });
      console.log("Socket.IO server connected to HTTP server");

      // Direct access to namespaces for debugging
      Object.keys(io._nsps).forEach((namespace) => {
        console.log(`Active Socket.IO namespace: ${namespace}`);
      });

      // Instead, add better logging for Socket.IO connections
      io.on("connection", (socket) => {
        const clientIP = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
        const host = socket.handshake.headers.host;
        const userAgent = socket.handshake.headers["user-agent"];
        
        logger.info(`Socket.IO connection from ${clientIP}`, {
          socketId: socket.id,
          transport: socket.conn.transport.name,
          host,
          userAgent: userAgent?.substring(0, 100), // Limit length
          query: socket.handshake.query,
        });
        
        // Enhanced stream validation on connection
        if (socket.handshake.query.streamId) {
          const attemptedStreamId = String(socket.handshake.query.streamId);
          const isStreamer = socket.handshake.query.isStreamer === "1" || socket.handshake.query.isStreamer === "true";
          const userId = socket.handshake.query.userId ? String(socket.handshake.query.userId) : undefined;
          
          if (typeof validateStreamState === 'function') {
            // Use directly if available in scope
            validateStreamState(attemptedStreamId).then(validation => {
              handleStreamValidation(socket, validation, isStreamer, attemptedStreamId, userId);
            }).catch(err => {
              logger.error(`[Socket.IO] Error checking stream state on connection: ${err}`);
            });
          } else {
            // Import it if not already available
            try {
              const { validateStreamState } = require('./src/lib/socket/socketEvents');
              validateStreamState(attemptedStreamId).then(validation => {
                handleStreamValidation(socket, validation, isStreamer, attemptedStreamId, userId);
              }).catch(err => {
                logger.error(`[Socket.IO] Error checking stream state on connection: ${err}`);
              });
            } catch (e) {
              logger.error(`[Socket.IO] Failed to load validation functions: ${e}`);
            }
          }
        }
        
        socket.on("disconnect", (reason) => {
          logger.info(`Socket.IO disconnect: ${socket.id}`, { reason });
        });
        
        // Log transport upgrades
        socket.conn.on("upgrade", (transport) => {
          logger.info(`Socket.IO transport upgraded: ${transport.name}`, {
            socketId: socket.id,
            previousTransport: socket.conn.transport.name,
          });
        });
      });
      
      // Helper function for stream validation
      function handleStreamValidation(socket, validation, isStreamer, streamId, userId) {
        // Always check stream state, but apply different handling for streamers vs viewers
        if (validation.isValid) {
          // For streamers: More strict validation
          if (isStreamer) {
            if (validation.actualState === "ENDED") {
              logger.info(`[Socket.IO] Blocking streamer connection to ENDED stream: ${streamId}`, {
                socketId: socket.id,
                userId: userId
              });
              
              // Clear error message for streamers trying to reconnect to ended streams
              socket.emit("error", {
                message: "This stream has already ended. Please create a new stream using the 'New Stream' button.",
                code: "STREAM_ENDED",
                canReconnect: false,
                canCreateNewStream: true
              });
              
              // Small delay to ensure error is received before disconnect
              setTimeout(() => {
                if (socket.connected) {
                  socket.disconnect(true);
                }
              }, 500);
            } else if (validation.actualState === "FAILED_TO_START" || validation.actualState === "INTERRUPTED") {
              // Allow these states but log it - we'll handle transition in broadcaster_ready
              logger.info(`[Socket.IO] Streamer connecting to ${validation.actualState} stream: ${streamId}. Will attempt recovery.`, {
                socketId: socket.id,
                userId: userId
              });
            }
          } 
          // For viewers: Only block connections to non-existent streams
          else if (!["LIVE", "STARTING", "SCHEDULED", "PAUSED"].includes(validation.actualState)) {
            if (validation.actualState === "ENDED") {
              logger.info(`[Socket.IO] Notifying viewer that stream has ended: ${streamId}`);
              socket.emit("stream_ended", {
                streamId: streamId,
                reason: "Stream has already ended",
                finalState: "ENDED"
              });
            } else {
              logger.info(`[Socket.IO] Notifying viewer that stream is not available: ${validation.actualState}`);
              socket.emit("error", {
                message: `This stream is not currently available (${validation.actualState.toLowerCase().replace('_', ' ')})`,
                code: "STREAM_UNAVAILABLE",
                canReconnect: false
              });
            }
          }
        } else if (!validation.isValid && validation.error?.includes("not found")) {
          // Stream doesn't exist at all
          logger.warn(`[Socket.IO] Connection attempt to non-existent stream: ${streamId}`);
          socket.emit("error", {
            message: "This stream does not exist or has been removed",
            code: "STREAM_NOT_FOUND",
            canReconnect: false
          });
          
          // Disconnect after sending error
          setTimeout(() => {
            if (socket.connected) {
              socket.disconnect(true);
            }
          }, 500);
        }
      }
    } catch (err) {
      console.error(
        "Failed to initialize Socket.IO server or its handlers:",
        err
      );
      if (logger) {
        logger.error("Failed to initialize Socket.IO server or its handlers:", {
          error:
            err instanceof Error
              ? {
                  name: err.name,
                  message: err.message,
                  stack: err.stack,
                }
              : String(err),
        });
      }
      process.exit(1);
    }

    // Start the server with enhanced error handling
    httpServer.listen(port, hostname, (err) => {
      if (err) {
        console.error("Failed to start server:", err);
        if (logger) {
          logger.error("Failed to start server:", {
            error:
              err instanceof Error
                ? {
                    name: err.name,
                    message: err.message,
                    stack: err.stack,
                  }
                : String(err),
          });
        }
        process.exit(1);
      }
      console.log(`> Server ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO path: /socket.io`);
    });

    httpServer.on("error", (err) => {
      console.error("HTTP server error:", err);
      if (logger) {
        logger.error("HTTP server error:", {
          error:
            err instanceof Error
              ? {
                  name: err.name,
                  message: err.message,
                  stack: err.stack,
                }
              : String(err),
        });
      }
    });

    // Add forceful graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      if (logger) {
        logger.info(`Server shutdown initiated by ${signal}`);
      }

      // First stop accepting new connections
      httpServer.close(() => {
        console.log("HTTP server closed");

        try {
          // Give Socket.IO time to clean up existing connections
          console.log("Closing remaining socket connections...");
          if (httpServer.io) {
            const activeSockets = httpServer.io.sockets.sockets.size;
            
            if (activeSockets > 0) {
              console.log(
                `Closing ${activeSockets} active socket connections...`
              );

              // Close all active sockets
              httpServer.io.sockets.sockets.forEach((socket) => {
                socket.disconnect();
              });
            }

            httpServer.io.close();
            httpServer.io = null;
            console.log("Socket.IO server closed");
          }

          // Try to close MediaSoup worker gracefully
          if (
            global.mediasoupWorker &&
            typeof global.mediasoupWorker.close === "function"
          ) {
            console.log("Closing MediaSoup worker...");
            global.mediasoupWorker.close();
            console.log("MediaSoup worker closed");
          }

          console.log("Shutdown complete, exiting process");
          process.exit(0);
        } catch (err) {
          console.error("Error during shutdown:", err);
          if (logger) {
            logger.error("Error during shutdown:", {
              error:
                err instanceof Error
                  ? {
                      name: err.name,
                      message: err.message,
                      stack: err.stack,
                    }
                  : String(err),
            });
          }
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        console.error("Forced shutdown after timeout");
        if (logger) {
          logger.error("Forced shutdown after timeout");
        }
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  })
  .catch((err) => {
    console.error("Error during Next.js app.prepare():", err);
    if (logger) {
      logger.error("Error during Next.js app preparation:", {
        error:
          err instanceof Error
            ? {
                name: err.name,
                message: err.message,
                stack: err.stack,
              }
            : String(err),
      });
    }
    process.exit(1);
  });

// Check and fix MediaSoup worker binary permissions
function ensureMediasoupWorkerExecutable() {
  try {
    const mediasoupPath = require.resolve('mediasoup');
    // Fix path: Navigate to the correct location of the worker binary
    const mediasoupDir = path.dirname(mediasoupPath);
    const workerPath = path.join(mediasoupDir, '..', '..', 'worker', 'out', 'Release', 'mediasoup-worker');
    
    console.log("[MediaSoup] Checking for worker binary at:", workerPath);
    
    if (fs.existsSync(workerPath)) {
      const stats = fs.statSync(workerPath);
      // Make sure it's executable
      if (!(stats.mode & 0o111)) {
        console.log("[MediaSoup] Making MediaSoup worker executable:", workerPath);
        fs.chmodSync(workerPath, stats.mode | 0o111);
      } else {
        console.log("[MediaSoup] MediaSoup worker is already executable");
      }
      return true;
    } else {
      console.error("[MediaSoup] MediaSoup worker binary not found at:", workerPath);
      
      // List directories to help diagnose
      console.log("[MediaSoup] Contents of mediasoup directory:", fs.readdirSync(path.join(mediasoupDir, '..')));
      
      // Try rebuilding as a last resort
      try {
        console.log("[MediaSoup] Attempting to rebuild MediaSoup...");
        execSync('npm install --no-save mediasoup@3', { stdio: 'inherit' });
      } catch (rebuildErr) {
        console.error("[MediaSoup] Failed to rebuild MediaSoup:", rebuildErr.message);
      }
      return false;
    }
  } catch (error) {
    console.error("[MediaSoup] Error ensuring MediaSoup worker executable:", error.message);
    return false;
  }
}

// Set up MediaSoup for WebRTC
async function initializeMediaSoup() {
  try {
    // Make sure the binary is executable first
    if (!ensureMediasoupWorkerExecutable()) {
      throw new Error("Cannot find or make executable the MediaSoup worker binary");
    }
    
    // Get configuration from environment
    const mediasoup = require('mediasoup');
    const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
    const listenIp = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0';
    const minPort = parseInt(process.env.MEDIASOUP_MIN_PORT || '40000');
    const maxPort = parseInt(process.env.MEDIASOUP_MAX_PORT || '40100');
    const logLevel = process.env.MEDIASOUP_LOG_LEVEL || 'warn';
    
    console.log("[MediaSoup] Creating worker with configuration:");
    console.log(`[MediaSoup] - Announced IP: ${announcedIp}`);
    console.log(`[MediaSoup] - Listen IP: ${listenIp}`);
    console.log(`[MediaSoup] - Port range: ${minPort}-${maxPort}`);
    console.log(`[MediaSoup] - Log level: ${logLevel}`);
    
    // Create MediaSoup worker
    const worker = await mediasoup.createWorker({
      logLevel,
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: minPort,
      rtcMaxPort: maxPort,
    });
    
    worker.on('died', () => {
      console.error('[MediaSoup] Worker died unexpectedly! Exiting...');
      setTimeout(() => process.exit(1), 2000);
    });
    
    console.log(`[MediaSoup] Worker created successfully (pid: ${worker.pid})`);
    
    // Store worker in global scope for access in socket handlers
    global.mediasoupWorker = worker;
    
    // Create a router (required for WebRTC connections)
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1
          }
        }
      ]
    });
    
    // Store router in global scope
    global.mediasoupRouter = router;
    
    console.log('[MediaSoup] Router created successfully, WebRTC ready');
    return { worker, router };
  } catch (error) {
    console.error('[MediaSoup] Failed to initialize MediaSoup:', error);
    if (logger) {
      logger.error('[MediaSoup] Failed to initialize:', {
        error: error instanceof Error ? 
          { name: error.name, message: error.message, stack: error.stack } : 
          String(error)
      });
    }
    return null;
  }
}
