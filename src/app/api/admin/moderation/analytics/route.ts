import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getUserFromTokenInNode } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/admin/moderation/analytics
 * Moderasyon analitiği verilerini döndürür
 */
export async function GET(request: NextRequest) {
  try {
    // Admin kontrolü
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromTokenInNode(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Tarih hesaplamaları
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Paralel sorgular
    const [
      totalReports,
      pendingReports,
      resolvedReports,
      dismissedReports,
      totalViolations,
      activeBans,
      activeSuspensions,
      activeFilters,
      reportsToday,
      reportsThisWeek,
      reportsThisMonth,
      reportsByReason,
      reportsByContentType,
    ] = await Promise.all([
      // Toplam rapor sayısı
      prisma.contentReport.count(),
      
      // Bekleyen raporlar
      prisma.contentReport.count({ where: { status: 'PENDING' } }),
      
      // Çözülen raporlar
      prisma.contentReport.count({ where: { status: 'RESOLVED' } }),
      
      // Reddedilen raporlar
      prisma.contentReport.count({ where: { status: 'DISMISSED' } }),
      
      // Toplam aktif ihlaller
      prisma.userViolation.count({ where: { isActive: true } }),
      
      // Aktif kalıcı yasaklar
      prisma.moderationAction.count({
        where: {
          actionType: 'BAN_USER',
          expiresAt: null,
        },
      }),
      
      // Aktif geçici yasaklar
      prisma.moderationAction.count({
        where: {
          actionType: 'SUSPEND_USER',
          expiresAt: { gt: now },
        },
      }),
      
      // Aktif filtreler
      prisma.contentFilter.count({ where: { isActive: true } }),
      
      // Bugünkü raporlar
      prisma.contentReport.count({
        where: { createdAt: { gte: today } },
      }),
      
      // Bu haftaki raporlar
      prisma.contentReport.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      
      // Bu ayki raporlar
      prisma.contentReport.count({
        where: { createdAt: { gte: monthAgo } },
      }),
      
      // Sebebe göre rapor dağılımı
      prisma.contentReport.groupBy({
        by: ['reason'],
        _count: { reason: true },
        orderBy: { _count: { reason: 'desc' } },
        take: 5,
      }),
      
      // İçerik türüne göre rapor dağılımı
      prisma.contentReport.groupBy({
        by: ['contentType'],
        _count: { contentType: true },
        orderBy: { _count: { contentType: 'desc' } },
        take: 5,
      }),
    ]);

    // Verileri formatla
    const analytics = {
      totalReports,
      pendingReports,
      resolvedReports,
      dismissedReports,
      totalViolations,
      activeBans,
      activeSuspensions,
      activeFilters,
      reportsToday,
      reportsThisWeek,
      reportsThisMonth,
      topReportReasons: reportsByReason.map((item) => ({
        reason: item.reason,
        count: item._count.reason,
      })),
      topReportedContentTypes: reportsByContentType.map((item) => ({
        type: item.contentType,
        count: item._count.contentType,
      })),
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Moderasyon analitiği hatası:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
