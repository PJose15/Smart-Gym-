// ============================================================================
// Phase 9 — Super Admin Types
// ============================================================================

export type {
  AdminSession,
  PlatformFeatureFlag,
  PlatformDailyMetrics,
  PlatformOverviewData,
  PlatformFlagKey,
} from './admin';

export { PLATFORM_FLAG_KEYS, CRITICAL_FLAGS } from './admin';

// ============================================================================
// Phase 8.5 — Performance DNA Types
// ============================================================================

export type {
  DNADimension,
  DNAScores,
  DNADimensionScore,
  DNAArchetype,
  DNASnapshot,
  DNAResult,
  DNASignals,
} from './dna';

// ============================================================================
// Phase 8.4 — Social Graph Types
// ============================================================================

export type {
  GoalType,
  MemberGoal,
  MachineLeaderboardEntry,
  WorkoutShareStatus,
  WorkoutShareContext,
  WorkoutShareResults,
} from './socialGraph';

// ============================================================================
// Phase 8.3 — Weekly Check-In Types
// ============================================================================

export type {
  CheckInSentBy,
  PRDetail,
  CheckInWeekData,
  CheckInRecord,
} from './checkIn';

// ============================================================================
// Phase 8.2 — Muscle Map Types
// ============================================================================

export type {
  MuscleGroupKey,
  MuscleRecoveryStateLabel,
  BodySide,
  MuscleGroupInfo,
  MachineMuscleMappings,
  MuscleRecoveryState,
  MuscleMapRecommendations,
  MuscleMapResult,
} from './muscleMap';

// ============================================================================
// Phase 8.1 — Training Readiness Score Types
// ============================================================================

export type {
  ReadinessZone,
  ReadinessInputs,
  ReadinessSignalBreakdown,
  ReadinessResult,
} from './readiness';

// ============================================================================
// Phase 7 — Billing & Feature Gating Types
// ============================================================================

export type {
  SubscriptionTier,
  SubscriptionStatus,
  BillingInterval,
  TierFeatures,
  TierDefinition,
  BillingInfo,
  FeatureAccessResult,
} from './billing';

// ============================================================================
// Phase 6 — Staff / Trainer / Owner Types
// ============================================================================

export type {
  StaffRole,
  StaffSession,
  TrainerNoteType,
  TrainerNote,
  MessageSenderType,
  TrainerMessage,
  ConversationPreview,
  OwnerDashboardMetrics,
  MachinePerformance,
  PeakHourCell,
  ActivityFeedItem,
  GymSettings,
  MemberSettingsData,
  InvitationStatus,
  TrainerInvitation,
  TrainerTodayData,
  AttentionItem,
  TrainingNowMember,
  TodaySessionSummary,
  RecentPR,
  TrainerMemberListItem,
} from './staff';

// ============================================================================
// Equipment Types
// ============================================================================

export type MovementPattern = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'core' | 'isolation' | 'unknown';
export type EquipmentType = 'machine' | 'cable' | 'dumbbell' | 'barbell' | 'bodyweight' | 'smith' | 'cardio' | 'unknown';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Machine {
  id: string;
  gym_id: string;
  name: string;
  qr_slug: string;
  muscle_groups: string[];
  target_muscles: string[];
  setup_steps: string[];
  safety_cues: string[];
  image_url: string | null;
  common_mistakes: string[];
  cue_version: number;
  cue_source: string;
  movement_pattern: MovementPattern;
  equipment_type: EquipmentType;
  difficulty: Difficulty;
  primary_muscles: string[];
  secondary_muscles: string[];
  tags: string[] | null;
  form_checklist_before: string[] | null;
  form_checklist_during: string[] | null;
  form_checklist_after: string[] | null;
  checklist_version: number;
  created_at: string;
}

// ============================================================================
// Identity Types
// ============================================================================

export interface Gym {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface GymMember {
  id: string;
  gym_id: string;
  profile_id: string;
  role: UserRole;
  joined_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export type UserRole = 'owner' | 'trainer' | 'member';

// ============================================================================
// Training / Program Types
// ============================================================================

export interface Program {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  day_number: number;
  name: string;
}

export interface ProgramExercise {
  id: string;
  program_day_id: string;
  machine_id: string | null;
  exercise_name: string;
  order_index: number;
  default_sets: number;
  default_reps: number;
}

// ============================================================================
// Logging Types
// ============================================================================

export type WorkoutStatus = 'in_progress' | 'completed' | 'cancelled';

export interface MemberProgramAssignment {
  id: string;
  gym_id: string;
  profile_id: string;
  program_id: string;
  assigned_by: string;
  assigned_at: string;
}

export interface Workout {
  id: string;
  gym_id: string;
  profile_id: string;
  status: WorkoutStatus;
  started_at: string;
  finished_at: string | null;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  machine_id: string | null;
  exercise_name: string;
  order_index: number;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  notes?: string;
  logged_at: string;
}

// Joined type for exercise with its sets (used in workout UI)
export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];
  machine?: Machine;
}

