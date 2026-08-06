import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import draftsRouter from '../routes/index';
import errorMiddleware from '../../../middleware/errorMiddleware';
import { requestIdMiddleware } from '../../../middleware/requestIdMiddleware';

// Real Prisma client for E2E
const prisma = new PrismaClient();

// Setup E2E Express App
const app = express();
app.use(express.json());
app.use(requestIdMiddleware);

// Mock Auth Middleware to simulate logged in users
jest.mock('../../../middleware/authMiddleware', () => {
  return jest.fn((req, res, next) => {
    if (req.headers.authorization === 'Bearer fail') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = req.headers['x-user-id'] || 'test-user-e2e-1';
    req.user = { id: userId as string };
    next();
  });
});
import authMiddleware from '../../../middleware/authMiddleware';
app.use(authMiddleware);

app.use('/drafts', draftsRouter);
app.use(errorMiddleware);

describe('Drafts E2E', () => {
  const userId = 'test-user-e2e-1';
  let createdDraftId: string;

  beforeAll(async () => {
    // Create test user if it doesn't exist to satisfy foreign key constraint
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'test-e2e-1@example.com',
        username: 'test_e2e_1',
        password: 'dummy_hash',
      }
    });

    // Clean up test user's posts before running
    await prisma.post.deleteMany({ where: { userId } });
  }, 30_000);

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  it('1. Unauthorized access', async () => {
    await request(app).get('/drafts').set('Authorization', 'Bearer fail').expect(401);
  });

  it('2. Invalid payload', async () => {
    await request(app).post('/drafts').send({ caption: 123 }).expect(400);
  });

  it('3. Draft creation', async () => {
    const res = await request(app)
      .post('/drafts')
      .send({ caption: 'E2E Draft' })
      .expect(201);
    
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.version).toBe(1);
    expect(res.headers.etag).toBe('"1"');
    createdDraftId = res.body.data.id;
  });

  it('4. List pagination & invalid cursor', async () => {
    // Valid
    const res = await request(app).get('/drafts').expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(createdDraftId);

    // Invalid cursor (not UUID)
    await request(app).get('/drafts?cursor=invalid-cursor').expect(400);
  });

  it('5. Partial update', async () => {
    const res = await request(app)
      .put(`/drafts/${createdDraftId}`)
      .send({ version: 1, caption: 'E2E Draft Updated' })
      .expect(200);
    
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.caption).toBe('E2E Draft Updated');
    expect(res.headers.etag).toBe('"2"');
  });

  it('6. Optimistic conflict & Concurrent updates', async () => {
    // Try updating with old version 1
    const res = await request(app)
      .put(`/drafts/${createdDraftId}`)
      .send({ version: 1, caption: 'Conflict Update' })
      .expect(409);
    
    expect(res.body.code).toBe('DRAFT_CONFLICT');
  });

  it('7. Forced overwrite', async () => {
    // Use force=true to bypass version check
    const res = await request(app)
      .put(`/drafts/${createdDraftId}?force=true`)
      .send({ version: 1, caption: 'Forced Update' }) // version is ignored
      .expect(200);
    
    expect(res.body.data.version).toBe(3); // incremented anyway
    expect(res.body.data.caption).toBe('Forced Update');
  });

  it('8. Schedule', async () => {
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const res = await request(app)
      .post(`/drafts/${createdDraftId}/schedule`)
      .send({ version: 3, scheduledAt: futureDate })
      .expect(200);
    
    expect(res.body.data.status).toBe('SCHEDULED');
    expect(res.body.data.version).toBe(4);
  });

  it('9. Cancel schedule', async () => {
    const res = await request(app)
      .post(`/drafts/${createdDraftId}/cancel-schedule`)
      .send({ version: 4 })
      .expect(200);
    
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.version).toBe(5);
  });

  it('10. Publish', async () => {
    const res = await request(app)
      .post(`/drafts/${createdDraftId}/publish`)
      .send({ version: 5 })
      .expect(200);
    
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.version).toBe(6);
  });

  it('11. Soft delete & Fetch after delete', async () => {
    // Delete
    await request(app).delete(`/drafts/${createdDraftId}`).expect(200);

    // Fetch list should not include it
    const listRes = await request(app).get('/drafts').expect(200);
    const draftInList = listRes.body.data.find((d: any) => d.id === createdDraftId);
    expect(draftInList).toBeUndefined();

    // Direct fetch should return 404
    await request(app).get(`/drafts/${createdDraftId}`).expect(404);
  });
});
