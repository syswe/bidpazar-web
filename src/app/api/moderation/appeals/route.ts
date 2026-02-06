import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient, AppealStatus } from '@prisma/client';

const prisma = new PrismaClient();

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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as AppealStatus | undefined;

    const where: any = {};
    if (status) where.status = status;

    const appeals = await prisma.userAppeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        action: {
          include: {
            moderator: {
              select: {
                username: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ appeals });
  } catch (error) {
    console.error('Error fetching appeals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appeals' },
      { status: 500 }
    );
  }
}
