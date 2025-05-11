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

// WebSocket handling upgrade events directly
httpServer.on("upgrade", (request, socket, head) => {
  // Check if the request is for Socket.IO
  // Update detection to handle both /socket.io/ and /socket.io? patterns
  const isSocketIORequest = 
    request.url.startsWith("/socket.io/") || 
    request.url.startsWith("/socket.io?") || 
    request.url === "/socket.io";
  
  const clientIP =
    request.headers["x-forwarded-for"] || request.connection.remoteAddress;
  const host = request.headers.host;

  // Log the connection with additional client info
  logger.debug(`WebSocket upgrade request: ${request.url}`, {
    isSocketIO: isSocketIORequest,
    clientIP,
    host,
    headers: {
      origin: request.headers.origin,
      host: request.headers.host,
      "user-agent": request.headers["user-agent"],
    },
  });

  // Check for potential loopback issues
  const isLoopback =
    isLoopbackAddress(clientIP) || isLoopbackAddress(host?.split(":")[0]);

  if (isLoopback && process.env.NODE_ENV === "production") {
    logger.warn(`Potential loopback connection detected: ${request.url}`, {
      clientIP,
      host,
    });
    // In production we might want to add additional validation here
  }

  if (isSocketIORequest) {
    // Let Socket.IO handle its own connections
    // This will be handled by Socket.IO's internal handlers
    logger.debug(`Socket.IO upgrade request: ${request.url}`);
  } else {
    // For raw WebSocket connections (not Socket.IO)
    logger.info(`Raw WebSocket upgrade request for: ${request.url}`);

    // Accept the connection for non-Socket.IO WebSocket requests
    // This allows direct WebSocket connections to ws://localhost:3000/
    socket.write(
      "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" +
        "Upgrade: WebSocket\r\n" +
        "Connection: Upgrade\r\n" +
        "\r\n"
    );

    // Keep socket open for WebSocket communication
    socket.pipe(socket); // Echo back for simple testing
  }
});

// Initialize Socket.IO server
console.log("Initializing Socket.IO server...");

app
  .prepare()
  .then(async () => {
    // Use the existing HTTP server instead of creating a new one
    // Add request handler to the existing server
    httpServer.removeAllListeners('request');
    httpServer.on('request', async (req, res) => {
      try {
        // Special handling for Socket.IO requests
        const pathname = parse(req.url || "").pathname || "";

        // Debug log all requests to help diagnose issues
        if (pathname.includes("socket.io")) {
          console.log(
            `[Server] HTTP request for Socket.IO: ${req.method} ${req.url}`
          );
          console.log(
            `[Server] Headers: Connection=${req.headers.connection}, Upgrade=${req.headers.upgrade}`
          );
        }

        // For other requests, let Next.js handle them
        const parsedUrl = parse(req.url || "", true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Error handling request:", err);
        if (logger) {
          logger.error("Error handling HTTP request:", {
            url: req.url,
            method: req.method,
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
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("internal server error");
        }
      }
    });

    // Initialize Socket.IO on the same server
    console.log("Initializing Socket.IO server...");
    try {
      // Initialize Socket.IO with our enhanced error handling
      const io = new SocketIOServer(httpServer, {
        cors: {
          origin: "*", // In production, restrict this to your domains
          methods: ["GET", "POST"],
          credentials: true,
        },
        // Allow all transports with WebSocket preferred
        transports: ["websocket", "polling"],
        allowUpgrades: true,
        // Path and settings
        path: "/socket.io", // Ensure no trailing slash
        serveClient: false, // Don't serve client files to save bandwidth
        connectTimeout: 45000, // 45 seconds (more than default 20s)
        // Polling settings
        pingTimeout: 30000,
        pingInterval: 25000,
        upgradeTimeout: 10000,
        // WebSocket specific settings
        maxHttpBufferSize: 1e8, // 100 MB max message size
        // Explicit disable of trailing slash to fix compatibility with Next.js 13+
        addTrailingSlash: false,
        // Enable connection state recovery
        connectionStateRecovery: {
          // optional, see https://socket.io/docs/v4/connection-state-recovery/#options
          maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
          skipMiddlewares: true, // RECOMMENDED
        },
        // Detailed logging
        // @ts-ignore - logger option is available in socket.io
        logger: {
          debug: (...args) => logger.debug("[Socket.IO] Debug", ...args),
          info: (...args) => logger.info("[Socket.IO] Info", ...args),
          warn: (...args) => logger.warn("[Socket.IO] Warning", ...args),
          error: (...args) => logger.error("[Socket.IO] Error", ...args),
        },
      });

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

    // IMPORTANT CHANGE: Let Socket.IO handle its own upgrade requests
    // No need to manually handle Socket.IO upgrades, as it automatically
    // attaches its own event handlers to the HTTP server

    // Only handle non-Socket.IO WebSocket upgrade requests
    httpServer.on("upgrade", (req, socket, head) => {
      // Log the request for debugging
      console.log(`[Server] WebSocket upgrade request for: ${req.url}`);

      // Detect and handle loopback connections
      const clientIP =
        req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      const host = req.headers.host;
      const isLoopback =
        isLoopbackAddress(clientIP) || isLoopbackAddress(host?.split(":")[0]);

      if (isLoopback) {
        logger.info(
          `[Server] Loopback WebSocket connection from ${clientIP} for ${req.url}`
        );
      }

      // Only attempt to handle if it's NOT a Socket.IO request
      // Socket.IO attaches its own handlers and will handle its own requests
      // Use the same improved detection logic
      if (!req.url.startsWith("/socket.io") && !req.url.includes("/socket.io?")) {
        console.log(
          `[Server] Unhandled WebSocket upgrade request for: ${req.url}`
        );
        // For non-Socket.IO connections, close the socket
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      }
      // Otherwise, let Socket.IO's own handlers manage its requests
    });

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

    // Add graceful shutdown handling
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
            console.log(
              `Closing ${activeSockets} active socket connections...`
            );

            httpServer.io.close();
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
    const workerPath = path.join(path.dirname(mediasoupPath), '..', 'worker', 'out', 'Release', 'mediasoup-worker');
    
    if (fs.existsSync(workerPath)) {
      const stats = fs.statSync(workerPath);
      // Make sure it's executable
      if (!(stats.mode & 0o111)) {
        console.log("Making MediaSoup worker executable:", workerPath);
        fs.chmodSync(workerPath, stats.mode | 0o111);
      }
    } else {
      console.error("MediaSoup worker binary not found at:", workerPath);
      
      // Try rebuilding as a last resort
      try {
        console.log("Attempting to rebuild MediaSoup...");
        execSync('npm install --no-save mediasoup@3', { stdio: 'inherit' });
      } catch (rebuildErr) {
        console.error("Failed to rebuild MediaSoup:", rebuildErr.message);
      }
    }
  } catch (error) {
    console.error("Error ensuring MediaSoup worker executable:", error.message);
  }
}

// Ensure MediaSoup worker is executable
ensureMediasoupWorkerExecutable();
