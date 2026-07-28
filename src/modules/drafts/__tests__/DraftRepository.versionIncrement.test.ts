import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: { post: { updateMany: jest.fn(), findUnique: jest.fn() } },
}));

describe('DraftRepository - Version Increment', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('increments version exactly once on optimistic update', async () => {
    ((prisma.post as any).updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    jest.spyOn(repo, 'findDraftById').mockResolvedValue({} as any);

    await repo.updateDraftOptimistic('id', 2, { caption: 'x' } as any);

    expect((prisma.post as any).updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: { increment: 1 },
        }),
      })
    );
  });
});
