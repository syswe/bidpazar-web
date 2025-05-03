import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema
const highlightSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  timestamp: z.number().min(0),
  duration: z.number().min(1),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
});

// GET /api/live-streams/[id]/highlights - Get stream highlights
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const highlights = await prisma.streamHighlight.findMany({
      where: { liveStreamId: id },
      orderBy: { timestamp: 'asc' },
    });

    return NextResponse.json(highlights);
  } catch (error) {
    console.error('Error fetching highlights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch highlights' },
      { status: 500 }
    );
  }
}

// POST /api/live-streams/[id]/highlights - Create a highlight
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = highlightSchema.parse(body);

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to create highlights' },
        { status: 403 }
      );
    }

    const highlight = await prisma.streamHighlight.create({
      data: {
        ...validatedData,
        liveStreamId: id,
      },
    });

    return NextResponse.json(highlight, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating highlight:', error);
    return NextResponse.json(
      { error: 'Failed to create highlight' },
      { status: 500 }
    );
  }
}

// PATCH /api/live-streams/[id]/highlights/[highlightId] - Update highlight metadata
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> }
) {
  try {
    const { id, highlightId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = highlightSchema.partial().parse(body);

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update highlights' },
        { status: 403 }
      );
    }

    const highlight = await prisma.streamHighlight.update({
      where: { id: highlightId },
      data: validatedData,
    });

    return NextResponse.json(highlight);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating highlight:', error);
    return NextResponse.json(
      { error: 'Failed to update highlight' },
      { status: 500 }
    );
  }
}

// DELETE /api/live-streams/[id]/highlights/[highlightId] - Delete a highlight
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> }
) {
  try {
    const { id, highlightId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stream = await prisma.liveStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    if (stream.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete highlights' },
        { status: 403 }
      );
    }

    await prisma.streamHighlight.delete({
      where: { id: highlightId },
    });

    return NextResponse.json(
      { message: 'Highlight deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting highlight:', error);
    return NextResponse.json(
      { error: 'Failed to delete highlight' },
      { status: 500 }
    );
  }
} 