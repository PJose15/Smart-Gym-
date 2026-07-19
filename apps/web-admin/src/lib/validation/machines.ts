import { z } from 'zod';

export const machineCreateSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  target_muscles: z.array(z.string().min(1).max(40)).min(1).max(10),
  movement_pattern: z
    .enum(['push', 'pull', 'squat', 'hinge', 'carry', 'core', 'isolation', 'unknown'])
    .optional()
    .default('unknown'),
  equipment_type: z
    .enum(['machine', 'cable', 'dumbbell', 'barbell', 'bodyweight', 'smith', 'cardio', 'unknown'])
    .optional()
    .default('machine'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('beginner'),
  setup_steps: z.array(z.string().max(200)).max(15).optional().default([]),
  safety_cues: z.array(z.string().max(200)).max(15).optional().default([]),
});

export type MachineCreateInput = z.infer<typeof machineCreateSchema>;
