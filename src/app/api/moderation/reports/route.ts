import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getTokenFromRequest, getUserFromTokenInNode } from '@/lib/auth';
import { getReports } from '@/lib/moderation-service';
import { ReportContentType, ReportStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
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

    // Check if user is admin
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as ReportStatus | undefined;
    const contentType = searchParams.get('contentType') as ReportContentType | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate enums if provided
    if (status && !Object.values(ReportStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    if (contentType && !Object.values(ReportContentType).includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // Validate pagination
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset must be non-negative' },
        { status: 400 }
      );
    }

    // Get reports
    const result = await getReports({
      status,
      contentType,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
