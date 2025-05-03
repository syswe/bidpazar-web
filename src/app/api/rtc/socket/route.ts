import { Server } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as NetServer } from 'http';
import { verifyToken } from '@/lib/auth';

// Extend NextApiResponse to include socket.io
type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: Server;
    };
  };
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, {
      path: '/api/rtc/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Socket.IO middleware for authentication
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const user = await verifyToken(token);
        if (!user) {
          return next(new Error('Invalid token'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    // Socket.IO event handlers
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Join room
      socket.on('join:room', (roomId: string) => {
        socket.join(roomId);
        io.to(roomId).emit('user:joined', {
          userId: socket.data.user.id,
          username: socket.data.user.username,
        });
      });

      // Leave room
      socket.on('leave:room', (roomId: string) => {
        socket.leave(roomId);
        io.to(roomId).emit('user:left', {
          userId: socket.data.user.id,
          username: socket.data.user.username,
        });
      });

      // Chat messages
      socket.on('chat:message', (data: { roomId: string; message: string }) => {
        io.to(data.roomId).emit('chat:message', {
          userId: socket.data.user.id,
          username: socket.data.user.username,
          message: data.message,
          timestamp: new Date().toISOString(),
        });
      });

      // WebRTC signaling
      socket.on('webrtc:signal', (data: { to: string; signal: any }) => {
        io.to(data.to).emit('webrtc:signal', {
          from: socket.id,
          signal: data.signal,
        });
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export const GET = ioHandler;
export const POST = ioHandler; 