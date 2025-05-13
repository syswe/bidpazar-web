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

  // Track active streams and users
  const activeStreams = new Map();

  // Socket.IO event handling for chat and bidding
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Extract user information from query params
    const { streamId, userId, username } = socket.handshake.query;
    const user = {
      id: userId || socket.id,
      username: username || 'Anonymous',
      socketId: socket.id
    };
    
    // Join a stream room
    socket.on('join-stream', (streamId) => {
      console.log(`User ${user.username} (${socket.id}) joined stream: ${streamId}`);
      socket.join(`stream:${streamId}`);
      
      // Track users in stream
      if (!activeStreams.has(streamId)) {
        activeStreams.set(streamId, new Map());
      }
      
      const streamUsers = activeStreams.get(streamId);
      streamUsers.set(socket.id, user);
      
      // Notify everyone about the new viewer
      io.to(`stream:${streamId}`).emit('viewer-joined', {
        userId: user.id,
        username: user.username,
        viewerCount: streamUsers.size
      });
    });
    
    // Leave a stream room
    socket.on('leave-stream', (streamId) => {
      console.log(`User ${user.username} (${socket.id}) left stream: ${streamId}`);
      handleStreamLeave(socket, streamId);
    });
    
    // Chat message handling
    socket.on('stream-message', (data) => {
      if (!data.streamId) return;
      
      console.log(`Message in stream ${data.streamId} from ${user.username}: ${data.message}`);
      // Broadcast message to everyone in the stream room
      io.to(`stream:${data.streamId}`).emit('stream-message', {
        userId: user.id,
        username: user.username,
        message: data.message,
        streamId: data.streamId,
        timestamp: new Date().toISOString()
      });
    });
    
    // Bidding functionality
    socket.on('place-bid', (data) => {
      if (!data.streamId || !data.listingId || !data.amount) return;
      
      console.log(`Bid in stream ${data.streamId} for listing ${data.listingId}: ${data.amount} from ${user.username}`);
      
      // Broadcast the bid to everyone in the stream
      io.to(`stream:${data.streamId}`).emit('new-bid', {
        userId: user.id,
        username: user.username,
        listingId: data.listingId,
        amount: data.amount,
        streamId: data.streamId,
        timestamp: new Date().toISOString()
      });
    });
    
    // Countdown timer events
    socket.on('start-countdown', (data) => {
      if (!data.streamId || !data.listingId || !data.duration) return;
      
      console.log(`Starting countdown in stream ${data.streamId} for listing ${data.listingId}: ${data.duration}s`);
      
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (data.duration * 1000));
      
      // Notify everyone about countdown start
      io.to(`stream:${data.streamId}`).emit('countdown-started', {
        listingId: data.listingId,
        duration: data.duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });
      
      // Schedule a message for when countdown ends
      setTimeout(() => {
        io.to(`stream:${data.streamId}`).emit('countdown-ended', {
          listingId: data.listingId,
          endTime: new Date().toISOString()
        });
      }, data.duration * 1000);
    });
    
    // Stream state updates
    socket.on('update-stream-state', (data) => {
      if (!data.streamId || !data.status) return;
      
      console.log(`Stream ${data.streamId} state updated to: ${data.status}`);
      
      io.to(`stream:${data.streamId}`).emit('stream-state-changed', {
        status: data.status,
        streamId: data.streamId,
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle disconnects
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      // Clean up from all active streams when disconnecting
      if (streamId) {
        handleStreamLeave(socket, streamId);
      }
    });
    
    // Helper for handling stream leave
    function handleStreamLeave(socket, streamId) {
      socket.leave(`stream:${streamId}`);
      
      if (activeStreams.has(streamId)) {
        const streamUsers = activeStreams.get(streamId);
        streamUsers.delete(socket.id);
        
        // Notify everyone about the viewer leaving
        io.to(`stream:${streamId}`).emit('viewer-left', {
          userId: user.id,
          username: user.username,
          viewerCount: streamUsers.size
        });
        
        // Clean up empty streams
        if (streamUsers.size === 0) {
          activeStreams.delete(streamId);
        }
      }
    }
  });
}); 