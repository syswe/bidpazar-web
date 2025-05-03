import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  logger.info('API GET /api', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
  });
  try {
    return NextResponse.json({ message: 'API is working' });
  } catch (error) {
    logger.error('Error in GET /api', error);
    throw error;
  }
} 