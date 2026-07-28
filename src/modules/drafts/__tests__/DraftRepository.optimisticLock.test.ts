import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: { post: { updateMany: jest.fn(), findUnique: jest.fn() } },
}));

describe('DraftRepository - Optimistic Lock', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('returns null and skips findUnique when version mismatch occurs (count = 0)', async () => {
    ((prisma.post as any).updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const findUniqueSpy = jest.spyOn(repo, 'findDraftById');

    const result = await repo.updateDraftOptimistic('d1', 1, {} as any);

    expect(result).toBeNull();
    expect(findUniqueSpy).not.toHaveBeenCalled();
  });
  
  it('calls findDraftById only when updateMany succeeds (count > 0)', async () => {
    ((prisma.post as any).updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const findUniqueSpy = jest.spyOn(repo, 'findDraftById').mockResolvedValue({ id: 'd1' } as any);

    const result = await repo.updateDraftOptimistic('d1', 1, {} as any);

    expect(result).toEqual({ id: 'd1' });
    expect(findUniqueSpy).toHaveBeenCalledWith('d1');
  });
});
