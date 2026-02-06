import { PrismaClient } from '@prisma/client';
import type {
  ReportContentType,
  ReportReason,
  ReportStatus,
  ModerationActionType,
  AppealStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// === Constants ===
const VIOLATION_THRESHOLDS = {
  TEMP_BAN: 5,   // 24-hour suspension
  WEEK_BAN: 10,  // 7-day suspension  
  PERM_BAN: 15,  // Permanent ban
};

const BAN_DURATIONS = {
  TEMP: 24 * 60 * 60 * 1000,  // 24 hours in ms
  WEEK: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

const MAX_REPORTS_PER_DAY = 10;

// === Notification Helpers ===

/**
 * Adminlere bildirim gönder
 */
async function notifyAdmins(
  content: string,
  type: string,
  relatedId?: string
): Promise<void> {
  try {
    // Tüm admin kullanıcıları getir
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });

    // Her admin için bildirim oluştur
    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            content,
            type,
            relatedId,
            isRead: false,
          },
        })
      )
    );
  } catch (error) {
    console.error('Admin bildirimi gönderilemedi:', error);
  }
}

/**
 * Belirli bir kullanıcıya bildirim gönder
 */
async function notifyUser(
  userId: string,
  content: string,
  type: string,
  relatedId?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        content,
        type,
        relatedId,
        isRead: false,
      },
    });
  } catch (error) {
    console.error('Kullanıcı bildirimi gönderilemedi:', error);
  }
}

// === Types ===
export interface CreateReportInput {
  reporterUserId: string;
  contentType: ReportContentType;
  contentId: string;
  reason: ReportReason;
  description?: string;
}

export interface TakeModerationActionInput {
  reportId?: string;
  actionType: ModerationActionType;
  targetUserId?: string;
  targetContentType?: ReportContentType;
  targetContentId?: string;
  moderatorUserId: string;
  reason: string;
  notes?: string;
  severity?: number; // For violation points (1-5)
}

export interface CreateFilterInput {
  name: string;
  pattern: string;
  contentTypes: ReportContentType[];
  action: 'BLOCK' | 'FLAG' | 'WARN';
  severity: number;
  createdBy: string;
}

export interface SubmitAppealInput {
  userId: string;
  moderationActionId: string;
  reason: string;
}

export interface ReviewAppealInput {
  appealId: string;
  reviewerId: string;
  status: 'APPROVED' | 'REJECTED';
  reviewNotes: string;
}

// === Moderation Service ===

/**
 * Check if user has exceeded daily report limit
 */
export async function canUserReport(userId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reportCount = await prisma.contentReport.count({
    where: {
      reporterUserId: userId,
      createdAt: {
        gte: today,
      },
    },
  });

  return reportCount < MAX_REPORTS_PER_DAY;
}

/**
 * Check if user has already reported this content
 */
export async function hasDuplicateReport(
  userId: string,
  contentType: ReportContentType,
  contentId: string
): Promise<boolean> {
  const existing = await prisma.contentReport.findFirst({
    where: {
      reporterUserId: userId,
      contentType,
      contentId,
    },
  });

  return !!existing;
}

/**
 * Create a new content report
 */
export async function createContentReport(input: CreateReportInput) {
  // Check rate limit
  const canReport = await canUserReport(input.reporterUserId);
  if (!canReport) {
    throw new Error('Daily report limit reached. Please try again tomorrow.');
  }

  // Check for duplicates
  const isDuplicate = await hasDuplicateReport(
    input.reporterUserId,
    input.contentType,
    input.contentId
  );
  if (isDuplicate) {
    throw new Error('You have already reported this content');
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterUserId: input.reporterUserId,
      contentType: input.contentType,
      contentId: input.contentId,
      reason: input.reason,
      description: input.description,
      status: 'PENDING',
    },
    include: {
      reporter: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  // Adminlere yeni rapor bildirimi gönder
  await notifyAdmins(
    `Yeni içerik raporu: ${getContentTypeLabel(input.contentType)} - ${getReasonLabel(input.reason)}`,
    'MODERATION_REPORT',
    report.id
  );
  
  return report;
}

/**
 * Get user's active violation points total
 */
export async function getUserViolationPoints(userId: string): Promise<number> {
  const violations = await prisma.userViolation.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      severity: true,
    },
  });

  return violations.reduce((sum, v) => sum + v.severity, 0);
}

