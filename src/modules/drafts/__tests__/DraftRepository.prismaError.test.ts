import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: {
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('DraftRepository - Prisma Error Propagation', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());
  const dbError = new Error('Database Error');

  it('propagates error on createDraft', async () => {
    ((prisma.post as any).create as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.createDraft({} as any, 'u1')).rejects.toThrow(dbError);
  });

  it('propagates error on findDraftById', async () => {
    ((prisma.post as any).findUnique as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.findDraftById('d1')).rejects.toThrow(dbError);
  });

  it('propagates error on updateDraftOptimistic', async () => {
    ((prisma.post as any).updateMany as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.updateDraftOptimistic('d1', 1, {} as any)).rejects.toThrow(dbError);
  });

  it('propagates error on updateDraftForce', async () => {
    ((prisma.post as any).update as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.updateDraftForce('d1', {} as any)).rejects.toThrow(dbError);
  });

  it('propagates error on deleteDraft', async () => {
    ((prisma.post as any).update as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.deleteDraft('d1')).rejects.toThrow(dbError);
  });

  it('propagates error on listDrafts', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.listDrafts('u1')).rejects.toThrow(dbError);
  });

  it('propagates error on countDrafts', async () => {
    ((prisma.post as any).count as jest.Mock).mockRejectedValue(dbError);
    await expect(repo.countDrafts('u1')).rejects.toThrow(dbError);
  });
});
