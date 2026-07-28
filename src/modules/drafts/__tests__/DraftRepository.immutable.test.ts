import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: { post: { updateMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() } },
}));

describe('DraftRepository - Immutable Fields', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('strips immutable fields before sending to Prisma on optimistic update', async () => {
    ((prisma.post as any).updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    const dto = { version: 1, caption: 'New', userId: 'evil', createdAt: new Date() } as any;
    
    // We mock findDraftById since updateDraftOptimistic calls it
    jest.spyOn(repo, 'findDraftById').mockResolvedValue({} as any);

    await repo.updateDraftOptimistic('id', 1, dto);
    
    expect((prisma.post as any).updateMany).toHaveBeenCalledWith({
      where: { id: 'id', version: 1 },
      data: { caption: 'New', version: { increment: 1 } },
    });
  });

  it('strips immutable fields before sending to Prisma on force update', async () => {
    ((prisma.post as any).update as jest.Mock).mockResolvedValue({});
    const dto = { version: 1, caption: 'New', userId: 'evil', createdAt: new Date() } as any;

    await repo.updateDraftForce('id', dto);
    
    expect((prisma.post as any).update).toHaveBeenCalledWith({
      where: { id: 'id' },
      data: { caption: 'New' },
    });
  });
});
