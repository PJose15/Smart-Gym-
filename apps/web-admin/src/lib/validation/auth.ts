import { z } from 'zod';

// Strip non-digits for storage, keep + prefix for E.164
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  // If no + prefix and 10 digits, assume US
  if (!digits.startsWith('+') && digits.length === 10) {
    return `+1${digits}`;
  }
  return digits;
}

export const phoneSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .transform(normalizePhone)
    .refine(
      (val) => /^\+\d{10,15}$/.test(val),
      'Enter a valid phone number'
    ),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long')
    .trim(),
  gym_id: z.string().uuid('Invalid gym'),
});

export const otpSchema = z.object({
  phone: z.string().min(10).max(20).transform(normalizePhone),
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
  gym_id: z.string().uuid('Invalid gym'),
  name: z.string().min(1).max(100).trim().optional(),
});

// Login-mode phone (returning member requesting a sign-in code, no gym context).
export const phoneLoginSchema = z.object({
  phone: z.string().min(10).max(20).transform(normalizePhone),
});

// Login-mode OTP (returning member signing in with no gym/scan context).
// The member is already linked to a gym from their first phone verify, so we
// resolve them by user_id after verifyOtp — no gym_id needed.
export const otpLoginSchema = z.object({
  phone: z.string().min(10).max(20).transform(normalizePhone),
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const lookupSchema = z.object({
  phone: z.string().min(10).max(20).transform(normalizePhone),
  gym_id: z.string().uuid('Invalid gym'),
});

export type PhoneInput = z.input<typeof phoneSchema>;
export type OTPInput = z.input<typeof otpSchema>;
export type LookupInput = z.input<typeof lookupSchema>;
