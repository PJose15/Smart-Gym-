import { z } from 'zod';

export const setSchema = z.object({
  weight_lbs: z.number().min(0).max(2000),
  reps: z.number().int().min(1).max(100),
  rpe: z.number().min(6).max(10).nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const sessionUpsertSchema = z.object({
  gym_id: z.string().uuid(),
  machine_id: z.string().uuid(),
  member_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  workout_mode: z.enum(['ai_program', 'trainer_program', 'free']).default('free'),
  set: setSchema,
});

export const scanEventSchema = z.object({
  machine_id: z.string().uuid(),
  member_id: z.string().uuid().nullable(),
  gym_id: z.string().uuid(),
  workout_mode: z.enum(['ai_program', 'trainer_program', 'free']).default('free'),
  was_in_program: z.boolean().default(false),
});

export type SetInput = z.infer<typeof setSchema>;
export type SessionUpsertInput = z.infer<typeof sessionUpsertSchema>;
export type ScanEventInput = z.infer<typeof scanEventSchema>;
