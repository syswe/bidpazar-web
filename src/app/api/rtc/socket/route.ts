import { Server } from 'socket.io';
import { Server as NetServer } from 'http';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Global variable to store the Socket.IO instance
let io: Server;

export async function GET(request: Request) {
  // This is a workaround for Socket.IO in Next.js App Router
  // We need to create a NextResponse that doesn't close the connection
  const response = new NextResponse();
  
  // @ts-ignore - accessing internal properties
  const socket = response.socket;
  
  if (socket && socket.server && !socket.server.io) {
    io = new Server(socket.server as unknown as NetServer, {
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

    // @ts-ignore - storing io on the server
    socket.server.io = io;
  }

  return new Response('Socket.IO server initialized', { status: 200 });
}

// Also export POST for WebSocket upgrade
export async function POST(request: Request) {
  return new Response('Socket.IO server is running', { status: 200 });
} 