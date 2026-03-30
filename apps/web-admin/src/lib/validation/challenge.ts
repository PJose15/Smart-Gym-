import { z } from 'zod';

export const challengeListSchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
});

export const challengeDetailSchema = z.object({
  member_id: z.string().uuid(),
});

export const challengeJoinSchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
});

export type ChallengeListInput = z.infer<typeof challengeListSchema>;
export type ChallengeDetailInput = z.infer<typeof challengeDetailSchema>;
export type ChallengeJoinInput = z.infer<typeof challengeJoinSchema>;
