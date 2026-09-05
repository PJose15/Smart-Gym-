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

// ─── Workout share (M-5) ────────────────────────────────────────────────────
// context/results are stored in gym_feed_events.context_data and rendered in
// the gym feed, so only bounded strings/numbers are accepted; unknown keys
// are rejected outright (.strict()).

export const workoutShareContextSchema = z
  .object({
    share_status: z.enum(['training', 'completed']),
    program_week: z.number().int().min(0).max(200).nullable(),
    program_day: z.number().int().min(0).max(31).nullable(),
    program_focus: z.string().max(120).nullable(),
    sessions_completed_today: z.number().int().min(0).max(50),
    prs_hit: z.number().int().min(0).max(200),
    volume_lbs: z.number().min(0).max(2_000_000),
    machines_used: z.array(z.string().max(80)).max(50),
    completed_at: z.string().max(40).optional(),
  })
  .strict();

export const workoutShareBodySchema = z.object({
  share_text: z.string().max(500).default(''),
  program_context: workoutShareContextSchema.nullable().default(null),
});

export const workoutShareResultsSchema = z
  .object({
    sessionsToday: z.number().int().min(0).max(50),
    prsHit: z.number().int().min(0).max(200),
    totalVolume: z.number().min(0).max(2_000_000),
    machinesUsed: z.array(z.string().max(80)).max(50),
  })
  .strict();

export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type FeedReactInput = z.infer<typeof feedReactSchema>;
export type FeedCommentInput = z.infer<typeof feedCommentSchema>;
