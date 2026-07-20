import { z } from 'zod';
import { uuidString } from './uuid';

export const leaderboardQuerySchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
  period: z.enum(['weekly', 'all_time']).default('weekly'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
