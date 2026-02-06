import { NextRequest } from 'next/server';
import { GET as getReports } from '@/app/api/moderation/reports/route';
import { POST as createReport } from '@/app/api/moderation/report/route';

// Mock auth and service
jest.mock('@/lib/auth', () => ({
  getTokenFromRequest: jest.fn(() => 'mock-token'),
  getUserFromTokenInNode: jest.fn().mockResolvedValue({ id: 'admin1', isAdmin: true, email: 'admin@example.com' }),
}));

jest.mock('@/lib/moderation-service', () => ({
  getReports: jest.fn().mockResolvedValue({ reports: [], total: 0 }),
  createContentReport: jest.fn().mockResolvedValue({ id: 'report1', status: 'PENDING' }),
}));

// Create a mock NextRequest
function createMockRequest(url: string, method: string, body?: any) {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Moderation API Integration', () => {
  describe('GET /api/moderation/reports', () => {
    it('should return 200 and reports for admin', async () => {
      const req = createMockRequest('/api/moderation/reports', 'GET');
      
      const res = await getReports(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('reports');
    });
  });

  describe('POST /api/moderation/report', () => {
    it('should create report successfully', async () => {
      const req = createMockRequest('/api/moderation/report', 'POST', {
        contentType: 'PRODUCT',
        contentId: 'prod1',
        reason: 'SPAM'
      });

      const res = await createReport(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe('report1');
    });
  });
});