// ============================================================================
// Gamification Types
// ============================================================================

export type PointsReason = 'workout_completed' | 'set_logged' | 'streak_bonus' | 'badge_unlocked' | 'manual';

export interface PointsLedger {
  id: string;
  gym_id: string;
  profile_id: string;
  points: number;
  reason: PointsReason;
  reference_id: string | null;
  created_at: string;
}

// ─── Badge Types ──────────────────────────────────────

export type BadgeCriteriaType =
  | 'first_workout'
  | 'workouts_10' | 'workouts_50' | 'workouts_100'
  | 'streak_4' | 'streak_12'
  | 'total_volume_10k' | 'total_volume_100k'
  | 'prs_5' | 'prs_25'
  | 'points_500' | 'points_5000';

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Badge {
  id: string;
  gym_id: string | null;
  slug: string;
  name: string;
  description: string;
  icon_emoji: string;
  criteria_type: BadgeCriteriaType;
  criteria_value: number;
  rarity: BadgeRarity;
  sort_order: number;
  created_at: string;
}

export interface MemberBadge {
  id: string;
  gym_id: string;
  profile_id: string;
  badge_id: string;
  unlocked_at: string;
}

export interface BadgeWithStatus extends Badge {
  unlocked: boolean;
  unlocked_at: string | null;
}

// ============================================================================
// AI Assist Types
// ============================================================================

export type ReasonCode =
  | 'REPEAT_LAST_SET'
  | 'INCREASE_SMALL'
  | 'DECREASE_FATIGUE'
  | 'REPS_ONLY'
  | 'NEW_MACHINE_BASELINE'
  | 'INSUFFICIENT_DATA';

export type Confidence = number; // 0–1

export interface NextSetSuggestion {
  suggested_weight: number | null;
  suggested_reps: number | null;
  suggested_rpe: number | null;
  confidence: Confidence;
  reason_code: ReasonCode;
  reason_text: string;
  safety_note?: string;
  should_suggest_increase: boolean;
}

export type PRType = 'PR_WEIGHT' | 'PR_REPS' | 'PR_EST_1RM';

export interface PRDetection {
  type: PRType;
  exercise_name: string;
  machine_id?: string;
  value: number;
  previous_value: number | null;
}

export interface WorkoutInsight {
  total_sets: number;
  total_reps: number;
  total_volume_kg: number;
  top_exercises_by_volume: Array<{ exercise_name: string; volume: number }>;
  prs: PRDetection[];
  volume_change: number | null;   // percentage vs previous session
  reps_change: number | null;
  weight_change: number | null;
  insight_text: string;
  next_time_suggestion: string;
}

export interface MachineCues {
  setup_steps: string[];
  safety_cues: string[];
  common_mistakes: string[];
  cue_version: number;
  cue_source: string;
}

// Feature flags: use PlatformFeatureFlag (re-exported from ./admin) — the
// deployed feature_flags table is global-only (flag_key/is_enabled), never
// per-gym or per-profile.

export interface AppEvent {
  id?: string;
  gym_id?: string | null;
  profile_id?: string | null;
  event_name: string;
  event_props?: Record<string, unknown>;
  created_at?: string;
}

export interface AiAuditLog {
  id?: string;
  gym_id?: string | null;
  profile_id?: string | null;
  context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation' | 'alternatives' | 'guardrails' | 'coach_draft' | 'safety_nudge' | 'checklist' | 'coaching' | 'program_gen';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  created_at?: string;
}

// ─── Machine Alternatives Types ─────────────────────────

export interface AlternativeResult {
  machine: Machine;
  score: number;
  reasons: string[];
  tradeoff_text?: string;
}

// ─── Set Feedback Types ─────────────────────────────────

export type SetFeedbackRating = 'ok' | 'unstable' | 'discomfort';
export type BodyArea = 'knee' | 'shoulder' | 'back' | 'wrist' | 'neck' | 'other';

export interface SetFeedback {
  id: string;
  gym_id: string;
  profile_id: string;
  workout_id: string;
  workout_exercise_id: string;
  set_id: string;
  feedback: SetFeedbackRating;
  body_area: BodyArea | null;
  notes: string | null;
  created_at: string;
}

