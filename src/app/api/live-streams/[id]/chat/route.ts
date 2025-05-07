import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getUserFromTokenInNode } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { headers } from 'next/headers';

// Validation schema
const chatMessageSchema = z.object({
  message: z.string().min(1).max(500),
});

// Temporary in-memory store for messages (in a real app, use a database)
const chatMessages: Record<string, any[]> = {};

// GET /api/live-streams/[id]/chat - Get chat messages
export async function GET(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const streamId = params.id;
  console.log(`[API][/api/live-streams/${streamId}/chat] GET request received`);
  
  // Return messages for this stream, or empty array if none exist
  const messages = chatMessages[streamId] || [];
  
  return NextResponse.json({ 
    success: true, 
    messages 
  });
}

// POST /api/live-streams/[id]/chat - Send a chat message
export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const streamId = params.id;
  console.log(`[API][/api/live-streams/${streamId}/chat] POST request received`);
  
  try {
    const body = await request.json();
    
    if (!body.message) {
      return NextResponse.json({ 
        success: false, 
        message: 'Message content is required' 
      }, { status: 400 });
    }
    
    // Get user info from request cookies or headers
    // In a real app, validate the user authentication
    const authHeader = request.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    // Create a new message object
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      liveStreamId: streamId,
      content: body.message,
      userId: body.userId || 'anonymous',
      username: body.username || 'Anonymous',
      createdAt: new Date().toISOString()
    };
    
    // Initialize the messages array for this stream if it doesn't exist
    if (!chatMessages[streamId]) {
      chatMessages[streamId] = [];
    }
    
    // Add the message to the store
    chatMessages[streamId].push(message);
    
    // In a real application, broadcast this message to all connected clients
    
    return NextResponse.json({ 
      success: true, 
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error(`[API][/api/live-streams/${streamId}/chat] Error:`, error);
    return NextResponse.json({ 
      success: false, 
      message: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 