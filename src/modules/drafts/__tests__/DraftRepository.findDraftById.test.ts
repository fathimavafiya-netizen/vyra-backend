import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: { post: { findUnique: jest.fn() } },
}));

describe('DraftRepository - findDraftById', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('does not filter out soft-deleted drafts (per existing contract)', async () => {
    const draft = { id: 'd1', deletedAt: new Date() };
    ((prisma.post as any).findUnique as jest.Mock).mockResolvedValue(draft);

    const result = await repo.findDraftById('d1');

    expect((prisma.post as any).findUnique).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(result).toEqual(draft);
  });

  it('returns null if draft does not exist', async () => {
    ((prisma.post as any).findUnique as jest.Mock).mockResolvedValue(null);
    const result = await repo.findDraftById('d1');
    expect(result).toBeNull();
  });
});
