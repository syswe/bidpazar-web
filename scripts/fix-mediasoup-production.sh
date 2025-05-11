#!/bin/bash

# Fix MediaSoup in Production Environment
# Run this script on the production server if MediaSoup fails to start

echo "=== MediaSoup Production Fix Script ==="
echo "This script will install dependencies and rebuild MediaSoup"

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Please use sudo."
  exit 1
fi

# Navigate to the app directory
cd /app || { echo "Cannot find /app directory"; exit 1; }

echo "Current directory: $(pwd)"
echo "Current container ID: $(hostname)"

# Install build dependencies
echo -e "\n=== Installing build dependencies ==="
apt-get update
apt-get install -y python3 python3-pip make g++ pkg-config libssl-dev

# Check node version
echo -e "\n=== Node.js environment ==="
node -v
npm -v

# Reinstall mediasoup
echo -e "\n=== Reinstalling MediaSoup ==="
npm install mediasoup@3 --no-save

# Check if the worker binary exists
WORKER_PATH="./node_modules/mediasoup/worker/out/Release/mediasoup-worker"
if [ -f "$WORKER_PATH" ]; then
  echo -e "\n=== MediaSoup worker binary found ==="
  ls -la "$WORKER_PATH"
  
  # Make sure it's executable
  echo "Making worker executable"
  chmod +x "$WORKER_PATH"
  ls -la "$WORKER_PATH"
else
  echo -e "\n=== ERROR: MediaSoup worker binary not found ==="
  echo "Expected location: $WORKER_PATH"
  
  # Check node_modules structure
  echo -e "\n=== Checking node_modules structure ==="
  ls -la ./node_modules/mediasoup
  
  if [ -d "./node_modules/mediasoup/worker" ]; then
    echo "Worker directory found, checking contents:"
    ls -la ./node_modules/mediasoup/worker
    
    if [ -d "./node_modules/mediasoup/worker/out" ]; then
      echo "Out directory found, checking contents:"
      ls -la ./node_modules/mediasoup/worker/out
      
      if [ -d "./node_modules/mediasoup/worker/out/Release" ]; then
        echo "Release directory found, checking contents:"
        ls -la ./node_modules/mediasoup/worker/out/Release
      else
        echo "Release directory not found"
      fi
    else
      echo "Out directory not found"
    fi
  else
    echo "Worker directory not found"
  fi
  
  # Attempt to build manually
  echo -e "\n=== Attempting manual build ==="
  cd ./node_modules/mediasoup
  npm run worker:build
  
  # Check if build was successful
  if [ -f "./worker/out/Release/mediasoup-worker" ]; then
    echo "Manual build successful!"
    chmod +x ./worker/out/Release/mediasoup-worker
    ls -la ./worker/out/Release/mediasoup-worker
  else
    echo "Manual build failed"
  fi
fi

# Run the verification script
echo -e "\n=== Running verification script ==="
node -e "
const mediasoup = require('mediasoup');
const fs = require('fs');
const path = require('path');

async function verifyMediasoup() {
  try {
    console.log('MediaSoup version:', mediasoup.version);
    
    const mediasoupPath = require.resolve('mediasoup');
    console.log('Module path:', mediasoupPath);
    
    const workerPath = path.join(path.dirname(mediasoupPath), '..', 'worker', 'out', 'Release', 'mediasoup-worker');
    console.log('Worker path:', workerPath);
    console.log('Worker exists:', fs.existsSync(workerPath));
    
    if (fs.existsSync(workerPath)) {
      const stats = fs.statSync(workerPath);
      console.log('Worker executable:', !!(stats.mode & 0o111));
    }
    
    console.log('Creating worker...');
    const worker = await mediasoup.createWorker({
      logLevel: 'debug',
      logTags: ['info'],
      rtcMinPort: 40000,
      rtcMaxPort: 40100
    });
    
    console.log('Worker created successfully! PID:', worker.pid);
    worker.close();
    console.log('Worker closed.');
    
    return true;
  } catch (error) {
    console.error('MediaSoup verification failed:', error);
    return false;
  }
}

verifyMediasoup().then(success => {
  if (success) {
    console.log('=== MediaSoup is now working properly! ===');
    process.exit(0);
  } else {
    console.error('=== MediaSoup is still not working properly ===');
    process.exit(1);
  }
});
"

# Check verification result
if [ $? -eq 0 ]; then
  echo -e "\n=== SUCCESS: MediaSoup has been fixed! ==="
  echo "You can now restart your application."
else
  echo -e "\n=== WARNING: MediaSoup issues may still exist ==="
  echo "Please check the output above for more details."
fi

echo -e "\nDone!" 