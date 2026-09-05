/**
 * Active-workout helpers for the sessions model (workout_sessions, lbs).
 *
 * Pure helpers (validation, aggregation, unit adapters) plus a small
 * module-level handoff store so the logger screen can pass
 * CompleteSessionResult / PrResult payloads to the completion screen
 * without serializing them through route params.
 */
import { supabase } from './supabase';
import { convertFromLbs } from './feedLogic';
import type { WeightUnit, WorkoutSet } from '@nexera/types';
import type {
  CompleteSessionResult,
  PrResult,
  SessionSetEntry,
  WorkoutMode as ApiWorkoutMode,
} from './sessionApi';
import type { WorkoutMode as ModeContextMode } from './workoutMode';

// ─── Identity ───────────────────────────────────────────

export interface WorkoutIdentity {
  userId: string;
  memberId: string;
  gymId: string;
}

let identityMemo: WorkoutIdentity | null = null;

/**
 * Resolve auth user → member row (id + gym) once per app session.
 * Returns null when signed out or when no member row exists.
 */
export async function resolveWorkoutIdentity(): Promise<WorkoutIdentity | null> {
  if (identityMemo) return identityMemo;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('members')
      .select('id, gym_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!data?.id || !data?.gym_id) return null;
    identityMemo = { userId: user.id, memberId: data.id, gymId: data.gym_id };
    return identityMemo;
  } catch {
    return null;
  }
}

/** Drop the memoized identity (call on sign-out). */
export function clearWorkoutIdentityCache(): void {
  identityMemo = null;
}

// ─── Mode mapping ───────────────────────────────────────

/** Map the workoutMode.ts context mode to the sessions-API enum. */
export function toApiWorkoutMode(mode: ModeContextMode): ApiWorkoutMode {
  switch (mode) {
    case 'ai-program':
      return 'ai_program';
    case 'trainer-program':
      return 'trainer_program';
    default:
      return 'free';
  }
}

// ─── Set input validation ───────────────────────────────

/** Weight caps in the member's display unit. */
export const MAX_WEIGHT: Record<WeightUnit, number> = { lbs: 1500, kg: 700 };

/**
 * Validate a set entered in the display unit.
 * Returns a human-readable error string, or null when valid.
 */
export function validateSetInput(
  weightDisplay: number,
  unit: WeightUnit,
  reps: number,
  rpe?: number | null,
): string | null {
  if (Number.isNaN(weightDisplay) || weightDisplay < 0) {
    return 'Weight must be 0 or greater.';
  }
  if (weightDisplay > MAX_WEIGHT[unit]) {
    return `Weight cannot exceed ${MAX_WEIGHT[unit]} ${unit}.`;
  }
  if (Number.isNaN(reps) || !Number.isInteger(reps) || reps < 1) {
    return 'Reps must be a positive whole number.';
  }
  if (reps > 999) {
    return 'Reps cannot exceed 999.';
  }
  if (rpe != null) {
    if (Number.isNaN(rpe) || rpe < 1 || rpe > 10) {
      return 'RPE must be between 1 and 10.';
    }
  }
  return null;
}

// ─── Day aggregation ────────────────────────────────────

export interface DaySessionRow {
  sets: SessionSetEntry[] | null;
  sets_count?: number | null;
  total_volume_lbs: number | null;
  best_weight_lbs: number | null;
}

export interface DayAggregate {
  sessions: number;
  sets: number;
  volumeLbs: number;
  bestWeightLbs: number;
}

/** Aggregate one calendar day of sessions (sets, volume, best weight — lbs). */
export function aggregateDay(sessions: DaySessionRow[]): DayAggregate {
  let sets = 0;
  let volumeLbs = 0;
  let bestWeightLbs = 0;
  for (const s of sessions) {
    sets += s.sets_count ?? s.sets?.length ?? 0;
    volumeLbs += s.total_volume_lbs ?? 0;
    if ((s.best_weight_lbs ?? 0) > bestWeightLbs) {
      bestWeightLbs = s.best_weight_lbs ?? 0;
    }
  }
  return { sessions: sessions.length, sets, volumeLbs, bestWeightLbs };
}

// ─── ai-assist boundary adapter ─────────────────────────

/**
 * Convert session sets (lbs) into the legacy WorkoutSet shape (kg) expected
 * by @nexera/ai-assist getNextSetSuggestion. Synthetic ids — the engine only
 * reads weight_kg / reps / rpe / set_number.
 */
export function sessionSetsToKg(sets: SessionSetEntry[]): WorkoutSet[] {
  return sets.map((s) => ({
    id: `session-set-${s.set_number}`,
    workout_exercise_id: '',
    set_number: s.set_number,
    reps: s.reps,
    weight_kg: convertFromLbs(s.weight_lbs, 'kg'),
    rpe: s.rpe,
    logged_at: s.logged_at,
  }));
}

// ─── Completion handoff store ───────────────────────────
// CompleteSessionResult payloads can't ride expo-router params, so the
// logger stashes them here and the complete screen consumes them once.

let stashedResults: CompleteSessionResult[] | null = null;
let stashedPrs: PrResult[] = [];

export function stashCompletionResults(results: CompleteSessionResult[]): void {
  stashedResults = results;
}

export function consumeCompletionResults(): CompleteSessionResult[] | null {
  const results = stashedResults;
  stashedResults = null;
  return results;
}

/** Collect a PR detected mid-session for the completion screen. */
export function stashPrResult(pr: PrResult): void {
  stashedPrs.push(pr);
}

export function consumePrResults(): PrResult[] {
  const prs = stashedPrs;
  stashedPrs = [];
  return prs;
}
