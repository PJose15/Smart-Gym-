import { z } from 'zod';
import { uuidString } from './uuid';

export const challengeListSchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
});

export const challengeDetailSchema = z.object({
  member_id: uuidString,
});

export const challengeJoinSchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
});

export type ChallengeListInput = z.infer<typeof challengeListSchema>;
export type ChallengeDetailInput = z.infer<typeof challengeDetailSchema>;
export type ChallengeJoinInput = z.infer<typeof challengeJoinSchema>;
