import { z } from 'zod';

export const CancelScheduleDto = z.object({
  version: z.number({ required_error: 'Version is required for optimistic locking' }),
}).strict();

export type CancelScheduleDto = z.infer<typeof CancelScheduleDto>;
