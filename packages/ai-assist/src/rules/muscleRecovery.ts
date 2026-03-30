import type {
  MuscleGroupKey,
  MuscleRecoveryState,
  MuscleRecoveryStateLabel,
  MuscleMapRecommendations,
} from '@nexera/types';
import { MUSCLE_GROUP_MAP } from './muscleGroups';

// ============================================================================
// Recovery State Colors
// ============================================================================

const STATE_COLORS: Record<MuscleRecoveryStateLabel, string> = {
  fresh:      '#639922', // green — ready to go
  primed:     '#3B8BD4', // blue — optimal window
  recovering: '#D85A30', // orange — still recovering
  fatigued:   '#C43030', // red — needs rest
};

// ============================================================================
// Recovery Hours Required
// ============================================================================

/**
 * How many hours a muscle needs to recover, based on RPE and primary/secondary.
 * Secondary muscles need 60% of primary recovery time.
 */
export function getRecoveryHoursRequired(
  baseHours: number,
  rpe: number,
  isPrimary: boolean
): number {
  // RPE multiplier: RPE 6 = 0.8x, RPE 7 = 0.9x, RPE 8 = 1.0x, RPE 9 = 1.15x, RPE 10 = 1.3x
  const rpeMultiplier =
    rpe <= 6 ? 0.8
    : rpe <= 7 ? 0.9
    : rpe <= 8 ? 1.0
    : rpe <= 9 ? 1.15
    : 1.3;

  const secondaryMultiplier = isPrimary ? 1.0 : 0.6;

  return Math.round(baseHours * rpeMultiplier * secondaryMultiplier);
}

// ============================================================================
// Calculate Single Muscle State
// ============================================================================

/**
 * Determine recovery state for a single muscle group.
 * `lastTrainedAt` is ISO timestamp; `rpe` is average RPE of that session; `isPrimary` indicates
 * whether the muscle was a primary mover.
 */
export function calculateMuscleState(
  key: MuscleGroupKey,
  lastTrainedAt: string | null,
  rpe: number,
  isPrimary: boolean,
  now: Date = new Date()
): MuscleRecoveryState {
  const info = MUSCLE_GROUP_MAP[key];
  if (!info) {
    return {
      key,
      label: key,
      state: 'fresh',
      hoursSinceTraining: null,
      recoveryPct: 100,
      lastTrainedAt: null,
      color: STATE_COLORS.fresh,
    };
  }

  if (!lastTrainedAt) {
    return {
      key,
      label: info.label,
      state: 'fresh',
      hoursSinceTraining: null,
      recoveryPct: 100,
      lastTrainedAt: null,
      color: STATE_COLORS.fresh,
    };
  }

  const trainedTime = new Date(lastTrainedAt).getTime();
  const hoursSinceTraining = (now.getTime() - trainedTime) / 3600000;
  const recoveryRequired = getRecoveryHoursRequired(info.recoveryBaseHours, rpe, isPrimary);

  // Recovery percentage (0-100)
  const recoveryPct = Math.min(100, Math.round((hoursSinceTraining / recoveryRequired) * 100));

  // State determination — use recoveryRequired, not a hardcoded 24h floor,
  // so short-recovery muscles (forearms, abs, calves) transition correctly at low RPE.
  let state: MuscleRecoveryStateLabel;
  if (hoursSinceTraining < 8) {
    state = 'fatigued';
  } else if (hoursSinceTraining < recoveryRequired) {
    state = 'recovering';
  } else if (hoursSinceTraining < recoveryRequired * 1.5) {
    state = 'primed';
  } else {
    state = 'fresh';
  }

  return {
    key,
    label: info.label,
    state,
    hoursSinceTraining: Math.round(hoursSinceTraining),
    recoveryPct,
    lastTrainedAt,
    color: STATE_COLORS[state],
  };
}

// ============================================================================
// Build Recommendations
// ============================================================================

export function buildMuscleRecommendations(
  states: Record<MuscleGroupKey, MuscleRecoveryState>
): MuscleMapRecommendations {
  const readyToTrain: MuscleGroupKey[] = [];
  const needsRecovery: MuscleGroupKey[] = [];

  for (const [key, muscleState] of Object.entries(states) as Array<[MuscleGroupKey, MuscleRecoveryState]>) {
    if (muscleState.state === 'fresh' || muscleState.state === 'primed') {
      readyToTrain.push(key);
    } else {
      needsRecovery.push(key);
    }
  }

  // Suggest focus: prioritize primed muscles (optimal training window), then fresh
  const primed = readyToTrain.filter(k => states[k].state === 'primed');
  const fresh = readyToTrain.filter(k => states[k].state === 'fresh');

  // Prefer primed muscles, then pick from fresh to fill up to 4
  const suggestedFocus = [...primed, ...fresh].slice(0, 4);

  // Build message
  let message: string;
  if (needsRecovery.length === 0) {
    message = 'All muscle groups are recovered — full body session is an option';
  } else if (readyToTrain.length === 0) {
    message = 'All muscle groups are still recovering — consider a rest day or light cardio';
  } else if (primed.length > 0) {
    const primedLabels = primed.slice(0, 3).map(k => states[k].label);
    message = `${primedLabels.join(', ')} ${primed.length === 1 ? 'is' : 'are'} in the optimal training window`;
  } else {
    message = `${readyToTrain.length} muscle groups ready to train`;
  }

  return {
    readyToTrain,
    needsRecovery,
    suggestedFocus,
    message,
  };
}

// ============================================================================
// Balance Score (0-100)
// ============================================================================

/**
 * Calculates how balanced the member's training is across all muscle groups.
 * 100 = perfectly balanced, 0 = only training one area.
 * Based on coefficient of variation of hours since each muscle was last trained.
 */
export function calculateBalanceScore(
  states: Record<MuscleGroupKey, MuscleRecoveryState>
): number {
  const hours: number[] = [];
  let trainedCount = 0;
  for (const state of Object.values(states)) {
    // Use hoursSinceTraining, or 168 (7 days) for never-trained
    hours.push(state.hoursSinceTraining ?? 168);
    if (state.hoursSinceTraining !== null) trainedCount++;
  }

  if (hours.length === 0 || trainedCount === 0) return 0;

  const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
  if (mean === 0) return 100;

  const variance = hours.reduce((sum, h) => sum + (h - mean) ** 2, 0) / hours.length;
  const cv = Math.sqrt(variance) / mean;

  // CV of 0 = perfect balance (score 100), CV >= 1 = very unbalanced (score 0)
  const score = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
  return score;
}
