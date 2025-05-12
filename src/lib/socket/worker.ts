import * as mediasoup from "mediasoup";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";
import { mediasoupAppConfig } from './types';

// Type guard to check if mediasoupWorker is initialized
export function isWorkerInitialized(worker: MediasoupTypes.Worker | null): worker is MediasoupTypes.Worker {
  return worker !== null && !worker.closed;
}

/**
 * Initialize MediaSoup worker with debugging support
 */
export async function initializeMediasoupWorker(): Promise<MediasoupTypes.Worker> {
  // First check if we have a worker in global scope
  // @ts-ignore
  if (global.mediasoupWorker && !global.mediasoupWorker.closed) {
    // @ts-ignore
    const globalWorker: MediasoupTypes.Worker = global.mediasoupWorker;
    logger.info("[MediaSoup] Using existing worker from global scope.");
    return globalWorker;
  }

  try {
    logger.info("[MediaSoup] Creating Mediasoup worker...");
    
    // Debug output to help diagnose worker issues
    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      
      // Check if mediasoup module exists
      if (fs.existsSync('./node_modules/mediasoup')) {
        logger.info("[MediaSoup] MediaSoup module found in node_modules");
        
        // Check if worker path exists
        const workerPath = require.resolve('mediasoup/worker/out/Release/mediasoup-worker');
        logger.info(`[MediaSoup] Worker resolved path: ${workerPath}`);
        
        // Check if executable exists and has correct permissions
        const stats = fs.statSync(workerPath);
        logger.info(`[MediaSoup] Worker file stats: ${JSON.stringify({
          size: stats.size,
          mode: stats.mode.toString(8),
          isExecutable: !!(stats.mode & 0o111)
        })}`);
        
        // Make sure it's executable
        if (!(stats.mode & 0o111)) {
          logger.info("[MediaSoup] Making worker executable");
          fs.chmodSync(workerPath, stats.mode | 0o111);
        }
      } else {
        logger.error("[MediaSoup] MediaSoup module not found in node_modules!");
      }
    } catch (debugErr) {
      logger.error("[MediaSoup] Error during worker path debugging:", debugErr);
    }
    
    const worker = await createMediasoupWorker();
    
    worker.on("died", (error) => {
      logger.error("[MediaSoup] Worker died.", error);
      // @ts-ignore
      global.mediasoupWorker = null;
      setTimeout(() => process.exit(1), 2000);
    });
    
    logger.info("[MediaSoup] Worker created successfully.");
    return worker;
  } catch (error) {
    logger.error("[MediaSoup] Failed to create Mediasoup worker:", error);
    throw error;
  }
}

/**
 * Create a MediaSoup worker with automatic recovery on failure
 */
export async function createMediasoupWorker(): Promise<MediasoupTypes.Worker> {
  const { worker: workerConfig } = mediasoupAppConfig;

  logger.info("[MediaSoup] Creating MediaSoup worker");
  
  // Debug worker path
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    logger.info("[MediaSoup] Checking MediaSoup installation status");
    
    // Check node_modules structure
    if (fs.existsSync('./node_modules/mediasoup')) {
      const files = fs.readdirSync('./node_modules/mediasoup');
      logger.info(`[MediaSoup] Files in mediasoup dir: ${files.join(', ')}`);
      
      if (fs.existsSync('./node_modules/mediasoup/worker')) {
        const workerFiles = fs.readdirSync('./node_modules/mediasoup/worker');
        logger.info(`[MediaSoup] Files in worker dir: ${workerFiles.join(', ')}`);
        
        // Check worker binary
        const workerPath = './node_modules/mediasoup/worker/out/Release/mediasoup-worker';
        if (fs.existsSync(workerPath)) {
          logger.info(`[MediaSoup] Worker binary exists at ${workerPath}`);
          
          // Make sure it's executable
          try {
            fs.chmodSync(workerPath, 0o755);
            logger.info("[MediaSoup] Made worker binary executable");
          } catch (chmodErr) {
            logger.error("[MediaSoup] Error making worker executable:", chmodErr);
          }
        } else {
          logger.error(`[MediaSoup] Worker binary NOT found at expected path: ${workerPath}`);
        }
      }
    } else {
      logger.error("[MediaSoup] MediaSoup module directory not found!");
    }
  } catch (debugErr) {
    logger.error("[MediaSoup] Error debugging mediasoup installation:", debugErr);
  }
  
  try {
    const worker = await mediasoup.createWorker({
      logLevel: workerConfig.logLevel as MediasoupTypes.WorkerLogLevel,
      logTags: workerConfig.logTags as MediasoupTypes.WorkerLogTag[],
      rtcMinPort: workerConfig.rtcMinPort,
      rtcMaxPort: workerConfig.rtcMaxPort,
    });

    worker.on("died", (error) => {
      logger.error(
        "[MediaSoup] MediaSoup worker died unexpectedly, attempting restart",
        { error: error?.toString() }
      );
      // Attempt to create a new worker
      setTimeout(async () => {
        try {
          const newWorker = await createMediasoupWorker();
          // @ts-ignore
          global.mediasoupWorker = newWorker;
          logger.info("[MediaSoup] MediaSoup worker restarted successfully");
        } catch (e) {
          logger.error("[MediaSoup] Failed to restart MediaSoup worker", {
            error: e,
          });
        }
      }, 2000);
    });

    return worker;
  } catch (error) {
    logger.error("[MediaSoup] Failed to create worker with config:", {
      error,
      config: {
        rtcMinPort: workerConfig.rtcMinPort,
        rtcMaxPort: workerConfig.rtcMaxPort,
        logLevel: workerConfig.logLevel,
      }
    });
    
    // Try to find mediasoup worker binary with more detailed paths
    try {
      const path = require('path');
      const fs = require('fs');
      
      const possiblePaths = [
        './node_modules/mediasoup/worker/out/Release/mediasoup-worker',
        '/app/node_modules/mediasoup/worker/out/Release/mediasoup-worker',
        path.resolve('./node_modules/mediasoup/worker/out/Release/mediasoup-worker')
      ];
      
      logger.info("[MediaSoup] Searching for worker binary in possible locations:");
      possiblePaths.forEach(p => {
        logger.info(`  - ${p}: ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}`);
      });
      
      // Try to reinstall mediasoup as a last resort
      logger.info("[MediaSoup] Emergency: Trying to reinstall mediasoup");
      const { execSync } = require('child_process');
      execSync('npm install mediasoup@3', { stdio: 'inherit' });
      
      // Check if that fixed it
      const reinstallPath = './node_modules/mediasoup/worker/out/Release/mediasoup-worker';
      if (fs.existsSync(reinstallPath)) {
        logger.info("[MediaSoup] Successfully reinstalled mediasoup, binary now exists");
        fs.chmodSync(reinstallPath, 0o755);
      } else {
        logger.error("[MediaSoup] Reinstall failed, binary still missing");
      }
    } catch (searchErr) {
      logger.error("[MediaSoup] Error during emergency recovery:", searchErr);
    }
    
    throw error;
  }
} 