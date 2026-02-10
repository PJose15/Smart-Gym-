import type { PRDetection, WorkoutSet, WorkoutExerciseWithSets } from '@smartgym/types';
import { estimate1RM } from '@smartgym/utils';

export interface PRInput {
  /** Current workout exercises with sets */
  currentExercises: WorkoutExerciseWithSets[];
  /** Historical exercises (all completed workouts, same profile) */
  historicalSets: Map<string, WorkoutSet[]>; // keyed by exercise_name
}

/**
 * Detect personal records in the current workout compared to history.
 */
export function detectPRs(input: PRInput): PRDetection[] {
  const prs: PRDetection[] = [];

  for (const exercise of input.currentExercises) {
    if (exercise.sets.length === 0) continue;

    const exerciseName = exercise.exercise_name;
    const historySets = input.historicalSets.get(exerciseName) ?? [];

    // Find current bests
    let currentBestWeight = 0;
    let currentBestRepsAtWeight = 0;
    let currentBest1RM = 0;

    for (const set of exercise.sets) {
      if (set.weight_kg > currentBestWeight) {
        currentBestWeight = set.weight_kg;
        currentBestRepsAtWeight = set.reps;
      } else if (set.weight_kg === currentBestWeight && set.reps > currentBestRepsAtWeight) {
        currentBestRepsAtWeight = set.reps;
      }

      if (set.weight_kg > 0 && set.reps > 0) {
        const est = estimate1RM(set.weight_kg, set.reps);
        if (est > currentBest1RM) currentBest1RM = est;
      }
    }

    // Find historical bests
    let histBestWeight = 0;
    let histBestRepsAtWeight = 0;
    let histBest1RM = 0;

    for (const set of historySets) {
      if (set.weight_kg > histBestWeight) {
        histBestWeight = set.weight_kg;
        histBestRepsAtWeight = set.reps;
      } else if (set.weight_kg === histBestWeight && set.reps > histBestRepsAtWeight) {
        histBestRepsAtWeight = set.reps;
      }

      if (set.weight_kg > 0 && set.reps > 0) {
        const est = estimate1RM(set.weight_kg, set.reps);
        if (est > histBest1RM) histBest1RM = est;
      }
    }

    // PR_WEIGHT: highest weight ever for >= 1 rep
    if (currentBestWeight > histBestWeight && currentBestWeight > 0) {
      prs.push({
        type: 'PR_WEIGHT',
        exercise_name: exerciseName,
        machine_id: exercise.machine_id ?? undefined,
        value: currentBestWeight,
        previous_value: histBestWeight > 0 ? histBestWeight : null,
      });
    }

    // PR_REPS: most reps at a given weight (check current best weight in history)
    if (
      currentBestWeight > 0 &&
      currentBestWeight === histBestWeight &&
      currentBestRepsAtWeight > histBestRepsAtWeight
    ) {
      prs.push({
        type: 'PR_REPS',
        exercise_name: exerciseName,
        machine_id: exercise.machine_id ?? undefined,
        value: currentBestRepsAtWeight,
        previous_value: histBestRepsAtWeight > 0 ? histBestRepsAtWeight : null,
      });
    }

    // PR_EST_1RM
    if (currentBest1RM > histBest1RM && currentBest1RM > 0) {
      prs.push({
        type: 'PR_EST_1RM',
        exercise_name: exerciseName,
        machine_id: exercise.machine_id ?? undefined,
        value: Math.round(currentBest1RM * 10) / 10,
        previous_value: histBest1RM > 0 ? Math.round(histBest1RM * 10) / 10 : null,
      });
    }
  }

  return prs;
}
