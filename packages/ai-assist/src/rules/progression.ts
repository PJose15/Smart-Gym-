import type {
  NextSetSuggestion,
  WorkoutSet,
  UserGoal,
  WeightUnit,
  UserTrainingProfile,
} from '@smartgym/types';
import { formatWeight } from '@smartgym/utils';

// ─── Constants ──────────────────────────────────────────

const MAX_SAME_SESSION_JUMP_PERCENT = 0.10; // 10%
const FATIGUE_DROP_THRESHOLD = 0.30; // 30% rep drop
const HIGH_RPE_THRESHOLD = 9;
const LOW_RPE_THRESHOLD = 8;

// Rep ranges by goal (spec: general = 6-10, endurance = 12-20)
const REP_RANGES: Record<UserGoal, { min: number; max: number }> = {
  strength: { min: 3, max: 6 },
  hypertrophy: { min: 8, max: 12 },
  endurance: { min: 12, max: 20 },
  general: { min: 6, max: 10 },
};

// Human-readable goal labels for reason_text
const GOAL_LABELS: Record<UserGoal, string> = {
  strength: 'strength',
  hypertrophy: 'hypertrophy',
  endurance: 'endurance',
  general: 'general fitness',
};

// Weight increments by unit
const WEIGHT_INCREMENTS: Record<WeightUnit, { small: number; large: number }> = {
  kg: { small: 1.25, large: 2.5 },
  lbs: { small: 2.5, large: 5 },
};

// ─── Inputs ─────────────────────────────────────────────

export interface ProgressionInput {
  /** Sets logged in the CURRENT workout for this exercise */
  currentSets: WorkoutSet[];
  /** Sets from previous 1-2 sessions for same profile + machine */
  previousSets: WorkoutSet[];
  /** User training goal */
  goal?: UserGoal;
  /** Preferred unit */
  unit?: WeightUnit;
  /** Optional training profile for preferred rep override */
  trainingProfile?: Pick<UserTrainingProfile, 'preferred_rep_min' | 'preferred_rep_max'>;
}

// ─── Engine ─────────────────────────────────────────────

