import { NextResponse } from 'next/server';
import { verifyToken, JwtPayload } from '@/lib/auth';
import { saveUserDevices, getUserDevices } from '@/lib/device.service';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  logger.info('API GET /api/devices', {
    headers: Object.fromEntries(request.headers.entries()),
    url: request.url,
  });
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token) as JwtPayload;
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const devices = await getUserDevices(user.userId);
    return NextResponse.json(devices);
  } catch (error) {
    logger.error('Failed to get user devices', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info('API POST /api/devices', { headers, body });
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token) as JwtPayload;
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { videoDeviceId, audioDeviceId } = body;

    await saveUserDevices(user.userId, { videoDeviceId, audioDeviceId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to save user devices', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 