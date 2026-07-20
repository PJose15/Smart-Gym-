import { z } from 'zod';
import { uuidString } from './uuid';

export const feedQuerySchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const feedReactSchema = z.object({
  member_id: uuidString,
  event_id: uuidString,
  reaction_type: z.enum(['strength', 'fire', 'champion', 'letsgo']),
});

export const feedCommentSchema = z.object({
  member_id: uuidString,
  event_id: uuidString,
  comment_text: z.string().min(1).max(500),
  mentioned_member_ids: z.array(uuidString).max(10).optional(),
});

export const feedCommentsQuerySchema = z.object({
  event_id: uuidString,
  member_id: uuidString,
});

export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type FeedReactInput = z.infer<typeof feedReactSchema>;
export type FeedCommentInput = z.infer<typeof feedCommentSchema>;
