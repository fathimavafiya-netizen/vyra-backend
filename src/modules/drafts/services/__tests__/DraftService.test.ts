import { DraftService } from '../DraftService';
import { DraftApiError } from '../../../../errors/DraftApiError';
import { DraftErrorCode } from '../../../../errors/DraftErrorCode';

const mockRepository = {
  createDraft: jest.fn(),
  findDraftById: jest.fn(),
  updateDraftOptimistic: jest.fn(),
  updateDraftForce: jest.fn(),
  deleteDraft: jest.fn(),
  listDrafts: jest.fn(),
  countDrafts: jest.fn(),
};

describe('DraftService', () => {
  let service: DraftService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DraftService(mockRepository as any);
  });

  describe('createDraft', () => {
    it('creates a draft and returns standard ServiceResult', async () => {
      mockRepository.createDraft.mockResolvedValue({ id: 'd1', userId: 'u1' });
      const result = await service.createDraft('u1', { caption: 'Test' });
      expect(result).toEqual({ success: true, data: { id: 'd1', userId: 'u1' } });
      expect(mockRepository.createDraft).toHaveBeenCalledWith({ caption: 'Test' }, 'u1');
    });
  });

  describe('updateDraft', () => {
    it('throws FORBIDDEN if user does not own draft', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u2' });
      await expect(service.updateDraft('u1', 'd1', 1, {})).rejects.toThrow(
        new DraftApiError('Forbidden', DraftErrorCode.FORBIDDEN)
      );
    });

    it('throws DRAFT_NOT_FOUND if draft does not exist', async () => {
      mockRepository.findDraftById.mockResolvedValue(null);
      await expect(service.updateDraft('u1', 'd1', 1, {})).rejects.toThrow(
        new DraftApiError('Draft not found', DraftErrorCode.DRAFT_NOT_FOUND)
      );
    });

    it('throws INVALID_DRAFT_STATE if draft is PUBLISHED', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'PUBLISHED' });
      await expect(service.updateDraft('u1', 'd1', 1, {})).rejects.toThrow(
        new DraftApiError('Cannot update a draft that is already published or scheduled', DraftErrorCode.INVALID_DRAFT_STATE)
      );
    });

    it('updates using optimistic lock by default', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      mockRepository.updateDraftOptimistic.mockResolvedValue({ id: 'd1', status: 'DRAFT', version: 2 });
      
      const result = await service.updateDraft('u1', 'd1', 1, { caption: 'Updated' });
      
      expect(mockRepository.updateDraftOptimistic).toHaveBeenCalledWith('d1', 1, { caption: 'Updated' });
      expect(result.data.version).toBe(2);
    });

    it('throws DRAFT_CONFLICT if optimistic lock fails', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      mockRepository.updateDraftOptimistic.mockResolvedValue(null);
      
      await expect(service.updateDraft('u1', 'd1', 1, { caption: 'Updated' })).rejects.toThrow(
        new DraftApiError('Draft was modified by another request. Please refresh.', DraftErrorCode.DRAFT_CONFLICT)
      );
    });

    it('bypasses conflict check if force is true', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      mockRepository.updateDraftForce.mockResolvedValue({ id: 'd1', status: 'DRAFT' });
      
      const result = await service.updateDraft('u1', 'd1', 1, { caption: 'Forced' }, true);
      
      expect(mockRepository.updateDraftForce).toHaveBeenCalledWith('d1', { caption: 'Forced' });
      expect(mockRepository.updateDraftOptimistic).not.toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });
  });

  describe('deleteDraft', () => {
    it('throws FORBIDDEN if not owner', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u2' });
      await expect(service.deleteDraft('u1', 'd1')).rejects.toThrow(
        new DraftApiError('Forbidden', DraftErrorCode.FORBIDDEN)
      );
    });

    it('deletes draft successfully', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1' });
      mockRepository.deleteDraft.mockResolvedValue(true);
      
      const result = await service.deleteDraft('u1', 'd1');
      expect(mockRepository.deleteDraft).toHaveBeenCalledWith('d1');
      expect(result).toEqual({ success: true, data: true });
    });
  });

  describe('publishDraft', () => {
    it('publishes DRAFT', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      mockRepository.updateDraftOptimistic.mockResolvedValue({ id: 'd1', status: 'PUBLISHED' });
      
      const result = await service.publishDraft('u1', 'd1', 1);
      expect(mockRepository.updateDraftOptimistic).toHaveBeenCalledWith('d1', 1, { status: 'PUBLISHED', scheduledAt: null });
      expect(result.data.status).toBe('PUBLISHED');
    });

    it('publishes SCHEDULED draft', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'SCHEDULED' });
      mockRepository.updateDraftOptimistic.mockResolvedValue({ id: 'd1', status: 'PUBLISHED' });
      
      await service.publishDraft('u1', 'd1', 1);
      expect(mockRepository.updateDraftOptimistic).toHaveBeenCalledWith('d1', 1, { status: 'PUBLISHED', scheduledAt: null });
    });

    it('throws if already published', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'PUBLISHED' });
      await expect(service.publishDraft('u1', 'd1', 1)).rejects.toThrow(DraftApiError);
    });
  });

  describe('scheduleDraft', () => {
    it('schedules a draft', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      mockRepository.updateDraftOptimistic.mockResolvedValue({ id: 'd1', status: 'SCHEDULED' });
      
      const futureDate = new Date(Date.now() + 100000);
      const result = await service.scheduleDraft('u1', 'd1', 1, futureDate);
      
      expect(mockRepository.updateDraftOptimistic).toHaveBeenCalledWith('d1', 1, { status: 'SCHEDULED', scheduledAt: futureDate });
      expect(result.data.status).toBe('SCHEDULED');
    });

    it('throws if date is in the past', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      const pastDate = new Date(Date.now() - 100000);
      
      await expect(service.scheduleDraft('u1', 'd1', 1, pastDate)).rejects.toThrow(
        new DraftApiError('Scheduled time must be in the future', DraftErrorCode.VALIDATION_ERROR)
      );
    });
  });

  describe('cancelSchedule', () => {
    it('cancels a schedule and reverts to DRAFT', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'SCHEDULED' });
      mockRepository.updateDraftOptimistic.mockResolvedValue({ id: 'd1', status: 'DRAFT' });
      
      const result = await service.cancelSchedule('u1', 'd1', 1);
      
      expect(mockRepository.updateDraftOptimistic).toHaveBeenCalledWith('d1', 1, { status: 'DRAFT', scheduledAt: null });
      expect(result.data.status).toBe('DRAFT');
    });

    it('throws if draft is not scheduled', async () => {
      mockRepository.findDraftById.mockResolvedValue({ id: 'd1', userId: 'u1', status: 'DRAFT' });
      await expect(service.cancelSchedule('u1', 'd1', 1)).rejects.toThrow(
        new DraftApiError('Only scheduled drafts can be cancelled', DraftErrorCode.INVALID_DRAFT_STATE)
      );
    });
  });
});
