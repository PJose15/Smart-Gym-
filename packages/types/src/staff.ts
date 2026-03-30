// ============================================================================
// Phase 6 — Staff / Trainer / Owner Types
// ============================================================================

export type StaffRole = 'trainer' | 'owner';

export interface StaffSession {
  user_id: string;
  gym_id: string;
  role: StaffRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  permissions: Record<string, boolean>;
  gym: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
}

// ─── Trainer Note Types ──────────────────────────────────

export type TrainerNoteType = 'general' | 'form' | 'injury' | 'progress' | 'program';

export interface TrainerNote {
  id: string;
  trainer_id: string;
  member_id: string;
  gym_id: string;
  note_type: TrainerNoteType;
  note_text: string;
  session_id: string | null;
  is_visible_to_member: boolean;
  created_at: string;
}

// ─── Trainer Message Types ───────────────────────────────

export type MessageSenderType = 'trainer' | 'member';

export interface TrainerMessage {
  id: string;
  trainer_id: string;
  member_id: string;
  gym_id: string;
  sender_type: MessageSenderType;
  message_text: string;
  sent_at: string;
  read_at: string | null;
  is_deleted_by_trainer: boolean;
  is_deleted_by_member: boolean;
}

export interface ConversationPreview {
  member_id: string;
  member_name: string;
  avatar_url: string | null;
  last_message: string;
  last_sent_at: string;
  unread_count: number;
}

// ─── Owner Dashboard Types ───────────────────────────────

export interface OwnerDashboardMetrics {
  total_members: number;
  active_members_7d: number;
  workouts_this_week: number;
  workouts_change_pct: number;
  total_machines: number;
  machines_needing_maintenance: number;
  revenue_placeholder: string;
}

export interface MachinePerformance {
  machine_id: string;
  machine_name: string;
  equipment_type: string;
  sessions_7d: number;
  unique_users_7d: number;
}

export interface PeakHourCell {
  day_of_week: number; // 0=Sun, 6=Sat
  hour: number;        // 0-23
  count: number;
}

export interface ActivityFeedItem {
  id: string;
  event_type: string;
  description: string;
  actor_name: string | null;
  created_at: string;
}

// ─── Settings Types ──────────────────────────────────────

export interface GymSettings {
  id: string;
  gym_id: string;
  // Branding
  primary_color: string;
  secondary_color: string;
  font_preference: string;
  custom_domain: string | null;
  hide_smartgym_branding: boolean;
  // Public profile
  show_public_profile: boolean;
  show_public_stats: boolean;
  public_profile_headline: string | null;
  // Member experience
  show_gym_feed: boolean;
  show_leaderboards: boolean;
  leaderboard_scope: string;
  require_member_photo: boolean;
  allow_anonymous_logging: boolean;
  enable_member_chat_with_ai: boolean;
  // AI Programs
  ai_program_auto_generate: boolean;
  trainer_must_approve_ai_programs: boolean;
  program_duration_weeks: number;
  // Operations
  at_risk_threshold_days: number;
  gym_open_time: string;
  gym_close_time: string;
  timezone: string;
  weight_unit: string;
  currency: string;
  // Equipment
  default_maintenance_interval_days: number;
  equipment_maintenance_alerts: boolean;
  maintenance_alert_days_ahead: number;
  // Trainer defaults
  default_trainer_can_create_challenges: boolean;
  default_trainer_can_manage_all: boolean;
  default_trainer_can_view_analytics: boolean;
  // Owner notifications
  owner_daily_digest: boolean;
  owner_at_risk_alerts: boolean;
  owner_new_member_notification: boolean;
  owner_pr_notifications: boolean;
  owner_monthly_report: boolean;
  owner_maintenance_alerts: boolean;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface MemberSettingsData {
  id: string;
  member_id: string;
  weight_unit: string;
  date_format: string;
  profile_visible: boolean;
  show_on_leaderboard: boolean;
  share_achievements: boolean;
  share_prs_to_feed: boolean;
  show_streak_publicly: boolean;
  share_weight_with_trainer: boolean;
  share_workout_with_trainer: boolean;
  show_body_weight: boolean;
  updated_at: string;
}

// ─── Trainer Invitation Types ────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TrainerInvitation {
  id: string;
  gym_id: string;
  email: string;
  trainer_name: string;
  invited_by: string | null;
  token: string;
  permissions: Record<string, boolean>;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// ─── Trainer Today Types ─────────────────────────────────

export interface TrainerTodayData {
  attention_items: AttentionItem[];
  members_training_now: TrainingNowMember[];
  todays_sessions: TodaySessionSummary[];
  recent_prs: RecentPR[];
}

export interface AttentionItem {
  type: 'at_risk' | 'injury_report' | 'program_ending' | 'new_member';
  member_name: string;
  member_id: string;
  description: string;
}

export interface TrainingNowMember {
  member_id: string;
  member_name: string;
  avatar_url: string | null;
  started_at: string;
  exercises_count: number;
}

export interface TodaySessionSummary {
  session_id: string;
  member_id: string;
  member_name: string;
  started_at: string;
  finished_at: string | null;
  exercises_count: number;
  total_sets: number;
}

export interface RecentPR {
  member_name: string;
  member_id: string;
  exercise_name: string;
  value: number;
  pr_type: string;
  achieved_at: string;
}

// ─── Trainer Member List Types ───────────────────────────

export interface TrainerMemberListItem {
  member_id: string;
  member_name: string;
  avatar_url: string | null;
  last_session_date: string | null;
  total_sessions: number;
  current_streak: number;
  status: 'active' | 'at_risk' | 'inactive';
  has_program: boolean;
}
