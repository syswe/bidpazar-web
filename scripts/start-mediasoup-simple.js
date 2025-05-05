#!/usr/bin/env node

/**
 * Simplified MediaSoup Worker Startup Script
 * This version doesn't attempt to configure firewall rules
 */

const mediasoup = require('mediasoup');
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

console.log('\n⚠️ This script does not attempt to configure firewall.');
console.log('To open required UDP ports, run scripts/open-mediasoup-ports.sh separately\n');

// Test MediaSoup worker creation
async function testMediasoupWorker() {
  try {
    console.log('Testing MediaSoup worker creation...');
    
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
  } catch (error) {
    console.error('MediaSoup worker test failed:', error.message);
    process.exit(1);
  }
}

testMediasoupWorker(); 