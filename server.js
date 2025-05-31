const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const socketio = require("socket.io");

// Dynamic import for node-fetch (ESM module)
let fetch;
(async () => {
  const { default: nodeFetch } = await import("node-fetch");
  fetch = nodeFetch;
})();

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
  // Track active conversation participants for periodic refresh
  const activeConversations = new Map();

  // Helper function to handle stream leave events
  const handleStreamLeave = (socket, streamId) => {
    if (!streamId) return;

    // Remove user from active stream users
    if (activeStreams.has(streamId)) {
      const streamUsers = activeStreams.get(streamId);
      if (streamUsers.has(socket.id)) {
        const user = streamUsers.get(socket.id);
        streamUsers.delete(socket.id);

        // Notify everyone about the viewer leaving
        io.to(`stream:${streamId}`).emit("viewer-left", {
          userId: user.id,
          username: user.username,
          viewerCount: streamUsers.size,
        });

        console.log(
          `User ${user.username} (${socket.id}) left stream: ${streamId}, ${streamUsers.size} viewers remaining`
        );
      }
    }
  };

  // Helper function to check conversation access
  const checkConversationAccess = async (userId, conversationId) => {
    // In a real implementation, this would query the database
    // For now, we'll assume access is granted if they have a valid userId
    return {
      hasAccess: !!userId,
      reason: userId ? null : "User not authenticated",
    };
  };

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
      console.log(`User ${username} (${userId}) connected to socket`);
      // Add user to active users map
      activeUsers.set(userId, socket.id);
      // Join user's personal room for direct messages
      socket.join(`user:${userId}`);

      // Log active rooms
      const socketRooms = Array.from(socket.rooms).filter(
        (r) => r !== socket.id
      );
      if (socketRooms.length > 0) {
        console.log(
          `User ${username} (${userId}) joined rooms: ${socketRooms.join(", ")}`
        );
      }
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
    socket.on("join-conversation", async (conversationId, callback) => {
      console.log(
        `User ${user.username} (${user.id}) joining conversation: ${conversationId}`
      );

      // Check if user has access to this conversation
      const { hasAccess, reason } = await checkConversationAccess(
        user.id,
        conversationId
      );

      if (!hasAccess) {
        console.error(
          `Access denied for user ${user.id} to conversation ${conversationId}: ${reason}`
        );

        // Send access denied event
        socket.emit("access_denied", {
          reason:
            reason || "You don't have permission to access this conversation",
        });

        // Send error in callback if provided
        if (typeof callback === "function") {
          callback({ error: reason || "Access denied to conversation" });
        }

        return;
      }

      // Join the conversation room
      socket.join(`conversation:${conversationId}`);

      // Log room membership for debugging
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      console.log(
        `User ${user.username} (${user.id}) is now in rooms: ${rooms.join(
          ", "
        )}`
      );

      // Track active conversation participants
      if (!activeConversations.has(conversationId)) {
        activeConversations.set(conversationId, new Set());
      }

      const participants = activeConversations.get(conversationId);
      participants.add(user.id);

      // Log success
      console.log(
        `User ${user.username} (${user.id}) joined conversation: ${conversationId} (${participants.size} active participants)`
      );

      // Send success in callback if provided
      if (typeof callback === "function") {
        callback({ success: true });
      }
    });

    // Leave a conversation room
    socket.on("leave-conversation", (conversationId) => {
      console.log(
        `User ${user.username} (${user.id}) left conversation: ${conversationId}`
      );
      socket.leave(`conversation:${conversationId}`);

      // Remove from active conversation participants
      if (activeConversations.has(conversationId)) {
        const participants = activeConversations.get(conversationId);
        participants.delete(user.id);

        if (participants.size === 0) {
          activeConversations.delete(conversationId);
        }
      }
    });

    // Private message handling
    socket.on("private-message", async (data) => {
      if (!data.conversationId || !data.content || !data.receiverId) {
        console.error("Invalid message data:", data);
        return;
      }

      console.log(
        `Private message in conversation ${data.conversationId} from ${user.username} to ${data.receiverId}: ${data.content}`
      );

      try {
        // Post the message to the API to ensure it's saved in the database
        // This approach ensures all message creation goes through the API
        const apiUrl =
          process.env.NODE_ENV === "production"
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/messages/messages`
            : `http://${hostname}:${port}/api/messages/messages`;

        console.log(`Forwarding message to API: ${apiUrl}`);

        // Create headers with authorization
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${socket.handshake.query.token || ""}`,
        };

        // Forward to API endpoint - CRITICAL: Wait for this to complete before emitting socket events
        const response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            conversationId: data.conversationId,
            content: data.content,
            receiverId: data.receiverId,
          }),
        });

        if (response.ok) {
          // Message was saved successfully, get the saved message from the response
          const savedMessage = await response.json();

          // Now emit the socket events with the saved message data
          // This ensures we use the database-generated ID and timestamp
          io.to(`conversation:${data.conversationId}`).emit("new-message", {
            id: savedMessage.id,
            senderId: user.id,
            senderUsername: user.username,
            receiverId: data.receiverId,
            content: data.content,
            conversationId: data.conversationId,
            createdAt: savedMessage.createdAt,
          });

          // Also emit to the receiver's personal room for notifications
          io.to(`user:${data.receiverId}`).emit("message-notification", {
            senderId: user.id,
            senderUsername: user.username,
            conversationId: data.conversationId,
            content: data.content,
            createdAt: savedMessage.createdAt,
          });

          console.log(
            `Message successfully saved to database with ID: ${savedMessage.id}`
          );
        } else {
          const errorText = await response.text();
          throw new Error(
            `API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
      } catch (error) {
        console.error("Error processing message:", error);
        // Notify the sender that the message failed
        socket.emit("message-error", {
          error: "Failed to save message. Please try again.",
          originalMessage: {
            conversationId: data.conversationId,
            content: data.content,
            receiverId: data.receiverId,
          },
        });
      }
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

    // Clean up on disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

      // Remove from active users
      if (userId) {
        activeUsers.delete(userId);
      }

      // Handle active stream cleanup
      for (const [streamId, userMap] of activeStreams.entries()) {
        if (userMap.has(socket.id)) {
          handleStreamLeave(socket, streamId);
        }
      }

      // Remove from active conversations
      for (const [
        conversationId,
        participants,
      ] of activeConversations.entries()) {
        if (participants.has(user.id)) {
          participants.delete(user.id);
          if (participants.size === 0) {
            activeConversations.delete(conversationId);
          }
        }
      }
    });
  });

  // Start the server
  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
