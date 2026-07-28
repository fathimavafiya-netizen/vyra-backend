import { DraftRepository } from '../repositories/DraftRepository';
import prisma from '../../../config/db';

jest.mock('../../../config/db', () => ({
  __esModule: true,
  default: { post: { updateMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() } },
}));

describe('DraftRepository - Undefined Values', () => {
  const repo = new DraftRepository();
  afterEach(() => jest.clearAllMocks());

  it('does not send undefined values to Prisma on optimistic update', async () => {
    ((prisma.post as any).updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    jest.spyOn(repo, 'findDraftById').mockResolvedValue({} as any);
    const dto = { caption: 'New', location: undefined } as any;

    await repo.updateDraftOptimistic('id', 1, dto);
    
    const callArgs = ((prisma.post as any).updateMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.data).not.toHaveProperty('location');
    expect(callArgs.data).toHaveProperty('caption', 'New');
  });

  it('does not send undefined values to Prisma on force update', async () => {
    ((prisma.post as any).update as jest.Mock).mockResolvedValue({});
    const dto = { caption: 'New', location: undefined } as any;

    await repo.updateDraftForce('id', dto);
    
    const callArgs = ((prisma.post as any).update as jest.Mock).mock.calls[0][0];
    expect(callArgs.data).not.toHaveProperty('location');
    expect(callArgs.data).toHaveProperty('caption', 'New');
  });
});
