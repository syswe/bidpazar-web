import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest, getUserFromTokenInNode } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (!userId && !username) {
      return NextResponse.json(
        { error: 'Either userId or username parameter is required' },
        { status: 400 }
      );
    }

    // Get violations
    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    } else if (username) {
      where.user = { username };
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    // First fetch violations to render the list
    const violations = await prisma.userViolation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        },
        action: {
          include: {
            report: true,
            moderator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    // Calculate total active points
    const totalPoints = violations
      .filter((v) => v.isActive)
      .reduce((sum, v) => sum + v.severity, 0);

    return NextResponse.json({
      violations,
      totalActivePoints: totalPoints,
      totalViolations: violations.length,
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch violations' },
      { status: 500 }
    );
  }
}
