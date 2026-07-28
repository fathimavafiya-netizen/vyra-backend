import { z } from 'zod';

export const PublishDraftDto = z.object({
  version: z.number({ required_error: 'Version is required for optimistic locking' }),
}).strict();

export type PublishDraftDto = z.infer<typeof PublishDraftDto>;
