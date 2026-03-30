import { z } from 'zod';

export const feedQuerySchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const feedReactSchema = z.object({
  member_id: z.string().uuid(),
  event_id: z.string().uuid(),
  reaction_type: z.enum(['strength', 'fire', 'champion', 'letsgo']),
});

export const feedCommentSchema = z.object({
  member_id: z.string().uuid(),
  event_id: z.string().uuid(),
  comment_text: z.string().min(1).max(500),
  mentioned_member_ids: z.array(z.string().uuid()).max(10).optional(),
});

export const feedCommentsQuerySchema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid(),
});

export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type FeedReactInput = z.infer<typeof feedReactSchema>;
export type FeedCommentInput = z.infer<typeof feedCommentSchema>;
