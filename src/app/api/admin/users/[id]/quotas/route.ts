import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/admin/users/[id]/quotas - Get user's quota status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    
    // Verify admin token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isAdmin: true }
    });

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Get target user's quota info
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        userType: true,
        monthlyProductLimit: true,
        monthlyStreamMinutes: true,
        productsUsedThisMonth: true,
        streamMinutesUsedMonth: true,
        quotaResetDate: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      userId: user.id,
      username: user.username,
      userType: user.userType,
      quotas: {
        products: {
          limit: user.monthlyProductLimit,
          used: user.productsUsedThisMonth,
          remaining: Math.max(0, user.monthlyProductLimit - user.productsUsedThisMonth)
        },
        streaming: {
          limitMinutes: user.monthlyStreamMinutes,
          usedMinutes: user.streamMinutesUsedMonth,
          remainingMinutes: Math.max(0, user.monthlyStreamMinutes - user.streamMinutesUsedMonth)
        },
        resetDate: user.quotaResetDate
      }
    });
  } catch (error: any) {
    logger.error('Error fetching user quotas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users/[id]/quotas - Grant quotas to user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;
    const body = await req.json();
    const { type, amount } = body;

    // Validate input
    if (!type || !['products', 'streaming'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "products" or "streaming"' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Verify admin token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isAdmin: true, username: true }
    });

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Get target user
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        userType: true,
        monthlyProductLimit: true,
        monthlyStreamMinutes: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is SELLER
    if (user.userType !== 'SELLER') {
      return NextResponse.json(
        { error: 'Quotas can only be granted to SELLER type users' },
        { status: 400 }
      );
    }

    // Update quota (cumulative - add to existing)
    const updateData: any = {};
    
    if (type === 'products') {
      updateData.monthlyProductLimit = user.monthlyProductLimit + amount;
    } else if (type === 'streaming') {
      updateData.monthlyStreamMinutes = user.monthlyStreamMinutes + amount;
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        username: true,
        monthlyProductLimit: true,
        monthlyStreamMinutes: true,
        productsUsedThisMonth: true,
        streamMinutesUsedMonth: true,
        quotaResetDate: true
      }
    });

    logger.info(`Admin ${adminUser.username} granted ${amount} ${type} quota to ${user.username}`, {
      adminId: payload.userId,
      targetUserId,
      type,
      amount
    });

    return NextResponse.json({
      success: true,
      message: `${amount} ${type === 'products' ? 'ürün' : 'dakika'} kontörü eklendi`,
      quotas: {
        products: {
          limit: updatedUser.monthlyProductLimit,
          used: updatedUser.productsUsedThisMonth,
          remaining: Math.max(0, updatedUser.monthlyProductLimit - updatedUser.productsUsedThisMonth)
        },
        streaming: {
          limitMinutes: updatedUser.monthlyStreamMinutes,
          usedMinutes: updatedUser.streamMinutesUsedMonth,
          remainingMinutes: Math.max(0, updatedUser.monthlyStreamMinutes - updatedUser.streamMinutesUsedMonth)
        },
        resetDate: updatedUser.quotaResetDate
      }
    });
  } catch (error: any) {
    logger.error('Error granting quotas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
