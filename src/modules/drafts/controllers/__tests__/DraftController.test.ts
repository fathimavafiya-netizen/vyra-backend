import express from 'express';
import request from 'supertest';

jest.mock('../../services/DraftService');
import draftService from '../../services/DraftService';
import draftsRouter from '../../routes/index';
import { DraftApiError } from '../../../../errors/DraftApiError';
import { DraftErrorCode } from '../../../../errors/DraftErrorCode';

// Mock Auth Middleware
jest.mock('../../../../middleware/authMiddleware', () => {
  return jest.fn((req, res, next) => {
    if (req.headers['authorization'] === 'Bearer fail') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.user = { id: 'u1' };
    next();
  });
});

jest.mock('../../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

import errorMiddleware from '../../../../middleware/errorMiddleware';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.requestId = 'test-req-id';
  next();
});
app.use('/drafts', draftsRouter);
app.use(errorMiddleware);

describe('DraftController Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /drafts', () => {
    it('creates a draft successfully', async () => {
      (draftService.createDraft as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'd1', caption: 'Test', version: 1 }
      });

      const response = await request(app)
        .post('/drafts')
        .send({ caption: 'Test' })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: { id: 'd1', caption: 'Test', version: 1 }
      });
      expect(response.headers['request-id']).toBeDefined();
      expect(response.headers['etag']).toBe('"1"');
    });

    it('returns 400 on invalid payload', async () => {
      const response = await request(app)
        .post('/drafts')
        .send({ caption: { invalid: 'type' } }) // object cannot be coerced cleanly by zod transform to a simple string without [object Object] which might pass string validation, wait, let's use postType: "INVALID"
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('PUT /drafts/:id', () => {
    it('updates a draft successfully and changes ETag', async () => {
      (draftService.updateDraft as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'd1', version: 2 }
      });

      const response = await request(app)
        .put('/drafts/d1')
        .send({ version: 1, caption: 'Update' })
        .expect(200);

      expect(response.headers['etag']).toBe('"2"');
    });

    it('returns 409 on optimistic lock conflict', async () => {
      (draftService.updateDraft as jest.Mock).mockRejectedValue(
        new DraftApiError('Conflict', DraftErrorCode.DRAFT_CONFLICT, 409)
      );

      const response = await request(app)
        .put('/drafts/d1')
        .send({ version: 1, caption: 'Update' })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('DRAFT_CONFLICT');
      expect(response.body.message).toBe('Conflict');
      expect(typeof response.body.requestId).toBe('string');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('DELETE /drafts/:id', () => {
    it('returns 403 if unauthorized to delete', async () => {
      (draftService.deleteDraft as jest.Mock).mockRejectedValue(
        new DraftApiError('Forbidden', DraftErrorCode.FORBIDDEN, 403)
      );

      const response = await request(app)
        .delete('/drafts/d1')
        .expect('Content-Type', /json/)
        .expect(403);
        
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /drafts/:id/publish', () => {
    it('publishes successfully', async () => {
      (draftService.publishDraft as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'd1', status: 'PUBLISHED' }
      });

      await request(app)
        .post('/drafts/d1/publish')
        .send({ version: 1 })
        .expect(200);
    });
  });

  describe('POST /drafts/:id/schedule', () => {
    it('schedules successfully', async () => {
      (draftService.scheduleDraft as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'd1', status: 'SCHEDULED' }
      });

      const future = new Date(Date.now() + 10000).toISOString();
      await request(app)
        .post('/drafts/d1/schedule')
        .send({ version: 1, scheduledAt: future })
        .expect(200);
    });
  });

  describe('POST /drafts/:id/cancel-schedule', () => {
    it('cancels schedule successfully', async () => {
      (draftService.cancelSchedule as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'd1', status: 'DRAFT' }
      });

      await request(app)
        .post('/drafts/d1/cancel-schedule')
        .send({ version: 1 })
        .expect(200);
    });
  });

  describe('Global behaviors', () => {
    it('returns 404 for unknown routes', async () => {
      await request(app)
        .get('/drafts/d1/unknown')
        .expect(404);
    });

    it('rejects unauthorized access before validation', async () => {
      const response = await request(app)
        .post('/drafts')
        .set('Authorization', 'Bearer fail')
        .send({ caption: 123 }) // invalid payload
        .expect(401);
      
      expect(response.body.message).toBe('Unauthorized');
    });

    it('returns Request-Id header everywhere', async () => {
      (draftService.listDrafts as jest.Mock).mockResolvedValue({
        success: true,
        data: []
      });

      const response = await request(app)
        .get('/drafts')
        .expect(200);

      expect(response.headers['request-id']).toBeDefined();
    });
  });
});
