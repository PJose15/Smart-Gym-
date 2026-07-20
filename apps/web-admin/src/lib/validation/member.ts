import { z } from 'zod';
import { uuidString } from './uuid';

export const memberHomeQuerySchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
});

export type MemberHomeQuery = z.infer<typeof memberHomeQuerySchema>;
