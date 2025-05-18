const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const socketio = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT, 10) || 3000;

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
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Integrate Socket.IO with the main HTTP server
  const io = socketio(server, {
    cors: {
      origin: dev
        ? `http://${hostname}:${port}`
        : process.env.NEXT_PUBLIC_APP_URL || "https://bidpazar.com",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: process.env.WS_URL || "/socket.io",
  });

  // Make Socket.IO instance available globally for API routes to use
  global.socketIO = io;

  console.log(`> Socket.IO server integrated with HTTP server`);

  // Track active streams and users
  const activeStreams = new Map();
  // Track active users for messaging
  const activeUsers = new Map();

  // Socket.IO event handling for chat and bidding
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Extract user information from query params
    const { streamId, userId, username } = socket.handshake.query;
    const user = {
      id: userId || socket.id,
      username: username || "Anonymous",
      socketId: socket.id,
    };

    // Track user connection for messaging
    if (userId) {
      console.log(`User ${username} (${userId}) connected`);
      // Add user to active users map
      activeUsers.set(userId, socket.id);
      // Join user's personal room for direct messages
      socket.join(`user:${userId}`);
    }

    // Join a stream room
    socket.on("join-stream", (streamId) => {
      console.log(
        `User ${user.username} (${socket.id}) joined stream: ${streamId}`
      );
      socket.join(`stream:${streamId}`);

      // Track users in stream
      if (!activeStreams.has(streamId)) {
        activeStreams.set(streamId, new Map());
      }

      const streamUsers = activeStreams.get(streamId);
      streamUsers.set(socket.id, user);

      // Notify everyone about the new viewer
      io.to(`stream:${streamId}`).emit("viewer-joined", {
        userId: user.id,
        username: user.username,
        viewerCount: streamUsers.size,
      });
    });

    // Leave a stream room
    socket.on("leave-stream", (streamId) => {
      console.log(
        `User ${user.username} (${socket.id}) left stream: ${streamId}`
      );
      handleStreamLeave(socket, streamId);
    });

    // Chat message handling
    socket.on("stream-message", (data) => {
      if (!data.streamId) return;

      console.log(
        `Message in stream ${data.streamId} from ${user.username}: ${data.message}`
      );
      // Broadcast message to everyone in the stream room
      io.to(`stream:${data.streamId}`).emit("stream-message", {
        userId: user.id,
        username: user.username,
        message: data.message,
        streamId: data.streamId,
        timestamp: new Date().toISOString(),
      });
    });

    // Join a conversation room
    socket.on("join-conversation", (conversationId) => {
      console.log(
        `User ${user.username} (${user.id}) joined conversation: ${conversationId}`
      );
      socket.join(`conversation:${conversationId}`);
    });

    // Leave a conversation room
    socket.on("leave-conversation", (conversationId) => {
      console.log(
        `User ${user.username} (${user.id}) left conversation: ${conversationId}`
      );
      socket.leave(`conversation:${conversationId}`);
    });

    // Private message handling
    socket.on("private-message", (data) => {
      if (!data.conversationId || !data.content || !data.receiverId) return;

      console.log(
        `Private message in conversation ${data.conversationId} from ${user.username} to ${data.receiverId}: ${data.content}`
      );

      // Emit to the conversation room (includes the sender)
      io.to(`conversation:${data.conversationId}`).emit("new-message", {
        id: data.id,
        senderId: user.id,
        senderUsername: user.username,
        receiverId: data.receiverId,
        content: data.content,
        conversationId: data.conversationId,
        createdAt: data.createdAt || new Date().toISOString(),
      });

      // Also emit to the receiver's personal room (for notifications when not in the conversation)
      io.to(`user:${data.receiverId}`).emit("message-notification", {
        senderId: user.id,
        senderUsername: user.username,
        conversationId: data.conversationId,
        content: data.content,
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });

    // Bidding functionality
    socket.on("place-bid", (data) => {
      if (!data.streamId || !data.listingId || !data.amount) return;

      console.log(
        `Bid in stream ${data.streamId} for listing ${data.listingId}: ${data.amount} from ${user.username}`
      );

      // Broadcast the bid to everyone in the stream
      io.to(`stream:${data.streamId}`).emit("new-bid", {
        userId: user.id,
        username: user.username,
        listingId: data.listingId,
        amount: data.amount,
        streamId: data.streamId,
        timestamp: new Date().toISOString(),
      });
    });

    // Countdown timer events
    socket.on("start-countdown", (data) => {
      if (!data.streamId || !data.listingId || !data.duration) return;

      console.log(
        `Starting countdown in stream ${data.streamId} for listing ${data.listingId}: ${data.duration}s`
      );

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + data.duration * 1000);

      // Notify everyone about countdown start
      io.to(`stream:${data.streamId}`).emit("countdown-started", {
        listingId: data.listingId,
        duration: data.duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      // Schedule a message for when countdown ends
      setTimeout(() => {
        io.to(`stream:${data.streamId}`).emit("countdown-ended", {
          listingId: data.listingId,
          endTime: new Date().toISOString(),
        });
      }, data.duration * 1000);
    });

    // Stream state updates
    socket.on("update-stream-state", (data) => {
      if (!data.streamId || !data.status) return;

      console.log(`Stream ${data.streamId} state updated to: ${data.status}`);

      io.to(`stream:${data.streamId}`).emit("stream-state-changed", {
        status: data.status,
        streamId: data.streamId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnects
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Clean up from all active streams when disconnecting
      if (streamId) {
        handleStreamLeave(socket, streamId);
      }

      // Remove user from active users map
      if (userId) {
        activeUsers.delete(userId);
        console.log(`User ${username} (${userId}) disconnected`);
      }
    });

    // Helper for handling stream leave
    function handleStreamLeave(socket, streamId) {
      socket.leave(`stream:${streamId}`);

      if (activeStreams.has(streamId)) {
        const streamUsers = activeStreams.get(streamId);
        streamUsers.delete(socket.id);

        // Notify everyone about the viewer leaving
        io.to(`stream:${streamId}`).emit("viewer-left", {
          userId: user.id,
          username: user.username,
          viewerCount: streamUsers.size,
        });

        // Clean up empty streams
        if (streamUsers.size === 0) {
          activeStreams.delete(streamId);
        }
      }
    }
  });

  // Start the server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
