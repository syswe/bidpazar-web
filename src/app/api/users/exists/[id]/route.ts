import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = request.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, name: true } });
    return NextResponse.json({ exists: !!user, user: user || null });
  } catch (error) {
    console.error('[API][/api/users/exists/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to check user' }, { status: 500 });
  }
}

