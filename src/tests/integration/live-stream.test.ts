import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { app } from '../../app';
import request from 'supertest';
import { setupTestDatabase, cleanupTestDatabase, prisma } from '../utils/test-setup';

describe('Live Stream API', () => {
  let testUser: any;
  let testStream: any;

  beforeAll(async () => {
    // Setup test database and get test data
    const { testUser: user, testStream: stream } = await setupTestDatabase();
    testUser = user;
    testStream = stream;
  });

  afterAll(async () => {
    // Cleanup test database
    await cleanupTestDatabase();
    await prisma.$disconnect();
  });

  describe('Stream Management', () => {
    it('should create a new stream', async () => {
      const response = await request(app)
        .post('/api/live-streams')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          title: 'New Test Stream',
          description: 'New Test Description',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('New Test Stream');
    });

    it('should update stream status', async () => {
      const response = await request(app)
        .patch(`/api/live-streams/${testStream.id}/status`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          status: 'LIVE',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('LIVE');
    });

    it('should get stream details', async () => {
      const response = await request(app)
        .get(`/api/live-streams/${testStream.id}`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testStream.id);
      expect(response.body.title).toBe(testStream.title);
    });
  });

  describe('Stream Moderation', () => {
    it('should create a moderation action', async () => {
      const response = await request(app)
        .post(`/api/live-streams/${testStream.id}/moderation`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          userId: 'target-user-id',
          action: 'WARN',
          reason: 'Test warning',
        });

      expect(response.status).toBe(201);
      expect(response.body.action).toBe('WARN');
    });

    it('should get moderation history', async () => {
      const response = await request(app)
        .get(`/api/live-streams/${testStream.id}/moderation`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Stream Analytics', () => {
    it('should get stream analytics', async () => {
      const response = await request(app)
        .get(`/api/live-streams/${testStream.id}/analytics`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('viewerCount');
      expect(response.body).toHaveProperty('messageCount');
      expect(response.body).toHaveProperty('engagement');
    });
  });

  describe('Stream Highlights', () => {
    it('should create a highlight', async () => {
      const response = await request(app)
        .post(`/api/live-streams/${testStream.id}/highlights`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          title: 'Test Highlight',
          timestamp: 60,
          duration: 30,
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Highlight');
    });

    it('should get stream highlights', async () => {
      const response = await request(app)
        .get(`/api/live-streams/${testStream.id}/highlights`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
}); 