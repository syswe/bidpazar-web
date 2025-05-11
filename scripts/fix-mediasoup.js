#!/usr/bin/env node

/**
 * MediaSoup Fix Script
 * 
 * This script helps diagnose and fix common issues with MediaSoup initialization,
 * particularly focusing on the worker binary which often causes problems on
 * different platforms.
 * 
 * Run with: node scripts/fix-mediasoup.js
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const os = require('os');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Log messages with color
function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

// Log errors
function error(message) {
  console.error(`${colors.red}${colors.bold}ERROR:${colors.reset} ${message}`);
}

// Log success
function success(message) {
  console.log(`${colors.green}${colors.bold}SUCCESS:${colors.reset} ${message}`);
}

// Log warnings
function warn(message) {
  console.log(`${colors.yellow}${colors.bold}WARNING:${colors.reset} ${message}`);
}

// Log info
function info(message) {
  console.log(`${colors.blue}${colors.bold}INFO:${colors.reset} ${message}`);
}

// Execute a command and return its output
function execCommand(command, options = {}) {
  log(`Executing: ${colors.cyan}${command}${colors.reset}`);
  try {
    return child_process.execSync(command, { 
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (err) {
    if (!options.ignoreError) {
      error(`Command failed: ${command}`);
      error(err.message);
      throw err;
    }
    return null;
  }
}

// Check if MediaSoup is properly installed
function checkMediasoupInstallation() {
  info("Checking MediaSoup installation...");
  
  // Find package.json and check if mediasoup is listed as a dependency
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    error("package.json not found in the current directory");
    return false;
  }
  
  const packageJson = require(packageJsonPath);
  const hasMediasoup = packageJson.dependencies && packageJson.dependencies.mediasoup;
  const hasMediasoupClient = packageJson.dependencies && packageJson.dependencies['mediasoup-client'];
  
  if (!hasMediasoup) {
    error("mediasoup is not listed as a dependency in package.json");
    return false;
  }
  
  if (!hasMediasoupClient) {
    warn("mediasoup-client is not listed as a dependency in package.json");
  }
  
  // Check if node_modules/mediasoup exists
  const mediasoupPath = path.join(process.cwd(), 'node_modules', 'mediasoup');
  
  if (!fs.existsSync(mediasoupPath)) {
    error("mediasoup module not found in node_modules");
    return false;
  }
  
  // Check for worker binary
  const workerPath = path.join(mediasoupPath, 'node', 'worker', 'out', 'Release', 'mediasoup-worker');
  const workerPathExists = fs.existsSync(workerPath);
  
  if (!workerPathExists) {
    warn("MediaSoup worker binary not found. This needs to be built for your platform.");
    // List mediasoup directory contents to help diagnose issues
    log("Listing mediasoup directory contents:");
    execCommand(`ls -la ${mediasoupPath}`);
    
    const workerDir = path.join(mediasoupPath, 'worker');
    if (fs.existsSync(workerDir)) {
      log("Listing worker directory contents:");
      execCommand(`ls -la ${workerDir}`);
    }
    
    return false;
  }
  
  success("MediaSoup installation found");
  info(`Worker binary path: ${workerPath}`);
  
  return true;
}

// Rebuild MediaSoup
function rebuildMediaSoup() {
  info("Rebuilding MediaSoup...");
  
  // Check for prerequisites based on platform
  const platform = os.platform();
  
  if (platform === 'darwin') { // macOS
    info("Detected macOS platform");
    try {
      execCommand("xcode-select --print-path", { silent: true });
    } catch (err) {
      error("Xcode Command Line Tools not installed. Please install them with:");
      log("xcode-select --install", colors.cyan);
      return false;
    }
  } else if (platform === 'linux') {
    info("Detected Linux platform");
    warn("Make sure you have the necessary build tools installed:");
    log("sudo apt-get install -y build-essential python3", colors.cyan);
  } else if (platform === 'win32') {
    info("Detected Windows platform");
    warn("Windows support for MediaSoup may require additional configuration.");
    warn("Make sure you have Visual Studio Build Tools installed");
  }
  
  try {
    // Try the npm rebuild command first
    info("Running npm rebuild mediasoup...");
    execCommand("npm rebuild mediasoup");
    
    // Check if the worker was successfully built
    const workerPath = path.join(process.cwd(), 'node_modules', 'mediasoup', 'node', 'worker', 'out', 'Release', 'mediasoup-worker');
    
    if (fs.existsSync(workerPath)) {
      success("MediaSoup worker binary successfully rebuilt!");
      info(`Worker binary path: ${workerPath}`);
      
      // Make sure the binary is executable
      if (platform !== 'win32') {
        execCommand(`chmod +x ${workerPath}`);
      }
      
      return true;
    } else {
      error("Worker binary not found after rebuild");
      
      // Try an alternative approach - full reinstall
      warn("Trying alternative approach: removing and reinstalling mediasoup...");
      execCommand("npm remove mediasoup");
      execCommand("npm install mediasoup@latest");
      
      if (fs.existsSync(workerPath)) {
        success("MediaSoup successfully reinstalled!");
        return true;
      } else {
        error("MediaSoup installation still fails to build the worker binary");
        warn("Manual compilation may be required");
        return false;
      }
    }
  } catch (err) {
    error("Failed to rebuild MediaSoup");
    return false;
  }
}

// Main function
function main() {
  log("\n");
  log("┌─────────────────────────────────────────────┐");
  log("│          MEDIASOUP DIAGNOSTICS TOOL         │");
  log("└─────────────────────────────────────────────┘\n");
  
  log(`Running in ${process.cwd()}`);
  
  const mediasoupInstalled = checkMediasoupInstallation();
  
  if (!mediasoupInstalled) {
    const shouldRebuild = true; // In an interactive script, you could ask the user
    
    if (shouldRebuild) {
      const rebuildSuccess = rebuildMediaSoup();
      
      if (rebuildSuccess) {
        success("MediaSoup is now properly installed!");
      } else {
        error("Failed to fix MediaSoup installation");
        log("\nFurther troubleshooting steps:", colors.yellow);
        log("1. Try running 'npm install --build-from-source mediasoup'", colors.cyan);
        log("2. Check that you have all build dependencies for your platform", colors.cyan);
        log("3. Look for specific errors in the build output above", colors.cyan);
      }
    }
  } else {
    success("MediaSoup is properly installed");
  }
  
  log("\nFor WebRTC connection issues, also check:", colors.yellow);
  log("1. Your STUN/TURN server configurations");
  log("2. Browser compatibility (Chrome/Firefox recommended)");
  log("3. For local development, try using 127.0.0.1 instead of localhost");
  log("\n");
}

// Run the script
main(); 