import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    type: z.enum(['POST', 'REEL', 'VIDEO', 'STORY', 'LIVE']),
    caption: z.string().max(2200, 'Caption is too long').optional(),
    mediaUrl: z.string().url('Invalid media URL').optional(),
    duration: z.number().nonnegative().optional(),
    size: z.number().nonnegative().optional(),
    thumbnailUrl: z.string().url('Invalid thumbnail URL').optional(),
    musicTrackId: z.string().optional(),
    originalPostId: z.string().optional(),
    status: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    media: z.array(
      z.object({
        url: z.string().url('Invalid media URL'),
        type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'image', 'video', 'audio']).optional(),
        duration: z.number().optional(),
        size: z.number().optional(),
        thumbnailUrl: z.string().optional(),
      })
    ).optional(),
  }),
});

export const addCommentSchema = z.object({
  body: z.object({
    text: z.string().min(1, 'Comment text cannot be empty').max(1000),
    parentId: z.string().optional(), // Can support any ID type including uuid or seed ids
  }),
});
