import { z } from 'zod';

export const leaderboardQuerySchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
  period: z.enum(['weekly', 'all_time']).default('weekly'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
