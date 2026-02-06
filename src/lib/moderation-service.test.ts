import { prisma } from '@/lib/prisma';
import moderationService from './moderation-service';
import { ReportReason, ReportContentType } from '@prisma/client';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contentReport: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    userViolation: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    moderationAction: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    userAppeal: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contentFilter: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('moderationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canUserReport', () => {
    it('should return true if user is under daily limit', async () => {
      (prisma.contentReport.count as jest.Mock).mockResolvedValue(5);
      const result = await moderationService.canUserReport('user1');
      expect(result).toBe(true);
    });

    it('should return false if user reached daily limit', async () => {
      (prisma.contentReport.count as jest.Mock).mockResolvedValue(10);
      const result = await moderationService.canUserReport('user1');
      expect(result).toBe(false);
    });
  });

  describe('createContentReport', () => {
    const mockInput = {
      reporterUserId: 'user1',
      contentType: 'PRODUCT' as ReportContentType,
      contentId: 'prod1',
      reason: 'SPAM' as ReportReason,
    };

    it('should create a report if allowed', async () => {
      (prisma.contentReport.count as jest.Mock).mockResolvedValue(0); // Under limit
      (prisma.contentReport.findFirst as jest.Mock).mockResolvedValue(null); // No duplicate
      (prisma.contentReport.create as jest.Mock).mockResolvedValue({ id: 'report1', ...mockInput });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'admin1' }]); // Admins for notification

      const result = await moderationService.createContentReport(mockInput);

      expect(prisma.contentReport.create).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled(); // Should notify admins
      expect(result).toHaveProperty('id', 'report1');
    });

    it('should throw error if daily limit reached', async () => {
      (prisma.contentReport.count as jest.Mock).mockResolvedValue(10);
      await expect(moderationService.createContentReport(mockInput))
        .rejects.toThrow('Daily report limit reached');
    });

    it('should throw error if duplicate report', async () => {
      (prisma.contentReport.count as jest.Mock).mockResolvedValue(0);
      (prisma.contentReport.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });
      await expect(moderationService.createContentReport(mockInput))
        .rejects.toThrow('already reported');
    });
  });

  describe('getUserViolationPoints', () => {
    it('should sum severity of active violations', async () => {
      (prisma.userViolation.findMany as jest.Mock).mockResolvedValue([
        { severity: 1 },
        { severity: 3 },
      ]);

      const points = await moderationService.getUserViolationPoints('user1');
      expect(points).toBe(4);
    });
  });

  describe('getUserModerationStatus', () => {
    it('should return clean status if no active actions', async () => {
      (prisma.moderationAction.findMany as jest.Mock).mockResolvedValue([]);
      const status = await moderationService.getUserModerationStatus('user1');
      expect(status.canPost).toBe(true);
      expect(status.isBanned).toBe(false);
    });

    it('should return banned status if active ban exists', async () => {
      (prisma.moderationAction.findMany as jest.Mock).mockResolvedValue([
        { actionType: 'BAN_USER', expiresAt: null, reason: 'Bad behavior' }
      ]);
      const status = await moderationService.getUserModerationStatus('user1');
      expect(status.isBanned).toBe(true);
      expect(status.canPost).toBe(false);
    });
  });

  describe('checkContentFilters', () => {
    it('should match content matched by regex', async () => {
      (prisma.contentFilter.findMany as jest.Mock).mockResolvedValue([
        { pattern: 'bad', action: 'BLOCK' }
      ]);

      const result = await moderationService.checkContentFilters('this is bad content', 'CHAT_MESSAGE');
      expect(result.matched).toBe(true);
      expect(result.action).toBe('BLOCK');
    });

    it('should not match safe content', async () => {
      (prisma.contentFilter.findMany as jest.Mock).mockResolvedValue([
        { pattern: 'bad', action: 'BLOCK' }
      ]);

      const result = await moderationService.checkContentFilters('this is safe content', 'CHAT_MESSAGE');
      expect(result.matched).toBe(false);
    });
  });
});
