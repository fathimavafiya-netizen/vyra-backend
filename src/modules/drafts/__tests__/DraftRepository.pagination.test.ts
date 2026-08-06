import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: { post: { findMany: jest.fn() } },
}));

describe('DraftRepository - Pagination', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('constructs correct Prisma query for first page', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockResolvedValue([]);
    await repo.listDrafts('u1', undefined, 20);

    expect((prisma.post as any).findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', deletedAt: null, status: { in: ['DRAFT', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: 0,
      cursor: undefined,
    });
  });

  it('constructs correct Prisma query with cursor', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockResolvedValue([]);
    await repo.listDrafts('u1', 'c1', 10);

    expect((prisma.post as any).findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', deletedAt: null, status: { in: ['DRAFT', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip: 1,
      cursor: { id: 'c1' },
    });
  });
  
  it('handles limit > total rows gracefully by passing limit to take', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockResolvedValue([{ id: '1' }]);
    const result = await repo.listDrafts('u1', undefined, 9999);

    expect((prisma.post as any).findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 9999 }));
    expect(result).toHaveLength(1);
  });

  it('handles limit = 1 gracefully', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockResolvedValue([{ id: '1' }]);
    await repo.listDrafts('u1', undefined, 1);

    expect((prisma.post as any).findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
  });
  
  it('handles empty dataset', async () => {
    ((prisma.post as any).findMany as jest.Mock).mockResolvedValue([]);
    const result = await repo.listDrafts('u1', undefined, 10);
    expect(result).toEqual([]);
  });
});
