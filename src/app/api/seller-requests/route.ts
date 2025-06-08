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

// GET - Get seller requests (admin gets all, users get their own)
export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (payload.isAdmin) {
      // Admin can see all requests
      const sellerRequests = await prisma.sellerRequest.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return Response.json({ data: sellerRequests });
    } else {
      // Regular users can only see their own requests
      const userRequests = await prisma.sellerRequest.findMany({
        where: {
          userId: payload.userId
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return Response.json({ data: userRequests });
    }
  } catch (error) {
    console.error('Error fetching seller requests:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit seller request
export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has a pending request
    const existingRequest = await prisma.sellerRequest.findFirst({
      where: {
        userId: payload.userId,
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return Response.json(
        { error: 'Zaten beklemede olan bir başvurunuz bulunmaktadır' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { fullName, phoneNumber, email, productCategories, notes } = body;

    // Validate required fields
    if (!fullName || !phoneNumber || !email || !productCategories) {
      return Response.json(
        { error: 'Tüm zorunlu alanları doldurunuz' },
        { status: 400 }
      );
    }

    const sellerRequest = await prisma.sellerRequest.create({
      data: {
        userId: payload.userId,
        fullName,
        phoneNumber,
        email,
        productCategories,
        notes: notes || null
      }
    });

    return Response.json({ 
      data: sellerRequest,
      message: 'Başvurunuz başarıyla gönderildi'
    });
  } catch (error) {
    console.error('Error creating seller request:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 