import { z } from 'zod';

export const memberHomeQuerySchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
});

export type MemberHomeQuery = z.infer<typeof memberHomeQuerySchema>;