// ─── Form Checklist Types ───────────────────────────────

export interface FormChecklist {
  before: string[];
  during: string[];
  after: string[];
}

// ─── Guardrail Types ────────────────────────────────────

export type GuardrailType = 'volume_spike' | 'high_rpe' | 'rep_collapse' | 'recovery_overlap';
export type GuardrailSeverity = 'low' | 'medium' | 'high';
export type GuardrailAction = 'reduce_load' | 'reduce_sets' | 'rest_day' | 'deload_light';

export interface GuardrailInsight {
  insight_type: GuardrailType;
  severity: GuardrailSeverity;
  confidence: number;
  message: string;
  recommended_action: GuardrailAction;
  meta?: Record<string, unknown>;
}

export type UserGoal = 'hypertrophy' | 'strength' | 'endurance' | 'general';

export type WeightUnit = 'kg' | 'lbs';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface UserTrainingProfile {
  id: string;
  gym_id: string;
  profile_id: string;
  goal: UserGoal;
  experience: ExperienceLevel;
  units: WeightUnit;
  preferred_rep_min: number | null;
  preferred_rep_max: number | null;
  limitations: string[];
  created_at: string;
  updated_at: string;
}

export interface TodayExplanation {
  day_label: string;
  exercise_count: number;
  focus_muscles: string[];
  reasoning: string;
  last_workout_gap_text: string | null;
}

// ============================================================================
// Dashboard / UI Types
// ============================================================================

export interface DashboardStat {
  title: string;
  value: string | number;
  change?: number; // Percentage change (e.g., 12 for +12%)
  trend?: 'up' | 'down' | 'neutral'; // Trend direction
}

export interface WorkoutSummary {
  workout_id: string;
  total_exercises: number;
  total_sets: number;
  total_reps: number;
  total_volume_kg: number;
  duration_minutes: number;
}

// ─── Progress Types ─────────────────────────────────────

export interface ExerciseHistoryEntry {
  workout_id: string;
  workout_started_at: string;
  exercise_name: string;
  sets: WorkoutSet[];
  best_set_volume: number; // weight * reps for best set
}

export interface PersonalRecord {
  exercise_name: string;
  machine_id?: string;
  best_weight_kg: number;
  best_reps_at_weight: number;
  best_volume_set: number; // weight * reps
  estimated_1rm: number;
  achieved_at: string;
}

// ============================================================================
// Trainer Co-Pilot Types (Phase 2.5.3)
// ============================================================================

export type TrainerAssignmentStatus = 'active' | 'paused';

export interface TrainerAssignment {
  id: string;
  gym_id: string;
  trainer_profile_id: string;
  member_profile_id: string;
  status: TrainerAssignmentStatus;
  created_at: string;
}

export type CoachNoteSource = 'workout' | 'weekly' | 'manual';
export type CoachNoteStatus = 'draft' | 'sent' | 'archived';

export interface CoachNote {
  id: string;
  gym_id: string;
  trainer_profile_id: string;
  member_profile_id: string;
  source: CoachNoteSource;
  status: CoachNoteStatus;
  title: string;
  body: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
}

export type DraftStatus = 'pending' | 'approved' | 'sent' | 'discarded';

export interface CoachNoteDraft {
  id: string;
  gym_id: string;
  trainer_profile_id: string;
  member_profile_id: string;
  workout_id: string | null;
  period_start: string | null;
  period_end: string | null;
  draft_title: string;
  draft_body: string;
  confidence: number;
  signals: DraftSignals | null;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
}

export interface DraftSignals {
  prs?: Array<{ exercise: string; type: string; value: number }>;
  volume_change_pct?: number | null;
  total_sets?: number;
  total_reps?: number;
  total_volume_kg?: number;
  guardrails?: Array<{ type: string; severity: string; message: string }>;
  streak_days?: number;
  workouts_in_period?: number;
  goal?: string;
  experience?: string;
  feedback_trends?: { discomfort_count_7d: number; unstable_count_7d: number; top_body_areas: string[] };
  adherence_vs_plan?: { expected_workouts: number; actual_workouts: number };
}

export type CoachNoteActionType = 'generated' | 'edited' | 'approved' | 'sent' | 'discarded';

export interface CoachNoteAction {
  id: string;
  gym_id: string;
  draft_id: string | null;
  note_id: string | null;
  actor_profile_id: string;
  action: CoachNoteActionType;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// Phase 2.6 — Leaderboard Types
// ============================================================================

export type LeaderboardPeriod = 'weekly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  total_points: number;
  is_current_user: boolean;
}

// ─── Coaching Types ─────────────────────────────────────

