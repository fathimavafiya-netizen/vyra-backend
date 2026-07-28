import { z } from 'zod';

export const UpdateDraftDto = z.object({
  version: z.number(),
  caption: z.string().max(2200).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  hashtags: z.array(z.string()).optional(),
  location: z.string().optional(),
  taggedUserIds: z.array(z.string()).optional(),
  scheduledAt: z.preprocess(arg => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg as any);
    return arg;
  }, z.date().optional()),
}).strict();

export type UpdateDraftDto = z.infer<typeof UpdateDraftDto>;
