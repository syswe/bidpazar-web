// socket-test.js
const { io } = require('socket.io-client');

// Configuration - adjust as needed
const config = {
  host: process.env.SERVER_HOST || 'localhost',
  port: parseInt(process.env.SERVER_PORT || '3001', 10), // Use port 3001 for Socket.IO server
  streamId: process.env.STREAM_ID || 'test-stream',
  userId: process.env.USER_ID || 'test-user',
  username: process.env.USERNAME || 'Test User',
  isStreamer: process.env.IS_STREAMER || '1', // '1' for true, '0' for false
  timeout: parseInt(process.env.TEST_TIMEOUT || '10000', 10)
};

const serverUrl = `http://${config.host}:${config.port}`;
console.log(`Connecting to Socket.IO server at ${serverUrl}`);

// Create a Socket.IO client connection
const socket = io(serverUrl, {
  path: '/socket.io/',
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 5000,
  query: {
    streamId: config.streamId,
    userId: config.userId,
    username: config.username,
    isStreamer: config.isStreamer
  }
});

// Connection event handlers
socket.on('connect', () => {
  console.log(`✓ Connected to server with socket ID: ${socket.id}`);
  
  // Request router RTP capabilities
  socket.emit('getRouterRtpCapabilities', {}, (response) => {
    if (response.error) {
      console.error('Error getting router RTP capabilities:', response.error);
    } else {
      console.log('✓ Router RTP capabilities received successfully');
      console.log(JSON.stringify(response, null, 2));
    }
  });
});

socket.on('connect_error', (error) => {
  console.error('✗ Connection error:', error.message);
  console.log('Make sure the server is running and accessible at', serverUrl);
});

socket.on('disconnect', (reason) => {
  console.log(`✗ Disconnected: ${reason}`);
});

socket.on('serverError', (error) => {
  console.error('✗ Server error:', error);
});

// Test creating a WebRTC transport
setTimeout(() => {
  if (socket.connected) {
    console.log('Testing WebRTC transport creation...');
    socket.emit('createWebRtcTransport', { producing: true, consuming: false }, (response) => {
      if (response.error) {
        console.error('✗ Error creating transport:', response.error);
      } else {
        console.log('✓ Transport created successfully:', response.id);
      }
    });
  }
}, 2000);

// Automatic cleanup after timeout
setTimeout(() => {
  console.log('Test complete, disconnecting...');
  if (socket.connected) {
    socket.disconnect();
  }
  console.log('Summary:');
  console.log(`- Server: ${serverUrl}`);
  console.log(`- Connection successful: ${socket.connected ? 'Yes' : 'No'}`);
  console.log(`- Stream ID: ${config.streamId}`);
  console.log(`- User: ${config.username} (${config.userId})`);
  console.log(`- Role: ${config.isStreamer === '1' ? 'Streamer' : 'Viewer'}`);
  process.exit(0);
}, config.timeout);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Closing connection and exiting...');
  if (socket.connected) {
    socket.disconnect();
  }
  process.exit(0);
}); 