import { NextRequest, NextResponse } from 'next/server';

// Dummy handler for the WebSocket route - this will be handled by a separate WebSocket server
export async function GET(request: NextRequest, { params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  console.log(`[API][/api/rtc/socket/chat/${streamId}] WebSocket connection attempted`);
  
  // In a real implementation, this would establish a WebSocket connection
  // For now, just return a 200 status to prevent 404 errors
  return new NextResponse('WebSocket endpoint', { status: 200 });
} 