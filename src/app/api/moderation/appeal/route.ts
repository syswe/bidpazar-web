import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { submitAppeal } from '@/lib/moderation-service';

import { getTokenFromRequest, getUserFromTokenInNode } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication using custom token verification
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    const body = await request.json();
    const { moderationActionId, reason } = body;

    // Validate required fields
    if (!moderationActionId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: moderationActionId, reason' },
        { status: 400 }
      );
    }

    // Validate reason length
    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'Appeal reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Submit appeal
    const appeal = await submitAppeal({
      userId: user.id,
      moderationActionId,
      reason,
    });

    return NextResponse.json(
      {
        success: true,
        appeal: {
          id: appeal.id,
          status: appeal.status,
          createdAt: appeal.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error submitting appeal:', error);
    
    // Handle known errors
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Moderation action not found' },
        { status: 404 }
      );
    }

    if (error.message.includes('deadline')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error.message.includes('already been submitted')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit appeal' },
      { status: 500 }
    );
  }
}
