import { Router } from 'express';
import draftController from '../controllers/DraftController';
import authMiddleware from '../../../middleware/authMiddleware';
import { validateRequest } from '../../../middleware/validationMiddleware';
import { requestIdMiddleware } from '../../../middleware/requestIdMiddleware';

// DTOs
import { CreateDraftDto } from '../dtos/CreateDraftDto';
import { UpdateDraftDto } from '../dtos/UpdateDraftDto';
import { PublishDraftDto } from '../dtos/PublishDraftDto';
import { ScheduleDraftDto } from '../dtos/ScheduleDraftDto';
import { CancelScheduleDto } from '../dtos/CancelScheduleDto';
import { z } from 'zod';

const router = Router();

// Apply middleware to all routes
router.use(requestIdMiddleware);
router.use(authMiddleware);

// GET /drafts
router.get(
  '/',
  validateRequest(z.object({ query: z.object({ cursor: z.string().uuid().optional(), limit: z.string().regex(/^\d+$/).optional() }).optional() })),
  draftController.getDrafts
);

// GET /drafts/:id
router.get(
  '/:id',
  validateRequest(z.object({ params: z.object({ id: z.string() }) })),
  draftController.getDraftById
);

// POST /drafts
router.post(
  '/',
  validateRequest(z.object({ body: CreateDraftDto })),
  draftController.createDraft
);

// PUT /drafts/:id
router.put(
  '/:id',
  validateRequest(z.object({ params: z.object({ id: z.string() }), body: UpdateDraftDto, query: z.object({ force: z.string().optional() }).optional() })),
  draftController.updateDraft
);

// DELETE /drafts/:id
router.delete(
  '/:id',
  validateRequest(z.object({ params: z.object({ id: z.string() }) })),
  draftController.deleteDraft
);

// POST /drafts/:id/publish
router.post(
  '/:id/publish',
  validateRequest(z.object({ params: z.object({ id: z.string() }), body: PublishDraftDto })),
  draftController.publishDraft
);

// POST /drafts/:id/schedule
router.post(
  '/:id/schedule',
  validateRequest(z.object({ params: z.object({ id: z.string() }), body: ScheduleDraftDto })),
  draftController.scheduleDraft
);

// POST /drafts/:id/cancel-schedule
router.post(
  '/:id/cancel-schedule',
  validateRequest(z.object({ params: z.object({ id: z.string() }), body: CancelScheduleDto })),
  draftController.cancelSchedule
);

export default router;
