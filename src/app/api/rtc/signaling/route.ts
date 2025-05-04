import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Store ICE candidates and offers/answers
const signalingData = new Map<string, {
  candidates: any[];
  offer?: any;
  answer?: any;
}>();

export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    let userId = 'anonymous';
    
    // Verify token if present, but don't require it
    if (token) {
      try {
        const user = await verifyToken(token);
        if (user) {
          userId = user.userId;
        }
      } catch (error) {
        console.warn('Token verification failed, continuing as anonymous user');
      }
    }

    const body = await request.json();
    const { action, roomId, data } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    let roomData = signalingData.get(roomId);
    if (!roomData) {
      roomData = { candidates: [] };
      signalingData.set(roomId, roomData);
    }

    switch (action) {
      case 'offer': {
        roomData.offer = data;
        return NextResponse.json({ success: true });
      }

      case 'answer': {
        roomData.answer = data;
        return NextResponse.json({ success: true });
      }

      case 'candidate': {
        roomData.candidates.push(data);
        return NextResponse.json({ success: true });
      }

      case 'get-offer': {
        return NextResponse.json({ offer: roomData.offer });
      }

      case 'get-answer': {
        return NextResponse.json({ answer: roomData.answer });
      }

      case 'get-candidates': {
        return NextResponse.json({ candidates: roomData.candidates });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Signaling error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 