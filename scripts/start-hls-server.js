#!/usr/bin/env node

/**
 * This script starts a simple Node Media Server for HLS streaming
 * It can be used for testing RTMP and HLS streaming without starting the full application
 */

const NodeMediaServer = require('node-media-server');
const path = require('path');
const fs = require('fs-extra');

// Ensure the HLS directory exists
const hlsDir = path.join(process.cwd(), 'public', 'hls');
fs.ensureDirSync(hlsDir);

// Configure the Node Media Server
const nmsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: path.join(process.cwd(), 'public')
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        hlsKeep: false,
        dash: false,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  }
};

const nms = new NodeMediaServer(nmsConfig);

// When a stream starts publishing
nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`Stream publishing: ${StreamPath}`);
  
  // Extract the stream ID from the path
  const streamId = StreamPath.split('/')[2];
  
  // Create the directory for this stream's HLS segments
  const streamHlsDir = path.join(hlsDir, streamId);
  fs.ensureDirSync(streamHlsDir);
});

// When a stream stops publishing
nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`Stream ended: ${StreamPath}`);
});

// Start the server
nms.run();

console.log('Node Media Server started');
console.log('RTMP URL: rtmp://localhost:1935/live/{stream-key}');
console.log('HLS URL: http://localhost:8000/hls/{stream-key}/index.m3u8');
console.log('Press Ctrl+C to stop the server');

// Handle shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  nms.stop();
  process.exit(0);
}); 