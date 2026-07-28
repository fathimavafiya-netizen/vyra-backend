import { Request, Response, NextFunction } from 'express';
import draftService from '../services/DraftService';
import { ok, setDraftETag } from '../../../utils/apiResponse';

export class DraftController {
  async getDrafts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const cursor = req.query.cursor as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      
      const result = await draftService.listDrafts(userId, cursor, limit);
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }

  async getDraftById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      
      const result = await draftService.getDraftById(userId, draftId);
      if (result.data?.version) {
        setDraftETag(res, result.data.version);
      }
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }

  async createDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await draftService.createDraft(userId, req.body);
      if (result.data?.version) {
        setDraftETag(res, result.data.version);
      }
      return ok(res, result.data, 201);
    } catch (e) {
      next(e);
    }
  }

  async updateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      const { version, ...updateData } = req.body;
      const force = req.query.force === 'true';

      const result = await draftService.updateDraft(userId, draftId, version, updateData, force);
      if (result.data?.version) {
        setDraftETag(res, result.data.version);
      }
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }

  async deleteDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      
      const result = await draftService.deleteDraft(userId, draftId);
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }

  async publishDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      const { version } = req.body;

      const result = await draftService.publishDraft(userId, draftId, version);
      if (result.data?.version) {
        setDraftETag(res, result.data.version);
      }
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }

  async scheduleDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      const { version, scheduledAt } = req.body;

      const result = await draftService.scheduleDraft(userId, draftId, version, new Date(scheduledAt));
      if (result.data?.version) {
        setDraftETag(res, result.data.version);
      }
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }

  async cancelSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const draftId = req.params.id;
      const { version } = req.body;

      const result = await draftService.cancelSchedule(userId, draftId, version);
      if (result.data?.version) {
        setDraftETag(res, result.data.version);
      }
      return ok(res, result.data);
    } catch (e) {
      next(e);
    }
  }
}

export default new DraftController();
