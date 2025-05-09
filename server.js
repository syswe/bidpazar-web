// server.js
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { join } = require("path");
const fs = require("fs");

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

// Add WebSocket upgrade request handler
const handleUpgrade = (req, socket, head) => {
  const pathname = parse(req.url).pathname;

  // Add debug logging for WebSocket upgrade requests
  console.log(
    `[Server] WebSocket upgrade request for: ${pathname || "unknown path"}`
  );
  console.log(
    `[Server] Headers: ${JSON.stringify({
      upgrade: req.headers.upgrade,
      connection: req.headers.connection,
      "sec-websocket-key": req.headers["sec-websocket-key"]
        ? "present"
        : "missing",
    })}`
  );

  // Always let the Socket.IO server handle the upgrade
  if (req.url.includes("/socket.io/")) {
    console.log(`[Server] Detected Socket.IO upgrade request: ${req.url}`);
    // The Socket.IO server instance will handle this
    return;
  }

  // For other WebSocket routes (if any), handle them here
  console.log(`[Server] Unhandled WebSocket upgrade request for: ${req.url}`);
};

app
  .prepare()
  .then(() => {
    // Create a single HTTP server for both Next.js and Socket.IO
    const httpServer = createServer(async (req, res) => {
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

    // Add explicit event listener for WebSocket upgrade requests
    httpServer.on("upgrade", handleUpgrade);

    // Initialize Socket.IO on the same server
    console.log("Initializing Socket.IO server...");
    try {
      const io = initializeSocketIOServer(httpServer);
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
      console.error("Failed to initialize Socket.IO server:", err);
      if (logger) {
        logger.error("Failed to initialize Socket.IO server:", {
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
      console.log(`> Socket.IO path: /socket.io/`);
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
