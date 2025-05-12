const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const socketio = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;
const socketPort = parseInt(process.env.PORT_SOCKET, 10) || 3001;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Start HTTP server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Always use a separate server for Socket.IO
  const io = socketio(socketPort, {
    cors: {
      // Allow connections from the main app
      origin: dev 
        ? `http://${hostname}:${port}` 
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://bidpazar.com'),
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: process.env.WS_URL || '/socket.io',
  });
  
  console.log(`> Socket.IO server running on port ${socketPort}`);

  // Socket.IO event handling for chat
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
    
    // Join a stream room
    socket.on('join-stream', (streamId) => {
      console.log(`User ${socket.id} joined stream: ${streamId}`);
      socket.join(streamId);
    });
    
    // Leave a stream room
    socket.on('leave-stream', (streamId) => {
      console.log(`User ${socket.id} left stream: ${streamId}`);
      socket.leave(streamId);
    });
    
    // Chat message handling
    socket.on('stream-message', (data) => {
      console.log(`Message in stream ${data.streamId}: ${data.message}`);
      // Broadcast message to everyone in the stream room
      io.to(data.streamId).emit('stream-message', {
        ...data,
        timestamp: new Date().toISOString()
      });
    });
  });
}); 