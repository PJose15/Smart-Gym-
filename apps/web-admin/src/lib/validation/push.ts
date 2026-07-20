import { z } from 'zod';
import { uuidString } from './uuid';

export const pushSubscribeSchema = z.object({
  member_id: uuidString,
  gym_id: uuidString,
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
  member_id: uuidString,
  endpoint: z.string().url(),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
