import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromTokenInNode } from '@/lib/auth';
import { createContentReport } from '@/lib/moderation-service';
import { ReportContentType, ReportReason } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // Check authentication using custom token verification
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      );
    }

    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { contentType, contentId, reason, description } = body;

    // Validate required fields
    if (!contentType || !contentId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: contentType, contentId, reason' },
        { status: 400 }
      );
    }

    // Validate enums
    if (!Object.values(ReportContentType).includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    if (!Object.values(ReportReason).includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid report reason' },
        { status: 400 }
      );
    }

    // Create report
    const report = await createContentReport({
      reporterUserId: user.id,
      contentType,
      contentId,
      reason,
      description,
    });

    return NextResponse.json(
      {
        success: true,
        report: {
          id: report.id,
          status: report.status,
          createdAt: report.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating report:', error);
    
    // Handle known errors
    if (error.message.includes('limit reached')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      );
    }

    if (error.message.includes('already reported')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}
