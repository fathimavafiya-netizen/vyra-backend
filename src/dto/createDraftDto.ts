import { z } from 'zod';

export const CreateDraftDto = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrl: z.string().url(),
  // Additional fields can be added later
});

export type CreateDraftDto = z.infer<typeof CreateDraftDto>;
