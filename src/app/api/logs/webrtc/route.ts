import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * API endpoint for collecting WebRTC diagnostic logs from clients
 * 
 * This allows us to collect diagnostics from users having streaming issues
 * to help debug and improve the WebRTC implementation.
 */
export async function POST(req: NextRequest) {
  try {
    // Parse JSON body
    const data = await req.json();
    
    // Log diagnostics with a specific tag for easy filtering
    logger.info(`[WebRTC-Diagnostics] Client reporting issues`, {
      userId: data.userId || 'anonymous',
      streamId: data.streamId || 'unknown',
      timestamp: data.timestamp || new Date().toISOString(),
      userAgent: data.userAgent || req.headers.get('user-agent') || 'unknown',
      message: data.message || 'No message provided',
      clientInfo: data.clientInfo || {},
      // Include IP for debugging network-related issues
      ip: req.headers.get('x-forwarded-for') || 'unknown'
    });
    
    // Return success response
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // Log server-side error
    logger.error(`[WebRTC-Diagnostics] Error processing diagnostics:`, error);
    
    // Return error response
    return NextResponse.json(
      { error: 'Failed to process diagnostics' },
      { status: 500 }
    );
  }
} 