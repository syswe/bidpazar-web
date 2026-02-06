import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { takeModerationAction } from '@/lib/moderation-service';
import { ModerationActionType, ReportContentType } from '@prisma/client';

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

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      reportId,
      actionType,
      targetUserId,
      targetContentType,
      targetContentId,
      reason,
      notes,
      severity,
    } = body;

    // Validate required fields
    if (!actionType || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: actionType, reason' },
        { status: 400 }
      );
    }

    // Validate enums
    if (!Object.values(ModerationActionType).includes(actionType)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      );
    }

    if (targetContentType && !Object.values(ReportContentType).includes(targetContentType)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // Validate severity if provided
    if (severity !== undefined && (severity < 1 || severity > 5)) {
      return NextResponse.json(
        { error: 'Severity must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Take moderation action
    const action = await takeModerationAction({
      reportId,
      actionType,
      targetUserId,
      targetContentType,
      targetContentId,
      moderatorUserId: user.id,
      reason,
      notes,
      severity,
    });

    return NextResponse.json(
      {
        success: true,
        action: {
          id: action.id,
          actionType: action.actionType,
          createdAt: action.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error taking moderation action:', error);
    return NextResponse.json(
      { error: 'Failed to take moderation action' },
      { status: 500 }
    );
  }
}
