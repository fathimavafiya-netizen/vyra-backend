import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: {
    post: { update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));

describe('DraftRepository - Soft Delete', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('deleteDraft sends a Date instance for deletedAt', async () => {
    ((prisma.post as any).update as jest.Mock).mockResolvedValue({});
    await repo.deleteDraft('d1');

    expect((prisma.post as any).update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('listDrafts excludes soft-deleted drafts', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockResolvedValue([]);
    await repo.listDrafts('u1');

    expect((prisma.post as any).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });

  it('countDrafts excludes soft-deleted drafts', async () => {
    ((prisma.post as any).count as jest.Mock).mockResolvedValue(0);
    await repo.countDrafts('u1');

    expect((prisma.post as any).count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });
});
