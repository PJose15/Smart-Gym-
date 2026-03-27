import type {
  PRDetection,
  GuardrailInsight,
  UserGoal,
  ExperienceLevel,
  WeightUnit,
  DraftSignals,
  WorkoutExerciseWithSets,
  WorkoutSet,
  TrainerTone,
  TrainerVerbosity,
} from '@nexera/types';

// ─── Style Settings ──────────────────────────────────────

export interface StyleSettings {
  tone: TrainerTone;
  verbosity: TrainerVerbosity;
}

// ─── Feedback Trends ─────────────────────────────────────

export interface FeedbackTrends {
  discomfort_count_7d: number;
  unstable_count_7d: number;
  top_body_areas: string[];
}

// ─── Adherence vs Plan ───────────────────────────────────

export interface AdherenceVsPlan {
  expected_workouts: number;
  actual_workouts: number;
}

// ─── Workout Draft Input ────────────────────────────────

export interface WorkoutDraftInput {
  /** Member's name */
  memberName: string;
  /** Workout exercises with sets */
  exercises: WorkoutExerciseWithSets[];
  /** PRs detected in this workout */
  prs: PRDetection[];
  /** Volume change % vs previous session (null if no previous) */
  volumeChangePct: number | null;
  /** Total volume in kg */
  totalVolumeKg: number;
  /** Total sets logged */
  totalSets: number;
  /** Total reps logged */
  totalReps: number;
  /** Active guardrail insights (optional) */
  guardrails?: GuardrailInsight[];
  /** Training profile */
  goal?: UserGoal;
  experience?: ExperienceLevel;
  units?: WeightUnit;
  /** Feedback trends from set_feedback (Phase 2.5.4) */
  feedbackTrends?: FeedbackTrends;
  /** Adherence vs plan (Phase 2.5.4) */
  adherenceVsPlan?: AdherenceVsPlan;
  /** Trainer style settings (Phase 2.5.4) */
  style?: StyleSettings;
}

// ─── Weekly Draft Input ─────────────────────────────────

export interface WeeklyDraftInput {
  /** Member's name */
  memberName: string;
  /** Number of workouts completed in the period */
  workoutsCompleted: number;
  /** Total PRs hit in the period */
  prCount: number;
  /** List of PR summaries */
  prSummaries: Array<{ exercise: string; type: string; value: number }>;
  /** Number of days with at least one workout */
  activeDays: number;
  /** Expected days (e.g., from program) — null if unknown */
  expectedDays: number | null;
  /** Active guardrail insights */
  guardrails?: GuardrailInsight[];
  /** Total volume across the period */
  totalVolumeKg: number;
  /** Volume change vs previous period */
  volumeChangePct: number | null;
  /** Training profile */
  goal?: UserGoal;
  experience?: ExperienceLevel;
  units?: WeightUnit;
  /** Period date range */
  periodStart: string;
  periodEnd: string;
  /** Feedback trends from set_feedback (Phase 2.5.4) */
  feedbackTrends?: FeedbackTrends;
  /** Adherence vs plan (Phase 2.5.4) */
  adherenceVsPlan?: AdherenceVsPlan;
  /** Trainer style settings (Phase 2.5.4) */
  style?: StyleSettings;
}

// ─── Draft Output ───────────────────────────────────────

export interface DraftOutput {
  draft_title: string;
  draft_body: string;
  confidence: number;
  signals: DraftSignals;
}