export interface CoachingInsightDisplay {
  message: string;
  action_items: string[];
  source: 'ai' | 'rules';
}

// ============================================================================
// Phase 2.5.4 — Session Intent, Style Settings, Acknowledgements
// ============================================================================

export type SessionIntent = 'push' | 'maintain' | 'light';

// ─── Trainer Style Settings ────────────────────────────

export type TrainerTone = 'strict' | 'supportive' | 'neutral';
export type TrainerVerbosity = 'short' | 'standard' | 'detailed';

export interface TrainerStyleSettings {
  id: string;
  gym_id: string;
  trainer_profile_id: string;
  tone: TrainerTone;
  verbosity: TrainerVerbosity;
  created_at: string;
  updated_at: string;
}

// ─── Guardrail Acknowledgement ─────────────────────────

export interface GuardrailAcknowledgement {
  id: string;
  gym_id: string;
  profile_id: string;
  insight_type: GuardrailType;
  severity: GuardrailSeverity;
  acknowledged_at: string;
}

// ─── Member Note Acknowledgement ───────────────────────

export interface MemberNoteAck {
  id: string;
  note_id: string;
  profile_id: string;
  acknowledged_at: string;
}

// ============================================================================
// Phase 4.1 — Equipment Maintenance Types
// ============================================================================

export type MaintenanceStatus = 'ok' | 'due_soon' | 'overdue' | 'in_maintenance';

export interface MaintenanceLog {
  id: string;
  gym_id: string;
  machine_id: string;
  performed_by: string | null;
  notes: string | null;
  performed_at: string;
  created_at: string;
}

export interface MachineMaintenanceOverview {
  machine_id: string;
  machine_name: string;
  equipment_type: string;
  maintenance_status: MaintenanceStatus;
  maintenance_interval_days: number;
  last_maintained_at: string | null;
  days_since_maintenance: number;
  usage_since_maintenance: number;
}

// ============================================================================
// Phase 4.2 — Occupancy Heatmap Types
// ============================================================================

export interface HourlyUsageCell {
  day_of_week: number;
  hour_of_day: number;
  session_count: number;
}

export interface MachineUsageFrequency {
  machine_id: string;
  machine_name: string;
  equipment_type: string;
  session_count: number;
  unique_users: number;
}

// ============================================================================
// Phase 4.3 — Multi-Gym Franchise Types
// ============================================================================

