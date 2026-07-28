import { z } from 'zod';

export const CreateDraftDto = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  postType: z.enum(['POST', 'REEL', 'STORY']).optional(),
  scheduledAt: z.preprocess(arg => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg as any);
    return arg;
  }, z.date().optional()),
}).strict();

export type CreateDraftDto = z.infer<typeof CreateDraftDto>;