export function getNextSetSuggestion(input: ProgressionInput): NextSetSuggestion {
  const {
    currentSets,
    previousSets,
    goal = 'general',
    unit = 'kg',
    trainingProfile,
  } = input;

  // Use preferred rep range if set, otherwise fall back to goal-based range
  const goalRange = REP_RANGES[goal];
  const range =
    trainingProfile?.preferred_rep_min != null && trainingProfile?.preferred_rep_max != null
      ? { min: trainingProfile.preferred_rep_min, max: trainingProfile.preferred_rep_max }
      : goalRange;

  const inc = WEIGHT_INCREMENTS[unit];
  const goalLabel = GOAL_LABELS[goal];

  // ─── CASE: No data at all ──────────────────────────
  if (currentSets.length === 0 && previousSets.length === 0) {
    return {
      suggested_weight: null,
      suggested_reps: range.max,
      suggested_rpe: null,
      confidence: 0.2,
      reason_code: 'INSUFFICIENT_DATA',
      reason_text: `No history yet — log 2 sessions for ${goalLabel} suggestions.`,
      should_suggest_increase: false,
    };
  }

  // Use current session sets if available, otherwise fall back to previous
  const activeSets = currentSets.length > 0 ? currentSets : previousSets;
  const lastSet = activeSets[activeSets.length - 1];

  // ─── CASE: Weight missing (bodyweight / cable exercises) ──
  if (!lastSet.weight_kg || lastSet.weight_kg === 0) {
    return {
      suggested_weight: null,
      suggested_reps: range.max,
      suggested_rpe: null,
      confidence: 0.4,
      reason_code: 'REPS_ONLY',
      reason_text: `No weight recorded. Aim for ${range.min}-${range.max} reps (${goalLabel}).`,
      should_suggest_increase: false,
    };
  }

  const lastWeight = lastSet.weight_kg;
  const lastReps = lastSet.reps;
  const lastRpe = lastSet.rpe ?? null;

  // ─── CASE: Fatigue detection ────────────────────────
  if (currentSets.length >= 2) {
    const firstSetAtWeight = currentSets.find(
      (s) => s.weight_kg === lastWeight && s.weight_kg > 0,
    );
    if (firstSetAtWeight) {
      const repDrop = (firstSetAtWeight.reps - lastReps) / firstSetAtWeight.reps;
      if (repDrop > FATIGUE_DROP_THRESHOLD || (lastRpe !== null && lastRpe >= HIGH_RPE_THRESHOLD)) {
        const decrease = clampWeightDecrease(lastWeight, inc.small);
        return {
          suggested_weight: roundWeight(lastWeight - decrease, unit),
          suggested_reps: lastReps,
          suggested_rpe: null,
          confidence: computeConfidence(currentSets, previousSets, 'high_fatigue'),
          reason_code: 'DECREASE_FATIGUE',
          reason_text: repDrop > FATIGUE_DROP_THRESHOLD
            ? `Reps dropped ${Math.round(repDrop * 100)}% — reducing weight to protect form.`
            : `RPE ${lastRpe} is very high — consider reducing weight.`,
          safety_note: 'Prioritize form over load when fatigued.',
          should_suggest_increase: false,
        };
      }
    }
  }

  // RPE-only fatigue check (even on first set)
  if (lastRpe !== null && lastRpe >= HIGH_RPE_THRESHOLD) {
    return {
      suggested_weight: lastWeight,
      suggested_reps: Math.max(lastReps - 1, 1),
      suggested_rpe: null,
      confidence: computeConfidence(currentSets, previousSets, 'moderate'),
      reason_code: 'DECREASE_FATIGUE',
      reason_text: `RPE ${lastRpe} is high — keep weight and aim for similar reps.`,
      should_suggest_increase: false,
    };
  }

  // ─── CASE: Progressive overload trigger ─────────────
  const setsAtWeight = currentSets.filter(
    (s) => s.weight_kg === lastWeight && s.weight_kg > 0,
  );
  const setsHittingTopRange = setsAtWeight.filter((s) => s.reps >= range.max);

  if (
    setsHittingTopRange.length >= 2 &&
    (lastRpe === null || lastRpe <= LOW_RPE_THRESHOLD)
  ) {
    const increase = inc.small;
    const newWeight = roundWeight(lastWeight + increase, unit);

    // Hard constraint: never >10% jump in same session
    if (isWithinMaxJump(lastWeight, newWeight)) {
      return {
        suggested_weight: newWeight,
        suggested_reps: range.min,
        suggested_rpe: null,
        confidence: computeConfidence(currentSets, previousSets, 'strong'),
        reason_code: 'INCREASE_SMALL',
        reason_text: `Hit ${range.max} reps on ${setsHittingTopRange.length} sets at ${formatWeight(lastWeight, unit)} — time to go up for ${goalLabel}!`,
        should_suggest_increase: true,
      };
    }
  }

  // ─── CASE: New machine (no current sets, only previous) ──
  if (currentSets.length === 0 && previousSets.length > 0) {
    return {
      suggested_weight: lastWeight,
      suggested_reps: lastReps,
      suggested_rpe: null,
      confidence: computeConfidence(currentSets, previousSets, 'baseline'),
      reason_code: 'NEW_MACHINE_BASELINE',
      reason_text: `Based on your last session: ${formatWeight(lastWeight, unit)} x ${lastReps} (${goalLabel}).`,
      should_suggest_increase: false,
    };
  }

  // ─── DEFAULT: Repeat last set ──────────────────────
  return {
    suggested_weight: lastWeight,
    suggested_reps: lastReps,
    suggested_rpe: null,
    confidence: computeConfidence(currentSets, previousSets, 'moderate'),
    reason_code: 'REPEAT_LAST_SET',
    reason_text: `Repeat ${formatWeight(lastWeight, unit)} x ${lastReps} for ${goalLabel} consistency.`,
    should_suggest_increase: false,
  };
}

// ─── Helpers ────────────────────────────────────────────

function computeConfidence(
  currentSets: WorkoutSet[],
  previousSets: WorkoutSet[],
  context: 'strong' | 'moderate' | 'baseline' | 'high_fatigue',
): number {
  const totalDataPoints = currentSets.length + previousSets.length;

  let base: number;
  switch (context) {
    case 'strong':
      base = 0.85;
      break;
    case 'moderate':
      base = 0.6;
      break;
    case 'high_fatigue':
      base = 0.75;
      break;
    case 'baseline':
      base = 0.45;
      break;
  }

  // More data → higher confidence (up to +0.15)
  const dataBonus = Math.min(totalDataPoints * 0.03, 0.15);
  return Math.min(base + dataBonus, 1.0);
}

function isWithinMaxJump(currentWeight: number, newWeight: number): boolean {
  if (currentWeight <= 0) return true;
  return (newWeight - currentWeight) / currentWeight <= MAX_SAME_SESSION_JUMP_PERCENT;
}

function clampWeightDecrease(weight: number, smallIncrement: number): number {
  // If current weight is too low, don't decrease further
  if (weight <= smallIncrement) return 0;
  return smallIncrement;
}

function roundWeight(weight: number, unit: WeightUnit): number {
  const precision = WEIGHT_INCREMENTS[unit].small;
  return Math.round(weight / precision) * precision;
}
