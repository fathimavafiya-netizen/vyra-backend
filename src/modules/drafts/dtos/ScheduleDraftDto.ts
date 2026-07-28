import { z } from 'zod';

export const ScheduleDraftDto = z.object({
  version: z.number({ required_error: 'Version is required for optimistic locking' }),
  scheduledAt: z.preprocess(arg => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg as any);
    return arg;
  }, z.date({ required_error: 'Scheduled date is required' })),
}).strict();

export type ScheduleDraftDto = z.infer<typeof ScheduleDraftDto>;
