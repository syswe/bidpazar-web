import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const username = (body?.username || '').toString();
    if (!username) return NextResponse.json({ exists: false }, { status: 200 });

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true, username: true, name: true },
    });

    return NextResponse.json({ exists: !!user, user: user || null });
  } catch (error) {
    console.error('[API][/api/users/exists] Error:', error);
    return NextResponse.json({ error: 'Failed to check user' }, { status: 500 });
  }
}

