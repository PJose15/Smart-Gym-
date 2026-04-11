import { z } from 'zod';

// ─── Staff Login ─────────────────────────────────────────

export const staffLoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

// ─── Trainer Notes ───────────────────────────────────────

export const trainerNoteSchema = z.object({
  member_id: z.string().uuid('Invalid member'),
  note_type: z.enum(['general', 'form', 'injury', 'progress', 'program']),
  note_text: z.string().min(1, 'Note is required').max(2000, 'Note is too long'),
  session_id: z.string().uuid().nullable().optional(),
  is_visible_to_member: z.boolean().optional().default(false),
});

export type TrainerNoteInput = z.infer<typeof trainerNoteSchema>;

// ─── Trainer Messages ────────────────────────────────────

export const trainerMessageSchema = z.object({
  member_id: z.string().uuid('Invalid member'),
  message_text: z.string().min(1, 'Message is required').max(1000, 'Message is too long'),
});

export type TrainerMessageInput = z.infer<typeof trainerMessageSchema>;

// ─── Gym Settings ────────────────────────────────────────

export const gymSettingsSchema = z.object({
  // Branding
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color').optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color').optional(),
  font_preference: z.string().max(50).optional(),
  custom_domain: z.string().max(253).regex(/^[a-z0-9.-]+$/i, 'Invalid domain').nullable().optional(),
  hide_smartgym_branding: z.boolean().optional(),
  // Public profile
  show_public_profile: z.boolean().optional(),
  show_public_stats: z.boolean().optional(),
  public_profile_headline: z.string().max(200).nullable().optional(),
  // Member experience
  show_gym_feed: z.boolean().optional(),
  show_leaderboards: z.boolean().optional(),
  leaderboard_scope: z.enum(['gym', 'global', 'both']).optional(),
  require_member_photo: z.boolean().optional(),
  allow_anonymous_logging: z.boolean().optional(),
  enable_member_chat_with_ai: z.boolean().optional(),
  // AI Programs
  ai_program_auto_generate: z.boolean().optional(),
  trainer_must_approve_ai_programs: z.boolean().optional(),
  program_duration_weeks: z.number().refine(v => [4, 6, 8, 12].includes(v), 'Must be 4, 6, 8, or 12').optional(),
  // Operations
  at_risk_threshold_days: z.number().min(7).max(30).optional(),
  gym_open_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time').optional(),
  gym_close_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time').optional(),
  timezone: z.string().max(64).optional(),
  weight_unit: z.enum(['lbs', 'kg']).optional(),
  currency: z.string().max(3).optional(),
  // Equipment
  default_maintenance_interval_days: z.number().min(1).max(365).optional(),
  equipment_maintenance_alerts: z.boolean().optional(),
  maintenance_alert_days_ahead: z.number().min(1).max(30).optional(),
  // Trainer defaults
  default_trainer_can_create_challenges: z.boolean().optional(),
  default_trainer_can_manage_all: z.boolean().optional(),
  default_trainer_can_view_analytics: z.boolean().optional(),
  // Owner notifications
  owner_daily_digest: z.boolean().optional(),
  owner_at_risk_alerts: z.boolean().optional(),
  owner_new_member_notification: z.boolean().optional(),
  owner_pr_notifications: z.boolean().optional(),
  owner_monthly_report: z.boolean().optional(),
  owner_maintenance_alerts: z.boolean().optional(),
});

export type GymSettingsInput = z.infer<typeof gymSettingsSchema>;

// ─── Member Settings ─────────────────────────────────────

export const memberSettingsSchema = z.object({
  weight_unit: z.enum(['lbs', 'kg']).optional(),
  date_format: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  profile_visible: z.boolean().optional(),
  show_on_leaderboard: z.boolean().optional(),
  share_achievements: z.boolean().optional(),
  share_prs_to_feed: z.boolean().optional(),
  show_streak_publicly: z.boolean().optional(),
  share_weight_with_trainer: z.boolean().optional(),
  share_workout_with_trainer: z.boolean().optional(),
  show_body_weight: z.boolean().optional(),
});

export type MemberSettingsInput = z.infer<typeof memberSettingsSchema>;

// ─── Trainer Invitations ─────────────────────────────────

export const trainerInvitationSchema = z.object({
  email: z.string().email('Enter a valid email'),
  trainer_name: z.string().min(1, 'Name is required').max(100, 'Name is too long').trim(),
  permissions: z.record(z.string(), z.boolean()).optional().default({}),
});

export type TrainerInvitationInput = z.infer<typeof trainerInvitationSchema>;

// ─── Billing ────────────────────────────────────────────

export const checkoutSchema = z.object({
  tier: z.enum(['starter', 'growth', 'pro']),
  interval: z.enum(['monthly', 'annual']),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const billingUpgradeSchema = z.object({
  tier: z.enum(['starter', 'growth', 'pro']),
  interval: z.enum(['monthly', 'annual']).optional().default('monthly'),
});

export type BillingUpgradeInput = z.infer<typeof billingUpgradeSchema>;
