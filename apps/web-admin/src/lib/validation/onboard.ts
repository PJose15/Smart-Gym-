import { z } from 'zod';

export const onboardRegisterSchema = z.object({
  owner_name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  gym_name: z.string().min(2).max(100).trim(),
  city: z.string().max(100).trim().optional(),
  gym_type: z
    .enum([
      'independent',
      'crossfit',
      'martial-arts',
      'yoga',
      'personal-training',
      'corporate',
      'other',
    ])
    .optional()
    .default('independent'),
});

export type OnboardRegisterInput = z.infer<typeof onboardRegisterSchema>;
