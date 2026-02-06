import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { reviewAppeal } from '@/lib/moderation-service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, reviewNotes } = body;

    if (!status || !reviewNotes) {
      return NextResponse.json(
        { error: 'Missing required fields: status, reviewNotes' },
        { status: 400 }
      );
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    const appeal = await reviewAppeal({
      appealId: id,
      reviewerId: user.id,
      status,
      reviewNotes,
    });

    return NextResponse.json({ success: true, appeal });
  } catch (error) {
    console.error('Error reviewing appeal:', error);
    return NextResponse.json(
      { error: 'Failed to review appeal' },
      { status: 500 }
    );
  }
}
