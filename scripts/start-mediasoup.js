#!/usr/bin/env node

/**
 * MediaSoup Worker Startup Script
 * This script ensures MediaSoup workers are started with the correct
 * port range and IP configuration before the main application.
 */

const mediasoup = require('mediasoup');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load environment variables
require('dotenv').config();

const MEDIASOUP_ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || '192.168.1.5';
const MEDIASOUP_MIN_PORT = parseInt(process.env.MEDIASOUP_MIN_PORT || '40000');
const MEDIASOUP_MAX_PORT = parseInt(process.env.MEDIASOUP_MAX_PORT || '40100');
const MEDIASOUP_WORKERS = parseInt(process.env.MEDIASOUP_WORKERS || '1');

console.log('======== MediaSoup Initialization ========');
console.log(`Announced IP: ${MEDIASOUP_ANNOUNCED_IP}`);
console.log(`Port range: ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}`);
console.log(`Worker count: ${MEDIASOUP_WORKERS}`);

// Open required UDP ports on macOS
if (os.platform() === 'darwin') {
  try {
    console.log('\nConfiguring macOS firewall...');
    console.log('Checking if ports are already open...');
    
    // Check if any existing rules for our port range
    const existingRules = execSync('sudo pfctl -sa | grep "pass out proto udp from any to any port" | grep "keep state"').toString();
    const hasMediasoupRules = existingRules.includes(`${MEDIASOUP_MIN_PORT}:${MEDIASOUP_MAX_PORT}`);
    
    if (!hasMediasoupRules) {
      console.log(`Opening UDP ports ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}...`);
      
      // Create a temporary pf config file
      const pfConfigPath = path.join(os.tmpdir(), 'mediasoup-pf.conf');
      const pfConfig = `
# MediaSoup WebRTC port range
pass out proto udp from any to any port ${MEDIASOUP_MIN_PORT}:${MEDIASOUP_MAX_PORT} keep state
pass in proto udp from any to any port ${MEDIASOUP_MIN_PORT}:${MEDIASOUP_MAX_PORT} keep state
`;
      fs.writeFileSync(pfConfigPath, pfConfig);
      
      // Load the rules
      execSync(`sudo pfctl -ef ${pfConfigPath}`);
      console.log('UDP ports opened successfully.');
    } else {
      console.log('MediaSoup ports already configured in firewall.');
    }
  } catch (error) {
    console.error('Error configuring firewall:', error.message);
    console.log('You may need to manually open UDP ports for MediaSoup:');
    console.log(`sudo pfctl -ef /etc/pf.conf`);
    console.log(`Then add rules for ports ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}`);
  }
}

// Test MediaSoup worker creation
async function testMediasoupWorker() {
  try {
    console.log('\nTesting MediaSoup worker creation...');
    
    const worker = await mediasoup.createWorker({
      logLevel: 'debug',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: MEDIASOUP_MIN_PORT,
      rtcMaxPort: MEDIASOUP_MAX_PORT,
    });
    
    worker.on('died', () => {
      console.error('MediaSoup worker died!');
      process.exit(1);
    });
    
    // Create a test router
    const routerOptions = {
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
    };
    
    const router = await worker.createRouter(routerOptions);
    console.log(`MediaSoup worker and router created successfully! (pid: ${worker.pid})`);
    
    // Clean up test worker
    worker.close();
    console.log('Test successful, worker closed.');
    
    // Now you can start your main application
    console.log('\nMediaSoup initialization successful! Ready to start your application.');
    console.log('Run "npm run dev" to start the Next.js development server.');
  } catch (error) {
    console.error('MediaSoup worker test failed:', error.message);
    process.exit(1);
  }
}

testMediasoupWorker(); 