/**
 * Check if user is currently suspended or banned
 * Returns { canPost: boolean, reason?: string, expiresAt?: Date }
 */
export async function getUserModerationStatus(userId: string): Promise<{
  canPost: boolean;
  canStream: boolean;
  isBanned: boolean;
  isSuspended: boolean;
  reason?: string;
  expiresAt?: Date;
}> {
  // Check for active bans or suspensions
  const activeRestrictions = await prisma.moderationAction.findMany({
    where: {
      targetUserId: userId,
      actionType: {
        in: ['BAN_USER', 'SUSPEND_USER'],
      },
      OR: [
        { expiresAt: null }, // Permanent ban
        { expiresAt: { gt: new Date() } }, // Active suspension
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  });

  if (activeRestrictions.length > 0) {
    const restriction = activeRestrictions[0];
    const isPermanentBan = restriction.actionType === 'BAN_USER' && !restriction.expiresAt;
    const isActiveSuspension = !!(restriction.expiresAt && restriction.expiresAt > new Date());

    return {
      canPost: false,
      canStream: false,
      isBanned: isPermanentBan,
      isSuspended: isActiveSuspension,
      reason: restriction.reason,
      expiresAt: restriction.expiresAt || undefined,
    };
  }

  return {
    canPost: true,
    canStream: true,
    isBanned: false,
    isSuspended: false,
  };
}

/**
 * Check if user should be automatically sanctioned based on violation points
 */
async function checkAutomaticSanctions(userId: string): Promise<void> {
  const points = await getUserViolationPoints(userId);

  if (points >= VIOLATION_THRESHOLDS.PERM_BAN) {
    // Permanent ban
    await takeModerationAction({
      actionType: 'BAN_USER',
      targetUserId: userId,
      moderatorUserId: 'SYSTEM',
      reason: `Automatic permanent ban: ${points} violation points reached`,
      severity: 0, // System action, no additional points
    });
  } else if (points >= VIOLATION_THRESHOLDS.WEEK_BAN) {
    // 7-day suspension
    const expiresAt = new Date(Date.now() + BAN_DURATIONS.WEEK);
    await takeModerationAction({
      actionType: 'SUSPEND_USER',
      targetUserId: userId,
      moderatorUserId: 'SYSTEM',
      reason: `Automatic 7-day suspension: ${points} violation points reached`,
      severity: 0,
    });
  } else if (points >= VIOLATION_THRESHOLDS.TEMP_BAN) {
    // 24-hour suspension
    const expiresAt = new Date(Date.now() + BAN_DURATIONS.TEMP);
    await takeModerationAction({
      actionType: 'SUSPEND_USER',
      targetUserId: userId,
      moderatorUserId: 'SYSTEM',
      reason: `Automatic 24-hour suspension: ${points} violation points reached`,
      severity: 0,
    });
  }
}

/**
 * Take a moderation action
 */
export async function takeModerationAction(input: TakeModerationActionInput) {
  const expiresAt = calculateExpiresAt(input.actionType);

  const action = await prisma.moderationAction.create({
    data: {
      reportId: input.reportId,
      actionType: input.actionType,
      targetUserId: input.targetUserId,
      targetContentType: input.targetContentType,
      targetContentId: input.targetContentId,
      moderatorUserId: input.moderatorUserId,
      reason: input.reason,
      notes: input.notes,
      expiresAt,
    },
    include: {
      report: true,
      targetUser: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  // Create violation record if this is a disciplinary action
  if (input.targetUserId && shouldCreateViolation(input.actionType)) {
    const severity = input.severity || getDefaultSeverity(input.actionType);
    const violationType = input.reportId
      ? (await prisma.contentReport.findUnique({
          where: { id: input.reportId },
          select: { reason: true },
        }))?.reason || 'OTHER'
      : 'OTHER';

    await prisma.userViolation.create({
      data: {
        userId: input.targetUserId,
        moderationActionId: action.id,
        violationType,
        severity,
        isActive: true,
      },
    });

    // Check for automatic sanctions
    await checkAutomaticSanctions(input.targetUserId);
  }

  // Update report status if linked
  if (input.reportId) {
    const status: ReportStatus =
      input.actionType === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED';
    
    await prisma.contentReport.update({
      where: { id: input.reportId },
      data: {
        status,
        reviewedBy: input.moderatorUserId,
        reviewedAt: new Date(),
      },
    });
  }

  // Hedef kullanıcıya moderasyon işlemi bildirimi gönder
  if (action.targetUser) {
    const actionLabel = getActionTypeLabel(input.actionType);
    let message = `Moderasyon işlemi: ${actionLabel}`;
    
    if (expiresAt) {
      const expiryDate = new Date(expiresAt).toLocaleDateString('tr-TR');
      message += ` (${expiryDate} tarihine kadar)`;
    }
    
    await notifyUser(
      action.targetUser.id,
      message,
      'MODERATION_ACTION',
      action.id
    );
  }
  // TODO: Apply content removal/hiding if needed (task 6.x integration)

  return action;
}

/**
 * Match content against active filters
 */
export async function checkContentFilters(
  content: string,
  contentType: ReportContentType
): Promise<{
  matched: boolean;
  filter?: any;
  action?: string;
}> {
  const filters = await prisma.contentFilter.findMany({
    where: {
      isActive: true,
      contentTypes: {
        has: contentType,
      },
    },
    orderBy: {
      severity: 'desc', // Higher severity first
    },
  });

  for (const filter of filters) {
    try {
      const regex = new RegExp(filter.pattern, 'i');
      if (regex.test(content)) {
        return {
          matched: true,
          filter,
          action: filter.action,
        };
      }
    } catch (error) {
      console.error(`Invalid regex pattern in filter ${filter.id}:`, error);
      continue;
    }
  }

  return { matched: false };
}

/**
 * Create a new content filter
 */
export async function createContentFilter(input: CreateFilterInput) {
  // Validate regex pattern
  try {
    new RegExp(input.pattern);
  } catch (error) {
    throw new Error('Invalid regex pattern');
  }

  const filter = await prisma.contentFilter.create({
    data: {
      name: input.name,
      pattern: input.pattern,
      contentTypes: input.contentTypes,
      action: input.action,
      severity: input.severity,
      isActive: true,
      createdBy: input.createdBy,
    },
  });

  return filter;
}

/**
 * Submit an appeal for a moderation action
 */
export async function submitAppeal(input: SubmitAppealInput) {
  // Check if action exists and is appealable
  const action = await prisma.moderationAction.findUnique({
    where: { id: input.moderationActionId },
  });

  if (!action) {
    throw new Error('Moderation action not found');
  }

  // Check 30-day deadline
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (action.createdAt < thirtyDaysAgo) {
    throw new Error('Appeal deadline has passed (30 days from action)');
  }

  // Check for existing appeal
  const existingAppeal = await prisma.userAppeal.findUnique({
    where: { moderationActionId: input.moderationActionId },
  });

  if (existingAppeal) {
    throw new Error('An appeal has already been submitted for this action');
  }

  const appeal = await prisma.userAppeal.create({
    data: {
      userId: input.userId,
      moderationActionId: input.moderationActionId,
      reason: input.reason,
      status: 'PENDING',
    },
    include: {
      action: true,
    },
  });

  // Adminlere yeni itiraz bildirimi gönder
  await notifyAdmins(
    `Yeni moderasyon itirazı: Kullanıcı ${input.userId}`,
    'MODERATION_APPEAL',
    appeal.id
  );

  return appeal;
}

/**
 * Review an appeal (admin action)
 */
export async function reviewAppeal(input: ReviewAppealInput) {
  const appeal = await prisma.userAppeal.update({
    where: { id: input.appealId },
    data: {
      status: input.status,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes,
    },
    include: {
      action: true,
      user: true,
    },
  });

  // If approved, deactivate related violations
  if (input.status === 'APPROVED') {
    await prisma.userViolation.updateMany({
      where: {
        moderationActionId: appeal.moderationActionId,
      },
      data: {
        isActive: false,
      },
    });

    // TODO: Restore content if it was removed (task 6.x integration)
  }

  // Kullanıcıya itiraz sonucu bildirimi gönder
  const resultMessage = input.status === 'APPROVED' 
    ? 'İtirazınız kabul edildi ve moderasyon işlemi geri alındı.'
    : `İtirazınız reddedildi. Sebep: ${input.reviewNotes}`;
  
  await notifyUser(
    appeal.userId,
    resultMessage,
    'MODERATION_APPEAL_RESULT',
    appeal.id
  );

  return appeal;
}

/**
 * Get paginated reports for admin queue
 */
export async function getReports(params: {
  status?: ReportStatus;
  contentType?: ReportContentType;
  limit?: number;
  offset?: number;
}) {
  const { status, contentType, limit = 50, offset = 0 } = params;

  const where: any = {};
  if (status) where.status = status;
  if (contentType) where.contentType = contentType;

  const [reports, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
          },
        },
        actions: {
          take: 5,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  return {
    reports,
    total,
    limit,
    offset,
  };
}

// === Helper Functions ===

function calculateExpiresAt(actionType: ModerationActionType): Date | null {
  const now = Date.now();
  
  switch (actionType) {
    case 'SUSPEND_USER':
      return new Date(now + BAN_DURATIONS.TEMP);
    case 'BAN_USER':
      return null; // Permanent
    default:
      return null;
  }
}

function shouldCreateViolation(actionType: ModerationActionType): boolean {
  return [
    'WARN_USER',
    'SUSPEND_USER',
    'BAN_USER',
    'REMOVE_CONTENT',
  ].includes(actionType);
}

function getDefaultSeverity(actionType: ModerationActionType): number {
  switch (actionType) {
    case 'WARN_USER':
      return 1;
    case 'REMOVE_CONTENT':
      return 2;
    case 'SUSPEND_USER':
      return 3;
    case 'BAN_USER':
      return 5;
    default:
      return 1;
  }
}

function getContentTypeLabel(type: ReportContentType): string {
  const labels: Record<ReportContentType, string> = {
    STREAM: 'Canlı Yayın',
    PRODUCT: 'Ürün',
    CHAT_MESSAGE: 'Sohbet Mesajı',
    STORY: 'Hikaye',
    DIRECT_MESSAGE: 'Direkt Mesaj',
  };
  return labels[type] || type;
}

function getReasonLabel(reason: ReportReason): string {
  const labels: Record<ReportReason, string> = {
    SPAM: 'Spam',
    HARASSMENT: 'Taciz',
    HATE_SPEECH: 'Nefret Söylemi',
    VIOLENCE: 'Şiddet',
    ILLEGAL_CONTENT: 'Yasadışı İçerik',
    FRAUD: 'Dolandırıcılık',
    INAPPROPRIATE: 'Uygunsuz İçerik',
    COPYRIGHT: 'Telif Hakkı',
    OTHER: 'Diğer',
  };
  return labels[reason] || reason;
}

function getActionTypeLabel(type: ModerationActionType): string {
  const labels: Record<ModerationActionType, string> = {
    REMOVE_CONTENT: 'İçerik Kaldırıldı',
    HIDE_CONTENT: 'İçerik Gizlendi',
    WARN_USER: 'Kullanıcı Uyarıldı',
    SUSPEND_USER: 'Kullanıcı Askıya Alındı',
    BAN_USER: 'Kullanıcı Yasaklandı',
    RESTORE_CONTENT: 'İçerik Geri Yüklendi',
    DISMISS_REPORT: 'Rapor Reddedildi',
  };
  return labels[type] || type;
}

export default {
  createContentReport,
  takeModerationAction,
  checkContentFilters,
  createContentFilter,
  submitAppeal,
  reviewAppeal,
  getReports,
  getUserViolationPoints,
  getUserModerationStatus,
  canUserReport,
  hasDuplicateReport,
};
