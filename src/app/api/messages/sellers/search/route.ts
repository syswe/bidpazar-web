import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const DEFAULT_LIMIT = 10;

export async function GET(request: NextRequest) {
  const urlPath = request.nextUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);

  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      console.warn(`[API][${urlPath}] Unauthorized (401): Missing authorization header`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.warn(`[API][${urlPath}] Unauthorized (401): Invalid authorization format`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = parts[1];
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      console.warn(`[API][${urlPath}] Unauthorized (401): Invalid token`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get('query') || '').trim();
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 25)
      : DEFAULT_LIMIT;

    const sellers = await prisma.user.findMany({
      where: {
        userType: 'SELLER',
        id: { not: payload.userId },
        ...(query
          ? {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        userType: true,
      },
      orderBy: query
        ? [{ username: 'asc' }, { name: 'asc' }]
        : [{ updatedAt: 'desc' }],
      take: limit,
    });

    console.log(
      `[API][${urlPath}] Returning ${sellers.length} seller(s) for query "${query}"`
    );

    return NextResponse.json({ sellers });
  } catch (error) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 });
  }
}
