import { DraftRepository } from '../repositories/DraftRepository';
import defaultDraftRepository from '../repositories/DraftRepository';
import { DraftApiError } from '../../../errors/DraftApiError';
import { DraftErrorCode } from '../../../errors/DraftErrorCode';
import { createChildLogger } from '../../../logger/childLogger';
import { LogAction } from '../../../logger/actions';

const logger = createChildLogger('drafts');

export interface ServiceResult<T> {
  success: true;
  data: T;
}

export class DraftService {
  constructor(
    private readonly repository: DraftRepository = defaultDraftRepository
  ) {}

  /**
   * Helper to ensure a draft exists and belongs to the user.
   */
  private async getDraftAndValidateOwnership(draftId: string, userId: string) {
    const draft = await this.repository.findDraftById(draftId);
    if (!draft || draft.deletedAt) {
      throw new DraftApiError('Draft not found', DraftErrorCode.DRAFT_NOT_FOUND, 404);
    }
    if (draft.userId !== userId) {
      throw new DraftApiError('Forbidden', DraftErrorCode.FORBIDDEN, 403);
    }
    return draft;
  }

  async getDraftById(userId: string, draftId: string): Promise<ServiceResult<any>> {
    const draft = await this.getDraftAndValidateOwnership(draftId, userId);
    return { success: true, data: draft };
  }

  async createDraft(userId: string, data: any): Promise<ServiceResult<any>> {
    // Assuming data is already validated by Zod at controller level
    const newDraft = await this.repository.createDraft(data, userId);
    logger.info({ action: LogAction.DRAFT_CREATE, userId, draftId: newDraft.id, message: 'Draft created' });
    return { success: true, data: newDraft };
  }

  async updateDraft(
    userId: string,
    draftId: string,
    version: number,
    data: any,
    force: boolean = false
  ): Promise<ServiceResult<any>> {
    const existing = await this.getDraftAndValidateOwnership(draftId, userId);

    if (existing.status !== 'DRAFT') {
      throw new DraftApiError('Cannot update a draft that is already published or scheduled', DraftErrorCode.INVALID_DRAFT_STATE, 400);
    }

    let updatedDraft;
    if (force) {
      updatedDraft = await this.repository.updateDraftForce(draftId, data);
    } else {
      updatedDraft = await this.repository.updateDraftOptimistic(draftId, version, data);
      if (!updatedDraft) {
        throw new DraftApiError('Draft was modified by another request. Please refresh.', DraftErrorCode.DRAFT_CONFLICT, 409);
      }
    }

    logger.info({ action: LogAction.DRAFT_UPDATE, userId, draftId, version, force, message: 'Draft updated' });
    return { success: true, data: updatedDraft };
  }

  async deleteDraft(userId: string, draftId: string): Promise<ServiceResult<boolean>> {
    await this.getDraftAndValidateOwnership(draftId, userId);
    
    await this.repository.deleteDraft(draftId);
    logger.info({ action: LogAction.DRAFT_DELETE, userId, draftId, message: 'Draft deleted' });
    return { success: true, data: true };
  }

  async listDrafts(userId: string, cursor?: string, limit?: number): Promise<ServiceResult<any[]>> {
    const drafts = await this.repository.listDrafts(userId, cursor, limit);
    logger.debug({ action: LogAction.DRAFT_LIST, userId, cursor, limit, count: drafts.length, message: 'Drafts listed' });
    return { success: true, data: drafts };
  }

  async publishDraft(userId: string, draftId: string, version: number): Promise<ServiceResult<any>> {
    const existing = await this.getDraftAndValidateOwnership(draftId, userId);

    if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
      throw new DraftApiError('Only drafts and scheduled posts can be published', DraftErrorCode.INVALID_DRAFT_STATE, 400);
    }

    const updatedDraft = await this.repository.updateDraftOptimistic(draftId, version, { status: 'PUBLISHED', scheduledAt: null });
    
    if (!updatedDraft) {
      throw new DraftApiError('Conflict while publishing. Please refresh and try again.', DraftErrorCode.DRAFT_CONFLICT, 409);
    }

    logger.info({ action: LogAction.DRAFT_PUBLISH, userId, draftId, version, message: 'Draft published' });
    return { success: true, data: updatedDraft };
  }

  async scheduleDraft(userId: string, draftId: string, version: number, scheduledAt: Date): Promise<ServiceResult<any>> {
    const existing = await this.getDraftAndValidateOwnership(draftId, userId);

    if (existing.status !== 'DRAFT') {
      throw new DraftApiError('Only drafts can be scheduled', DraftErrorCode.INVALID_DRAFT_STATE, 400);
    }

    if (scheduledAt <= new Date()) {
      throw new DraftApiError('Scheduled time must be in the future', DraftErrorCode.VALIDATION_ERROR, 400);
    }

    const updatedDraft = await this.repository.updateDraftOptimistic(draftId, version, { status: 'SCHEDULED', scheduledAt });
    
    if (!updatedDraft) {
      throw new DraftApiError('Conflict while scheduling. Please refresh and try again.', DraftErrorCode.DRAFT_CONFLICT, 409);
    }

    logger.info({ action: LogAction.DRAFT_SCHEDULE, userId, draftId, version, scheduledAt, message: 'Draft scheduled' });
    return { success: true, data: updatedDraft };
  }

  async cancelSchedule(userId: string, draftId: string, version: number): Promise<ServiceResult<any>> {
    const existing = await this.getDraftAndValidateOwnership(draftId, userId);

    if (existing.status !== 'SCHEDULED') {
      throw new DraftApiError('Only scheduled drafts can be cancelled', DraftErrorCode.INVALID_DRAFT_STATE, 400);
    }

    const updatedDraft = await this.repository.updateDraftOptimistic(draftId, version, { status: 'DRAFT', scheduledAt: null });
    
    if (!updatedDraft) {
      throw new DraftApiError('Conflict while cancelling schedule. Please refresh and try again.', DraftErrorCode.DRAFT_CONFLICT, 409);
    }

    logger.info({ action: LogAction.DRAFT_CANCEL_SCHEDULE, userId, draftId, version, message: 'Draft schedule cancelled' });
    return { success: true, data: updatedDraft };
  }
}

export default new DraftService();

