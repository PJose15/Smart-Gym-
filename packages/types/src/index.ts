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

export type PointsReason = 'workout_completed' | 'set_logged' | 'streak_bonus' | 'manual';

export interface PointsLedger {
  id: string;
  gym_id: string;
  profile_id: string;
  points: number;
  reason: PointsReason;
  reference_id: string | null;
  created_at: string;
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

export interface FeatureFlag {
  id: string;
  gym_id: string | null;
  profile_id: string | null;
  key: string;
  enabled: boolean;
  created_at: string;
}

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
  context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation' | 'alternatives' | 'guardrails' | 'coach_draft' | 'safety_nudge' | 'checklist';
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
