import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createContentFilter } from '@/lib/moderation-service';
import { PrismaClient, ReportContentType } from '@prisma/client';

const prisma = new PrismaClient();

import { getTokenFromRequest, getUserFromTokenInNode } from '@/lib/auth';

// GET - List all filters
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

    const filters = await prisma.contentFilter.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ filters });
  } catch (error) {
    console.error('Error fetching filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filters' },
      { status: 500 }
    );
  }
}

// POST - Create new filter
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
    const { name, pattern, contentTypes, action, severity } = body;

    // Validate required fields
    if (!name || !pattern || !contentTypes || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: name, pattern, contentTypes, action' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['BLOCK', 'FLAG', 'WARN'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be BLOCK, FLAG, or WARN' },
        { status: 400 }
      );
    }

    // Validate content types
    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
      return NextResponse.json(
        { error: 'contentTypes must be a non-empty array' },
        { status: 400 }
      );
    }

    for (const type of contentTypes) {
      if (!Object.values(ReportContentType).includes(type)) {
        return NextResponse.json(
          { error: `Invalid content type: ${type}` },
          { status: 400 }
        );
      }
    }

    const filter = await createContentFilter({
      name,
      pattern,
      contentTypes,
      action,
      severity: severity || 1,
      createdBy: user.id,
    });

    return NextResponse.json(
      { success: true, filter },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating filter:', error);
    
    if (error.message === 'Invalid regex pattern') {
      return NextResponse.json(
        { error: 'Invalid regex pattern' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create filter' },
      { status: 500 }
    );
  }
}