export interface Franchise {
  id: string;
  name: string;
  owner_profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface FranchiseGym {
  id: string;
  franchise_id: string;
  gym_id: string;
  added_at: string;
}

export interface FranchiseGymOverview {
  gym_id: string;
  gym_name: string;
  total_members: number;
  total_machines: number;
  workouts_7d: number;
  workouts_30d: number;
  active_members_7d: number;
}

export interface FranchiseTotals {
  total_gyms: number;
  total_members: number;
  total_machines: number;
  total_workouts_7d: number;
  total_workouts_30d: number;
  total_active_members_7d: number;
}

// ============================================================================
// Push Notifications
// ============================================================================

export type NotificationType =
  // Activity
  | 'pr_achieved' | 'badge_unlocked' | 'level_up' | 'streak_milestone'
  | 'streak_broken' | 'leaderboard_rank' | 'challenge_rank_change' | 'challenge_complete'
  // Social
  | 'feed_reaction' | 'feed_comment' | 'new_follower'
  // Coaching
  | 'coach_note' | 'checkin_generated' | 'checkin_reply' | 'program_assigned'
  // Operational (owner/trainer-facing)
  | 'trial_ending' | 'payment_failed' | 'subscription_cancelled'
  | 'member_at_risk' | 'weekly_summary' | 'checkin_overdue' | 'machine_underutilized'
  // Agent-initiated (member-facing, is_agent_initiated=true)
  | 'agent_dormant_alert' | 'agent_welcome';

export interface DeviceToken {
  id: string;
  profile_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web';
  device_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Matches the notification_preferences table (migrations 001 + 021).
 * Keyed by member_id (members.id — not profile_id).
 * Postgres `time` columns (quiet_hours_start/end) arrive as 'HH:MM:SS' strings.
 * SMS/email preference columns are out of scope for v1.0 push work.
 */
export interface NotificationPreferences {
  id: string;
  member_id: string;
  enabled: boolean;
  push_prs: boolean;
  push_achievements: boolean;
  push_level_up: boolean;
  push_challenge_rank: boolean;
  push_new_program: boolean;
  push_trainer_note: boolean;
  push_gym_feed: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  updated_at: string;
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationLog {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: 'sent' | 'failed' | 'delivered';
  expo_receipt_id: string | null;
  created_at: string;
}

// ============================================================================
// Phase 4 — Member Home Screen Types
// ============================================================================

export type HeroVariant =
  | 'checkin-coming'
  | 'level-up'
  | 'program-complete'
  | 'pr-recent'
  | 'streak-milestone'
  | 'comeback'
  | 'program-week'
  | 'today-trained'
  | 'no-program'
  | 'today-fresh';

export interface HeroStateData {
  variant: HeroVariant;
  greeting: string;
  headline: string;
  subline: string;
  metric: string | null;
  gradient: string;
  accent: string;
}

export interface LevelInfoData {
  level: number;
  name: string;
  color: string;
  progressPct: number;
  pointsToNext: number;
  score: number;
}

export interface TodaySessionData {
  id: string;
  machine_name: string;
  sets_count: number;
  total_volume_lbs: number;
  completed_at: string | null;
}

export interface ProgramContextData {
  program_id: string;
  program_name: string;
  week_number: number;
  total_weeks: number;
  sessions_completed: number;
  sessions_total: number;
  today_exercises: Array<{ name: string; sets: number; reps: number }>;
  progress_pct: number;
  is_complete: boolean;
}

export interface ChallengeData {
  challenge_id: string;
  title: string;
  rank: number;
  total_participants: number;
  progress_pct: number;
  days_left: number;
}

export interface FeedEventData {
  id: string;
  event_type: string;
  member_name: string;
  description: string;
  created_at: string;
  reaction_count: number;
  /**
   * Optional context payload used by client-side localized renderers
   * (e.g. `formatFeedEvent` rebuilds the description from this in the
   * viewer's preferred weight unit). Included for home-screen feed.
   */
  context_data?: Record<string, unknown>;
}

export interface WeeklyStatsData {
  sessions_this_week: number;
  volume_this_week_lbs: number;
  prs_this_month: number;
  all_time_sessions: number;
  all_time_volume_lbs: number;
}

export interface HomeScreenData {
  hero: HeroStateData;
  level: LevelInfoData;
  today_sessions: TodaySessionData[];
  program: ProgramContextData | null;
  challenge: ChallengeData | null;
  feed: FeedEventData[];
  stats: WeeklyStatsData;
  readiness: import('./readiness').ReadinessResult | null;
  muscleMap: import('./muscleMap').MuscleMapResult | null;
}

// ============================================================================
// Phase 5 — Social and Community Types
// ============================================================================

export type FeedEventType =
  | 'pr_weight' | 'pr_volume' | 'streak_milestone'
  | 'program_complete' | 'session_milestone' | 'level_up'
  | 'achievement_earned' | 'challenge_launched' | 'challenge_joined'
  | 'challenge_rank_1' | 'challenge_podium' | 'challenge_complete'
  | 'member_spotlight' | 'gym_announcement' | 'new_member' | 'goal_reached'
  | 'archetype_change' | 'workout_share';

export type ReactionType = 'strength' | 'fire' | 'champion' | 'letsgo';

export interface FeedReactionCounts {
  strength: number;
  fire: number;
  champion: number;
  letsgo: number;
}

export interface FeedEventFull extends FeedEventData {
  member_id: string | null;
  avatar_url: string | null;
  context_data: Record<string, unknown>;
  priority: string;
  is_pinned: boolean;
  comment_count: number;
  reactions: FeedReactionCounts;
  my_reactions: ReactionType[];
}

export interface FeedComment {
  id: string;
  member_id: string;
  member_name: string;
  avatar_url: string | null;
  comment_text: string;
  mentioned_member_ids: string[];
  created_at: string;
}

export type ChallengeType = 'volume' | 'sessions' | 'machine_explorer' | 'pr' | 'streak' | 'team' | 'custom';
export type ChallengeEntryMode = 'open' | 'opt-in' | 'invite';

export interface ChallengeListItem extends ChallengeData {
  description: string | null;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_joined: boolean;
  my_score: number | null;
  top_score: number;
}

export interface ChallengeParticipant {
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  current_score: number;
  current_rank: number;
  joined_at: string;
}

export interface ChallengeDetail extends ChallengeListItem {
  entry_mode: ChallengeEntryMode;
  prize_type: string | null;
  prize_description: string | null;
  participants: ChallengeParticipant[];
  my_participation: ChallengeParticipant | null;
}

export type LeaderboardType = 'volume-weekly' | 'sessions-weekly' | 'prs-monthly' | 'streak-live' | 'score-alltime';

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  my_rank: number | null;
  total_participants: number;
}
