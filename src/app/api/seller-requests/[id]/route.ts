import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

// Helper function to extract token from request
function extractToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const parts = authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  
  // Check cookies as fallback
  const authToken = request.cookies.get('authToken');
  if (authToken?.value) {
    return authToken.value;
  }
  
  return null;
}

// PUT - Update seller request status (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractToken(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, reviewNotes } = body;

    // Validate status
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return Response.json(
        { error: 'Invalid status. Must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    // Find the seller request
    const sellerRequest = await prisma.sellerRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!sellerRequest) {
      return Response.json(
        { error: 'Seller request not found' },
        { status: 404 }
      );
    }

    if (sellerRequest.status !== 'PENDING') {
      return Response.json(
        { error: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    // Update seller request
    const updatedRequest = await prisma.sellerRequest.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: payload.userId,
        reviewNotes: reviewNotes || null
      }
    });

    // If approved, update user to SELLER type
    if (status === 'APPROVED') {
      await prisma.user.update({
        where: { id: sellerRequest.userId },
        data: { userType: 'SELLER' }
      });
    }

    return Response.json({
      data: updatedRequest,
      message: status === 'APPROVED' 
        ? 'Seller request approved successfully' 
        : 'Seller request rejected'
    });
  } catch (error) {
    console.error('Error updating seller request:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 