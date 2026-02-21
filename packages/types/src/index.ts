// ============================================================================
// Equipment Types
// ============================================================================

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
  movement_pattern: string | null;
  equipment_type: string | null;
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
  context: 'next_set' | 'summary' | 'machine_mistakes' | 'today_explanation';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  created_at?: string;
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
