import { z } from 'zod';

export const pushSubscribeSchema = z.object({
  member_id: z.string().uuid(),
  gym_id: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  user_agent: z.string().optional(),
  platform: z.enum(['ios', 'android', 'desktop']).optional(),
});

export const pushUnsubscribeSchema = z.object({
  member_id: z.string().uuid(),
  endpoint: z.string().url(),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
