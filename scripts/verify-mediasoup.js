#!/usr/bin/env node

/**
 * MediaSoup Verification Script
 * 
 * This script checks if MediaSoup is properly installed and configured.
 * It attempts to create a worker and router to verify everything is working.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const mediasoup = require('mediasoup');

console.log('=== MediaSoup Installation Verification ===');
console.log(`Node.js version: ${process.version}`);
console.log(`Operating System: ${os.type()} ${os.release()} (${os.platform()})`);
console.log(`Architecture: ${os.arch()}`);

// Check MediaSoup Module
console.log('\nVerifying MediaSoup module:');
try {
  console.log(`MediaSoup version: ${mediasoup.version}`);
  console.log('MediaSoup module loaded successfully');
} catch (error) {
  console.error('Error loading MediaSoup module:', error.message);
  process.exit(1);
}

// Check worker binary
console.log('\nChecking MediaSoup worker binary:');
try {
  // First get the module path
  const mediasoupPath = require.resolve('mediasoup');
  console.log(`MediaSoup module path: ${mediasoupPath}`);
  
  // Get worker path
  const expectedWorkerPath = path.join(path.dirname(mediasoupPath), '..', 'worker', 'out', 'Release', 'mediasoup-worker');
  const workerExists = fs.existsSync(expectedWorkerPath);
  
  console.log(`Worker path: ${expectedWorkerPath}`);
  console.log(`Worker exists: ${workerExists ? 'YES' : 'NO'}`);
  
  if (workerExists) {
    try {
      // Check if binary is executable
      const stats = fs.statSync(expectedWorkerPath);
      const isExecutable = !!(stats.mode & 0o111);
      console.log(`Worker is executable: ${isExecutable ? 'YES' : 'NO'}`);
      
      // Make it executable if it's not
      if (!isExecutable) {
        console.log('Making worker executable...');
        fs.chmodSync(expectedWorkerPath, stats.mode | 0o111);
        console.log('Worker is now executable');
      }
    } catch (statError) {
      console.error('Error checking worker permissions:', statError.message);
    }
  } else {
    console.error('Worker binary not found!');
    
    // Check node_modules structure
    console.log('\nInspecting node_modules structure:');
    const nodeModulesPath = path.join(path.dirname(mediasoupPath), '..');
    const mediasoupFiles = fs.existsSync(nodeModulesPath) ? 
      fs.readdirSync(nodeModulesPath) : 
      ['directory not found'];
    console.log(`Files in mediasoup package directory: ${mediasoupFiles.join(', ')}`);
    
    // Check if worker directory exists
    const workerDir = path.join(nodeModulesPath, 'worker');
    if (fs.existsSync(workerDir)) {
      console.log('Worker directory exists, checking contents:');
      const workerFiles = fs.readdirSync(workerDir);
      console.log(`Worker directory contents: ${workerFiles.join(', ')}`);
    } else {
      console.error('Worker directory does not exist');
    }
  }
} catch (error) {
  console.error('Error checking worker binary:', error.message);
}

// Test MediaSoup worker creation
async function testMediasoupWorker() {
  console.log('\nTesting MediaSoup worker creation...');
  
  try {
    const worker = await mediasoup.createWorker({
      logLevel: 'debug',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: 40000,
      rtcMaxPort: 40100,
    });
    
    console.log(`Worker created successfully! (pid: ${worker.pid})`);
    
    worker.on('died', (error) => {
      console.error('MediaSoup worker died:', error ? error.message : 'Unknown reason');
      process.exit(1);
    });
    
    // Create a test router
    console.log('Creating test router...');
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
        }
      ]
    });
    
    console.log('Router created successfully!');
    console.log(`Router RTP capabilities: ${JSON.stringify(router.rtpCapabilities, null, 2)}`);
    
    // Clean up
    worker.close();
    console.log('Test successful! Worker closed.');
    
    console.log('\n=== MediaSoup is properly installed and working! ===');
    return true;
  } catch (error) {
    console.error('MediaSoup worker test failed:', error.message);
    console.error('Full error details:', error);
    return false;
  }
}

// Try to rebuild mediasoup if needed
async function tryRebuildMediasoup() {
  console.log('\nAttempting to rebuild MediaSoup...');
  
  try {
    console.log('Installing build dependencies...');
    execSync('apt-get update && apt-get install -y python3 make g++ pkg-config libssl-dev', 
      { stdio: 'inherit' });

    console.log('Reinstalling MediaSoup...');
    execSync('npm install --no-save mediasoup@3', { stdio: 'inherit' });
    
    console.log('MediaSoup reinstalled successfully');
    return true;
  } catch (error) {
    console.error('Failed to rebuild MediaSoup:', error.message);
    return false;
  }
}

// Main function
async function main() {
  let success = await testMediasoupWorker();
  
  if (!success) {
    console.log('\nInitial test failed, attempting to rebuild MediaSoup...');
    const rebuildSuccess = await tryRebuildMediasoup();
    
    if (rebuildSuccess) {
      console.log('Rebuild successful, testing again...');
      success = await testMediasoupWorker();
    }
  }
  
  if (!success) {
    console.error('\n=== MediaSoup verification FAILED ===');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
}); 